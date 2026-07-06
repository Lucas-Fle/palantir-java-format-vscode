import * as vscode from "vscode";

export class Logger implements vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel("Palantir Java Format");

  public info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  public warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  public error(message: string): void {
    this.channel.appendLine(`[error] ${message}`);
  }

  public show(): void {
    this.channel.show(true);
  }

  public dispose(): void {
    this.channel.dispose();
  }
}
