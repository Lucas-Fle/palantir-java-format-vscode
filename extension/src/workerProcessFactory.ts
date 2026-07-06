import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";

import { JAVAC_EXPORTS, WORKER_JAR_NAME } from "./constants";
import { readConfiguration } from "./configuration";
import { configuredJavaExecutable, validateJava } from "./javaRuntime";

export interface PreparedWorkerProcess {
  javaExecutable: string;
  javaVersion: number;
  spawn: () => ChildProcessWithoutNullStreams;
}

export interface WorkerProcessFactory {
  prepare: (extensionPath: string) => Promise<PreparedWorkerProcess>;
}

export class JavaWorkerProcessFactory implements WorkerProcessFactory {
  public async prepare(extensionPath: string): Promise<PreparedWorkerProcess> {
    const config = readConfiguration();
    const javaExecutable = configuredJavaExecutable(config.javaHome);
    const javaVersion = await validateJava(javaExecutable);
    const jarPath = path.join(extensionPath, "dist", "worker", WORKER_JAR_NAME);
    const exportArgs = JAVAC_EXPORTS.flatMap((value) => ["--add-exports", value]);
    const args = [...config.jvmArgs, ...exportArgs, "-jar", jarPath];

    return {
      javaExecutable,
      javaVersion,
      spawn: () =>
        spawn(javaExecutable, args, {
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true
        })
    };
  }
}
