import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import * as path from "node:path";

export function configuredJavaExecutable(
  javaHome: string,
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string {
  const home = javaHome || environment.JAVA_HOME?.trim();
  if (home !== undefined && home.length > 0) {
    return path.join(home, "bin", platform === "win32" ? "java.exe" : "java");
  }
  return platform === "win32" ? "java.exe" : "java";
}

export async function validateJava(
  executable: string,
  timeoutMs = 5_000
): Promise<number> {
  if (path.isAbsolute(executable)) {
    try {
      await access(executable);
    } catch {
      throw new Error(`Java executable not found: ${executable}`);
    }
  }

  return new Promise<number>((resolve, reject) => {
    const child = spawn(executable, ["-version"], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out while checking Java executable: ${executable}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Cannot run Java executable '${executable}': ${error.message}`));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Java version check failed for '${executable}' (exit code ${String(code)}).`));
        return;
      }
      const match = /version "(?:1\.)?(\d+)/.exec(output);
      if (match?.[1] === undefined) {
        reject(new Error(`Cannot determine Java version from '${executable} -version'.`));
        return;
      }
      const major = Number.parseInt(match[1], 10);
      if (major < 17) {
        reject(new Error(`Java 17 or newer is required; '${executable}' reports Java ${major}.`));
        return;
      }
      resolve(major);
    });
  });
}
