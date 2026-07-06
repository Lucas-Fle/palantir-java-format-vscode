import * as vscode from "vscode";

export interface ExtensionConfiguration {
  enabled: boolean;
  javaHome: string;
  jvmArgs: readonly string[];
}

export function readConfiguration(): ExtensionConfiguration {
  const config = vscode.workspace.getConfiguration("palantirJavaFormat");
  return {
    enabled: config.get<boolean>("enabled", true),
    javaHome: config.get<string>("javaHome", "").trim(),
    jvmArgs: config.get<readonly string[]>("jvmArgs", [])
  };
}
