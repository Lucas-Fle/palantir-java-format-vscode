import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index");
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "pjf-vscode-"));

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        extensionDevelopmentPath,
        `--user-data-dir=${userDataDir}`,
        "--disable-extensions",
        "--skip-welcome",
        "--skip-release-notes"
      ]
    });
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
