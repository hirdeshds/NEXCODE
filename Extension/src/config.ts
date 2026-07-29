import * as vscode from "vscode";

const DEFAULT_BACKEND_URL = "https://nexcode-3n9e.onrender.com";

export function getBackendUrl(): string {
  const configuredUrl = vscode.workspace
    .getConfiguration("nexcode")
    .get<string>("backendUrl", DEFAULT_BACKEND_URL);

  return configuredUrl.replace(/\/$/, "");
}
