import * as vscode from "vscode";
import { generateCode } from "./apiClient";

export class NexCodeCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.InlineCompletionItem[]> {
    const line = document.lineAt(position.line).text.trim();

    if (!line.startsWith("// nexcode:") && !line.startsWith("# nexcode:")) {
      return [];
    }

    const prompt = line.replace(/^\/\/ nexcode:\s*/, "").replace(/^# nexcode:\s*/, "");

    if (!prompt) {
      return [];
    }

    const code = await generateCode(prompt);
    return [
      new vscode.InlineCompletionItem(
        code,
        new vscode.Range(position, position),
      ),
    ];
  }
}
