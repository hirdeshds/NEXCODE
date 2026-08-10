import * as vscode from "vscode";
import {
  explainCode,
  fixCode,
  generateCode,
  completeCode,
  reviewCode,
  getPipelineStatus,
  startPipelineScan,
  PipelineResult,
} from "./apiClient";
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

function getPipelineLanguage(document: vscode.TextDocument): string | undefined {
  const language = document.languageId.toLowerCase();
  const supportedLanguages = new Set(["python", "javascript", "js", "ruby", "php"]);

  if (!supportedLanguages.has(language)) {
    vscode.window.showWarningMessage(
      `NexCode pipeline does not support the ${document.languageId} language yet.`,
    );
    return undefined;
  }

  return language;
}

function formatPipelineResult(result: PipelineResult): string {
  return `# NexCode Pipeline Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}

async function waitForPipeline(jobId: string): Promise<PipelineResult> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await getPipelineStatus(jobId);
    if (result.overall_status !== "processing") {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("The pipeline did not finish within five minutes.");
}

function notifyPipelineResult(result: PipelineResult): void {
  const status = result.overall_status ?? "unknown";
  const prUrl = result.pr?.pr_url;

  if (status === "passed") {
    const message = prUrl
      ? `NexCode pipeline passed. Pull request: ${prUrl}`
      : "NexCode pipeline passed all stages.";
    vscode.window.showInformationMessage(message);
    return;
  }

  const failedStage = status.match(/^failed_(stage[1-3])/i)?.[1];
  const detail = failedStage ? ` at ${failedStage}` : "";
  vscode.window.showWarningMessage(`NexCode pipeline finished${detail} with status: ${status}.`);
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
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("Open a file before generating code.");
          return;
        }

        await editor.edit((editBuilder) => {
          editBuilder.replace(editor.selection, code);
        });
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
    vscode.commands.registerCommand("nexcode.runPipeline", async () => {
      const editor = vscode.window.activeTextEditor;
      const code = getSelectedOrFullText();
      if (!editor || !code) {
        return;
      }

      const language = getPipelineLanguage(editor.document);
      if (!language) {
        return;
      }

      const result = await runWithProgress("NexCode is scanning your code...", async () => {
        const jobId = await startPipelineScan(code, language);
        return waitForPipeline(jobId);
      });

      if (result) {
        notifyPipelineResult(result);
        await showMarkdownResult("NexCode Pipeline Result", formatPipelineResult(result));
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
