import * as vscode from "vscode";

const DEFAULT_BACKEND_URL = "https://nexcode-3n9e.onrender.com";

let extensionContext: vscode.ExtensionContext | undefined;

export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export async function getSecret(key: string): Promise<string | undefined> {
  if (!extensionContext) {
    return undefined;
  }
  return extensionContext.secrets.get(key);
}

export async function storeSecret(key: string, value: string | undefined): Promise<void> {
  if (!extensionContext) {
    return;
  }
  if (value === undefined) {
    await extensionContext.secrets.delete(key);
  } else {
    await extensionContext.secrets.store(key, value);
  }
}

export function getBackendUrl(): string {
  const configuredUrl = vscode.workspace
    .getConfiguration("nexcode")
    .get<string>("backendUrl", DEFAULT_BACKEND_URL);

  return configuredUrl.replace(/\/$/, "");
}

export function isInlineCompletionEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("nexcode")
    .get<boolean>("enableInlineCompletion", true);
}
