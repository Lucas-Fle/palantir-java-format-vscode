import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";

import type * as vscode from "vscode";

import {
  FORMATTER_VERSION,
  JAVAC_EXPORTS,
  WORKER_JAR_NAME
} from "./constants";
import { readConfiguration } from "./configuration";
import { configuredJavaExecutable, validateJava } from "./javaRuntime";
import type { Logger } from "./logger";
import { createRequest, type FormatDocumentResult, type InitializeResult } from "./protocol";
import { WorkerClient } from "./workerClient";

export type WorkerState = "stopped" | "starting" | "ready" | "stopping" | "failed";

const STARTUP_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;
const STABLE_PERIOD_MS = 60_000;
const MAX_AUTOMATIC_RESTARTS = 3;

function isRunning(child: ChildProcessWithoutNullStreams): boolean {
  return child.exitCode === null;
}

export class WorkerManager implements vscode.Disposable {
  private stateValue: WorkerState = "stopped";
  private child: ChildProcessWithoutNullStreams | undefined;
  private client: WorkerClient | undefined;
  private startPromise: Promise<void> | undefined;
  private restartPromise: Promise<void> | undefined;
  private crashCount = 0;
  private stableTimer: NodeJS.Timeout | undefined;
  private intentionalStop = false;
  private disposed = false;

  public constructor(
    private readonly extensionPath: string,
    private readonly logger: Logger
  ) {}

  public get state(): WorkerState {
    return this.stateValue;
  }

  public async formatDocument(source: string): Promise<string> {
    await this.ensureReady();
    const result = await this.requireClient().request<FormatDocumentResult>(
      createRequest("formatDocument", { source }),
      REQUEST_TIMEOUT_MS
    );
    return result.formatted;
  }

  public async restart(): Promise<void> {
    this.logger.info("Manual worker restart requested.");
    this.crashCount = 0;
    await this.stop();
    await this.start();
  }

  public async stop(): Promise<void> {
    if (this.stateValue === "stopped") {
      return;
    }
    this.intentionalStop = true;
    this.setState("stopping");
    this.clearStableTimer();

    const child = this.child;
    const client = this.client;
    if (child !== undefined && client !== undefined && child.exitCode === null) {
      try {
        await client.request(createRequest("shutdown", {}), SHUTDOWN_TIMEOUT_MS);
        await this.waitForExit(child, SHUTDOWN_TIMEOUT_MS);
      } catch (error) {
        this.logger.warn(error instanceof Error ? error.message : String(error));
      }
      if (isRunning(child)) {
        this.logger.warn("Forcing worker termination after graceful shutdown timeout.");
        child.kill();
      }
    }

    client?.dispose();
    this.child = undefined;
    this.client = undefined;
    this.startPromise = undefined;
    this.restartPromise = undefined;
    this.setState("stopped");
    this.intentionalStop = false;
  }

  public dispose(): void {
    this.disposed = true;
    void this.stop();
  }

  private async ensureReady(): Promise<void> {
    if (this.disposed) {
      throw new Error("Formatter worker manager is disposed.");
    }
    if (this.stateValue === "ready") {
      return;
    }
    if (this.restartPromise !== undefined) {
      return this.restartPromise;
    }
    return this.start();
  }

  private async start(): Promise<void> {
    if (this.stateValue === "ready") {
      return;
    }
    if (this.startPromise !== undefined) {
      return this.startPromise;
    }

    this.startPromise = this.startInternal().catch((error: unknown) => {
      this.setState("failed");
      throw error;
    });
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  }

  private async startInternal(): Promise<void> {
    this.setState("starting");
    const config = readConfiguration();
    const javaExecutable = configuredJavaExecutable(config.javaHome);
    const javaVersion = await validateJava(javaExecutable);
    const jarPath = path.join(this.extensionPath, "dist", "worker", WORKER_JAR_NAME);
    const exportArgs = JAVAC_EXPORTS.flatMap((value) => ["--add-exports", value]);
    const args = [...config.jvmArgs, ...exportArgs, "-jar", jarPath];

    this.logger.info(`Starting worker with Java ${javaVersion}: ${javaExecutable}`);
    this.logger.info(`Bundled Palantir Java Format version: ${FORMATTER_VERSION}`);

    const child = spawn(javaExecutable, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.child = child;
    this.client = new WorkerClient(child, (message) => this.logger.warn(message));
    child.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/u)) {
        if (line.length > 0) {
          this.logger.info(`[worker] ${line}`);
        }
      }
    });
    child.once("exit", (code, signal) => this.handleExit(child, code, signal));

    try {
      const initialized = await this.client.request<InitializeResult>(
        createRequest("initialize", {}),
        STARTUP_TIMEOUT_MS
      );
      if (initialized.formatterVersion !== FORMATTER_VERSION) {
        throw new Error(
          `Worker reports Palantir ${initialized.formatterVersion}, expected ${FORMATTER_VERSION}.`
        );
      }
      this.setState("ready");
      this.logger.info(
        `Worker ${initialized.workerVersion} ready (Palantir ${initialized.formatterVersion}).`
      );
      this.clearStableTimer();
      this.stableTimer = setTimeout(() => {
        this.crashCount = 0;
        this.logger.info("Worker restart counter reset after stable operation.");
      }, STABLE_PERIOD_MS);
    } catch (error) {
      this.setState("failed");
      child.kill();
      throw error;
    }
  }

  private handleExit(
    exitedChild: ChildProcessWithoutNullStreams,
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    if (this.child !== exitedChild) {
      return;
    }
    this.clearStableTimer();
    this.client?.rejectAll(
      new Error(`Formatter worker exited (code=${String(code)}, signal=${String(signal)}).`)
    );
    this.child = undefined;
    this.client = undefined;

    if (this.intentionalStop || this.disposed || this.stateValue === "stopping") {
      return;
    }

    this.setState("failed");
    this.logger.error(`Worker crashed (code=${String(code)}, signal=${String(signal)}).`);
    if (this.crashCount >= MAX_AUTOMATIC_RESTARTS) {
      this.logger.error("Automatic worker restart limit reached.");
      return;
    }

    this.crashCount += 1;
    const delayMs = 250 * 2 ** (this.crashCount - 1);
    this.logger.warn(
      `Restarting worker in ${delayMs} ms (attempt ${this.crashCount}/${MAX_AUTOMATIC_RESTARTS}).`
    );
    this.restartPromise = new Promise((resolve) => setTimeout(resolve, delayMs))
      .then(() => this.start())
      .catch((error: unknown) => {
        this.logger.error(
          `Automatic worker restart failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      })
      .finally(() => {
        this.restartPromise = undefined;
      });
    void this.restartPromise.catch(() => undefined);
  }

  private requireClient(): WorkerClient {
    if (this.client === undefined || this.stateValue !== "ready") {
      throw new Error("Formatter worker is not ready.");
    }
    return this.client;
  }

  private setState(state: WorkerState): void {
    this.stateValue = state;
  }

  private clearStableTimer(): void {
    if (this.stableTimer !== undefined) {
      clearTimeout(this.stableTimer);
      this.stableTimer = undefined;
    }
  }

  private async waitForExit(
    child: ChildProcessWithoutNullStreams,
    timeoutMs: number
  ): Promise<void> {
    if (child.exitCode !== null) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.removeListener("exit", onExit);
        reject(new Error("Worker did not exit after acknowledging shutdown."));
      }, timeoutMs);
      const onExit = (): void => {
        clearTimeout(timer);
        resolve();
      };
      child.once("exit", onExit);
    });
  }
}
