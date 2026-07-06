import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  spawn: vi.fn()
}));

vi.mock("../../src/workerProcessFactory", () => ({
  JavaWorkerProcessFactory: class {
    public prepare(): never {
      throw new Error("Unexpected default process factory.");
    }
  }
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
import type {
  PreparedWorkerProcess,
  WorkerProcessFactory
} from "../../src/workerProcessFactory";

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
const processFactory: WorkerProcessFactory = {
  prepare: mocks.prepare
};

function preparedProcess(child: MockChild): PreparedWorkerProcess {
  return {
    javaExecutable: "java",
    javaVersion: 21,
    spawn: () => {
      mocks.spawn();
      return child as unknown as ChildProcessWithoutNullStreams;
    }
  };
}

describe("WorkerManager lifecycle", () => {
  beforeEach(() => {
    mocks.prepare.mockReset();
    mocks.spawn.mockReset();
    loggerMocks.error.mockClear();
    loggerMocks.info.mockClear();
    loggerMocks.warn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not spawn a worker when disposed during process preparation", async () => {
    let finishPreparation: ((process: PreparedWorkerProcess) => void) | undefined;
    const child = new MockChild();
    mocks.prepare.mockReturnValue(
      new Promise<PreparedWorkerProcess>((resolve) => {
        finishPreparation = resolve;
      })
    );
    const manager = new WorkerManager("extension", logger, processFactory);

    const formatting = manager.formatDocument("source");
    await vi.waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce());

    manager.dispose();
    finishPreparation?.(preparedProcess(child));

    await expect(formatting).rejects.toThrow("disposed");
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(manager.state).toBe("stopped");
  });

  it("cancels a scheduled automatic restart when disposed", async () => {
    vi.useFakeTimers();
    const child = new MockChild();
    mocks.prepare.mockResolvedValue(preparedProcess(child));
    const manager = new WorkerManager("extension", logger, processFactory);

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
