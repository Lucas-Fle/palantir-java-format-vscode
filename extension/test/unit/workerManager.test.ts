import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  validateJava: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: mocks.spawn
}));

vi.mock("../../src/configuration", () => ({
  readConfiguration: () => ({ javaHome: "", jvmArgs: [] })
}));

vi.mock("../../src/javaRuntime", () => ({
  configuredJavaExecutable: () => "java",
  validateJava: mocks.validateJava
}));

vi.mock("../../src/workerClient", () => ({
  WorkerClient: class {
    public constructor(private readonly child: MockChild) {}

    public request<TResult>(request: { method: string }): Promise<TResult> {
      if (request.method === "initialize") {
        return Promise.resolve({
          formatterVersion: "2.91.0",
          workerVersion: "test"
        } as TResult);
      }
      if (request.method === "shutdown") {
        this.child.exitCode = 0;
        this.child.emit("exit", 0, null);
        return Promise.resolve(undefined as TResult);
      }
      return Promise.resolve({ formatted: "formatted" } as TResult);
    }

    public rejectAll(): void {}

    public dispose(): void {}
  }
}));

import type { Logger } from "../../src/logger";
import { WorkerManager } from "../../src/workerManager";

class MockChild extends EventEmitter {
  public exitCode: number | null = null;
  public readonly stderr = new EventEmitter();

  public kill(): boolean {
    if (this.exitCode === null) {
      this.exitCode = 1;
      this.emit("exit", 1, null);
    }
    return true;
  }
}

const loggerMocks = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
};
const logger = loggerMocks as unknown as Logger;

describe("WorkerManager lifecycle", () => {
  beforeEach(() => {
    mocks.spawn.mockReset();
    mocks.validateJava.mockReset();
    loggerMocks.error.mockClear();
    loggerMocks.info.mockClear();
    loggerMocks.warn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not spawn a worker when disposed during Java validation", async () => {
    let finishValidation: ((version: string) => void) | undefined;
    mocks.validateJava.mockReturnValue(
      new Promise<string>((resolve) => {
        finishValidation = resolve;
      })
    );
    const manager = new WorkerManager("extension", logger);

    const formatting = manager.formatDocument("source");
    await vi.waitFor(() => expect(mocks.validateJava).toHaveBeenCalledOnce());

    manager.dispose();
    finishValidation?.("21");

    await expect(formatting).rejects.toThrow("disposed");
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(manager.state).toBe("stopped");
  });

  it("cancels a scheduled automatic restart when disposed", async () => {
    vi.useFakeTimers();
    mocks.validateJava.mockResolvedValue("21");
    const child = new MockChild();
    mocks.spawn.mockReturnValue(child);
    const manager = new WorkerManager("extension", logger);

    await manager.formatDocument("source");
    expect(mocks.spawn).toHaveBeenCalledOnce();

    child.exitCode = 1;
    child.emit("exit", 1, null);
    manager.dispose();
    await vi.runAllTimersAsync();

    expect(mocks.spawn).toHaveBeenCalledOnce();
    expect(manager.state).toBe("stopped");
  });
});
