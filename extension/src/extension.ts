import * as vscode from "vscode";

import { FORMATTER_VERSION } from "./constants";
import { PalantirFormattingProvider } from "./formattingProvider";
import { Logger } from "./logger";
import { WorkerManager } from "./workerManager";

let manager: WorkerManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  manager = new WorkerManager(context.extensionPath, logger);
  const provider = new PalantirFormattingProvider(manager, (message) => {
    logger.error(message);
    void vscode.window.showErrorMessage(message, "Show Output").then((selection) => {
      if (selection === "Show Output") {
        logger.show();
      }
    });
  });

  context.subscriptions.push(
    logger,
    manager,
    vscode.languages.registerDocumentFormattingEditProvider("java", provider),
    vscode.commands.registerCommand("palantirJavaFormat.restartWorker", async () => {
      try {
        await manager?.restart();
        void vscode.window.showInformationMessage("Palantir Java Format worker restarted.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(message);
        void vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("palantirJavaFormat.showOutput", () => logger.show()),
    vscode.commands.registerCommand("palantirJavaFormat.showVersion", () => {
      void vscode.window.showInformationMessage(
        `Bundled Palantir Java Format version: ${FORMATTER_VERSION}`
      );
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("palantirJavaFormat.javaHome") ||
        event.affectsConfiguration("palantirJavaFormat.jvmArgs")
      ) {
        logger.info("Java configuration changed; restarting worker.");
        void manager?.restart().catch((error: unknown) => {
          logger.error(error instanceof Error ? error.message : String(error));
        });
      }
    })
  );
  logger.info(`Bundled Palantir Java Format version: ${FORMATTER_VERSION}`);
}

export async function deactivate(): Promise<void> {
  await manager?.stop();
  manager = undefined;
}
