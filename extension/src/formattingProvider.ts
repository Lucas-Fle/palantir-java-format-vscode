import * as vscode from "vscode";

import { readConfiguration } from "./configuration";

export interface DocumentFormatter {
  formatDocument(source: string): Promise<string>;
}

export class PalantirFormattingProvider implements vscode.DocumentFormattingEditProvider {
  public constructor(
    private readonly formatter: DocumentFormatter,
    private readonly reportError: (message: string) => void
  ) {}

  public async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    if (!readConfiguration().enabled || token.isCancellationRequested) {
      return [];
    }

    const source = document.getText();
    const requestedVersion = document.version;
    try {
      const formatted = await this.formatter.formatDocument(source);
      // CancellationToken changes asynchronously while the worker is formatting.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (token.isCancellationRequested || document.version !== requestedVersion) {
        return [];
      }
      if (formatted === source) {
        return [];
      }
      const end = document.positionAt(source.length);
      return [vscode.TextEdit.replace(new vscode.Range(new vscode.Position(0, 0), end), formatted)];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.reportError(`Palantir Java Format failed: ${message}`);
      return [];
    }
  }
}
