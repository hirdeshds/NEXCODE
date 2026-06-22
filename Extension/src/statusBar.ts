import * as vscode from "vscode";
import { checkHealth } from "./apiClient";

export class NexCodeStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "nexcode.explainCode";
    this.item.text = "$(sparkle) NexCode";
    this.item.tooltip = "Run NexCode on the selected code";
  }

  show(): void {
    this.item.show();
    void this.refresh();
  }

  dispose(): void {
    this.item.dispose();
  }

  async refresh(): Promise<void> {
    const isHealthy = await checkHealth();
    this.item.text = isHealthy ? "$(sparkle) NexCode" : "$(warning) NexCode";
    this.item.tooltip = isHealthy
      ? "NexCode backend is connected"
      : "NexCode backend is not reachable";
  }
}
