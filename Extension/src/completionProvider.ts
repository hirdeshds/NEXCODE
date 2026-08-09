import * as vscode from "vscode";
import { completeCode } from "./apiClient";
import { isInlineCompletionEnabled } from "./config";

const COMPLETION_DEBOUNCE_MS = 400;
const MAX_CONTEXT_LINES = 50;

function waitForDebounce(token: vscode.CancellationToken): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      disposable.dispose();
      resolve(!token.isCancellationRequested);
    }, COMPLETION_DEBOUNCE_MS);
    const disposable = token.onCancellationRequested(() => {
      clearTimeout(timer);
      disposable.dispose();
      resolve(false);
    });
  });
}

function getCompletionContext(document: vscode.TextDocument, position: vscode.Position): string {
  const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
  return prefix.split("\n").slice(-MAX_CONTEXT_LINES).join("\n");
}

export class NexCodeCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    if (!isInlineCompletionEnabled() || !(await waitForDebounce(token))) {
      return [];
    }

    const codeContext = getCompletionContext(document, position);

    if (!codeContext.trim() || token.isCancellationRequested) {
      return [];
    }

    try {
      const code = await completeCode(codeContext);
      if (token.isCancellationRequested) {
        return [];
      }
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
