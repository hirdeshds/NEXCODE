import * as vscode from "vscode";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export function getBackendUrl(): string {
  const configuredUrl = vscode.workspace
    .getConfiguration("nexcode")
    .get<string>("backendUrl", DEFAULT_BACKEND_URL);

  return configuredUrl.replace(/\/$/, "");
}
