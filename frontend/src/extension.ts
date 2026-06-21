import * as vscode from "vscode";
import { explainCode, fixCode, generateCode } from "./apiClient";
import { NexCodeActionProvider } from "./codeActions";
import { NexCodeCompletionProvider } from "./completionProvider";
import { showFixedCode, showMarkdownResult } from "./diffView";
import { NexCodeStatusBar } from "./statusBar";

function getSelectedOrFullText(): string | undefined {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage("Open a file before using NexCode.");
    return undefined;
  }

  const selectedText = editor.document.getText(editor.selection);
  const code = selectedText || editor.document.getText();

  if (!code.trim()) {
    vscode.window.showWarningMessage("No code found to send to NexCode.");
    return undefined;
  }

  return code;
}

async function runWithProgress<T>(title: string, task: () => Promise<T>): Promise<T | undefined> {
  try {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`NexCode failed: ${message}`);
    return undefined;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new NexCodeStatusBar();
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("nexcode.explainCode", async () => {
      const code = getSelectedOrFullText();
      if (!code) {
        return;
      }

      const explanation = await runWithProgress("NexCode is explaining your code...", () =>
        explainCode(code),
      );

      if (explanation) {
        await showMarkdownResult("NexCode Explanation", explanation);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nexcode.fixCode", async () => {
      const code = getSelectedOrFullText();
      if (!code) {
        return;
      }

      const fixedCode = await runWithProgress("NexCode is fixing your code...", () =>
        fixCode(code),
      );

      if (fixedCode) {
        await showFixedCode(code, fixedCode);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nexcode.generateCode", async () => {
      const prompt = await vscode.window.showInputBox({
        title: "NexCode Generate Code",
        prompt: "Describe the code you want to generate.",
      });

      if (!prompt) {
        return;
      }

      const code = await runWithProgress("NexCode is generating code...", () =>
        generateCode(prompt),
      );

      if (code) {
        const document = await vscode.workspace.openTextDocument({
          content: code,
          language: "plaintext",
        });
        await vscode.window.showTextDocument(document, { preview: false });
      }
    }),
  );



  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file" },
      new NexCodeActionProvider(),
      {
        providedCodeActionKinds: [
          vscode.CodeActionKind.QuickFix,
          vscode.CodeActionKind.RefactorRewrite,
        ],
      },
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { scheme: "file" },
      new NexCodeCompletionProvider(),
    ),
  );
}

export function deactivate(): void {}
