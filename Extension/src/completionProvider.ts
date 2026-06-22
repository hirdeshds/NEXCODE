import * as vscode from "vscode";
import { completeCode } from "./apiClient";

export class NexCodeCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.InlineCompletionItem[]> {
    // Provide ghost text completion using the text before the cursor
    const codeContext = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );

    if (!codeContext.trim()) {
      return [];
    }

    try {
      const code = await completeCode(codeContext);
      return [
        new vscode.InlineCompletionItem(
          code,
          new vscode.Range(position, position),
        ),
      ];
    } catch {
      return [];
    }
  }
}
