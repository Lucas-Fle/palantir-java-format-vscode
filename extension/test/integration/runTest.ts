import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index");
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      extensionDevelopmentPath,
      "--disable-extensions",
      "--skip-welcome",
      "--skip-release-notes"
    ]
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
