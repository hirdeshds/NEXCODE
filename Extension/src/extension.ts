import * as vscode from "vscode";
import { explainCode, fixCode, generateCode, completeCode, reviewCode } from "./apiClient";
import { NexCodeActionProvider } from "./codeActions";
import { NexCodeCompletionProvider } from "./completionProvider";
import { showFixedCode, showMarkdownResult } from "./diffView";
import { NexCodeStatusBar } from "./statusBar";
import { SidebarProvider } from "./SidebarProvider";
import { applyProjectStructure } from "./projectParser";

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

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "nexcode-sidebar-view",
      sidebarProvider
    )
  );

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
    vscode.commands.registerCommand("nexcode.reviewCode", async () => {
      const code = getSelectedOrFullText();
      if (!code) {
        return;
      }

      const review = await runWithProgress("NexCode is reviewing your code...", () =>
        reviewCode(code),
      );

      if (review) {
        await showMarkdownResult("NexCode Code Review", review);
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
    vscode.commands.registerCommand("nexcode.generateProject", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage("Please open a workspace folder first to generate a project.");
        return;
      }

      const prompt = await vscode.window.showInputBox({
        title: "NexCode Generate Project",
        prompt: "Describe the complete project you want to build.",
      });

      if (!prompt) {
        return;
      }

      const response = await runWithProgress("NexCode is building your project structure...", () =>
        completeCode(prompt),
      );

      if (response) {
        const workspaceRoot = workspaceFolders[0].uri;
        await applyProjectStructure(response, workspaceRoot);
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
