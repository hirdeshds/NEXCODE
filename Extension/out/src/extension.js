"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
const codeActions_1 = require("./codeActions");
const completionProvider_1 = require("./completionProvider");
const diffView_1 = require("./diffView");
const statusBar_1 = require("./statusBar");
const SidebarProvider_1 = require("./SidebarProvider");
const projectParser_1 = require("./projectParser");
const config_1 = require("./config");
function getSelectedOrFullText() {
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
async function runWithProgress(title, task) {
    try {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
        }, task);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`NexCode failed: ${message}`);
        return undefined;
    }
}
function getPipelineLanguage(document) {
    const language = document.languageId.toLowerCase();
    const supportedLanguages = new Set(["python", "javascript", "js", "ruby", "php"]);
    if (!supportedLanguages.has(language)) {
        vscode.window.showWarningMessage(`NexCode pipeline does not support the ${document.languageId} language yet.`);
        return undefined;
    }
    return language;
}
function formatPipelineResult(result) {
    return `# NexCode Pipeline Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}
async function waitForPipeline(jobId) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const result = await (0, apiClient_1.getPipelineStatus)(jobId);
        if (result.overall_status !== "processing") {
            return result;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error("The pipeline did not finish within five minutes.");
}
function notifyPipelineResult(result) {
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
function activate(context) {
    (0, config_1.setExtensionContext)(context);
    const statusBar = new statusBar_1.NexCodeStatusBar();
    statusBar.show();
    context.subscriptions.push(statusBar);
    const sidebarProvider = new SidebarProvider_1.SidebarProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("nexcode-sidebar-view", sidebarProvider));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.explainCode", async () => {
        const code = getSelectedOrFullText();
        if (!code) {
            return;
        }
        const explanation = await runWithProgress("NexCode is explaining your code...", () => (0, apiClient_1.explainCode)(code));
        if (explanation) {
            await (0, diffView_1.showMarkdownResult)("NexCode Explanation", explanation);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.fixCode", async () => {
        const code = getSelectedOrFullText();
        if (!code) {
            return;
        }
        const fixedCode = await runWithProgress("NexCode is fixing your code...", () => (0, apiClient_1.fixCode)(code));
        if (fixedCode) {
            await (0, diffView_1.showFixedCode)(code, fixedCode);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.reviewCode", async () => {
        const code = getSelectedOrFullText();
        if (!code) {
            return;
        }
        const review = await runWithProgress("NexCode is reviewing your code...", () => (0, apiClient_1.reviewCode)(code));
        if (review) {
            await (0, diffView_1.showMarkdownResult)("NexCode Code Review", review);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.generateCode", async () => {
        const prompt = await vscode.window.showInputBox({
            title: "NexCode Generate Code",
            prompt: "Describe the code you want to generate.",
        });
        if (!prompt) {
            return;
        }
        const code = await runWithProgress("NexCode is generating code...", () => (0, apiClient_1.generateCode)(prompt));
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
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.generateProject", async () => {
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
        const response = await runWithProgress("NexCode is building your project structure...", () => (0, apiClient_1.completeCode)(prompt));
        if (response) {
            const workspaceRoot = workspaceFolders[0].uri;
            await (0, projectParser_1.applyProjectStructure)(response, workspaceRoot);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.runPipeline", async () => {
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
            const jobId = await (0, apiClient_1.startPipelineScan)(code, language);
            return waitForPipeline(jobId);
        });
        if (result) {
            notifyPipelineResult(result);
            await (0, diffView_1.showMarkdownResult)("NexCode Pipeline Result", formatPipelineResult(result));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.deployToVercel", async () => {
        const result = await runWithProgress("NexCode is deploying to Vercel...", async () => {
            return (0, apiClient_1.deployToVercel)();
        });
        if (result) {
            vscode.window.showInformationMessage(`Vercel Deployment started! URL: ${result.deployment_url} (ID: ${result.deployment_id})`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("nexcode.configureCredentials", async () => {
        const githubToken = await vscode.window.showInputBox({
            title: "NexCode: GitHub Personal Access Token",
            prompt: "Enter your GitHub PAT (leave empty to keep current or clear)",
            password: true,
        });
        if (githubToken !== undefined) {
            await (0, config_1.storeSecret)("nexcode.githubToken", githubToken || undefined);
            vscode.window.showInformationMessage("GitHub Token updated.");
        }
        const githubRepo = await vscode.window.showInputBox({
            title: "NexCode: GitHub Repository",
            prompt: "Enter repo in 'owner/repo' format (leave empty to keep current or clear)",
        });
        if (githubRepo !== undefined) {
            await (0, config_1.storeSecret)("nexcode.githubRepo", githubRepo || undefined);
            vscode.window.showInformationMessage("GitHub Repo updated.");
        }
        const vercelToken = await vscode.window.showInputBox({
            title: "NexCode: Vercel Access Token",
            prompt: "Enter Vercel token (leave empty to keep current or clear)",
            password: true,
        });
        if (vercelToken !== undefined) {
            await (0, config_1.storeSecret)("nexcode.vercelToken", vercelToken || undefined);
            vscode.window.showInformationMessage("Vercel Token updated.");
        }
        const vercelProjectId = await vscode.window.showInputBox({
            title: "NexCode: Vercel Project ID",
            prompt: "Enter Vercel project ID (leave empty to keep current or clear)",
        });
        if (vercelProjectId !== undefined) {
            await (0, config_1.storeSecret)("nexcode.vercelProjectId", vercelProjectId || undefined);
            vscode.window.showInformationMessage("Vercel Project ID updated.");
        }
        const vercelTeamId = await vscode.window.showInputBox({
            title: "NexCode: Vercel Team ID",
            prompt: "Enter Vercel team ID if applicable (leave empty to keep current or clear)",
        });
        if (vercelTeamId !== undefined) {
            await (0, config_1.storeSecret)("nexcode.vercelTeamId", vercelTeamId || undefined);
            vscode.window.showInformationMessage("Vercel Team ID updated.");
        }
        vscode.window.showInformationMessage("NexCode credentials configuration completed.");
    }));
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: "file" }, new codeActions_1.NexCodeActionProvider(), {
        providedCodeActionKinds: [
            vscode.CodeActionKind.QuickFix,
            vscode.CodeActionKind.RefactorRewrite,
        ],
    }));
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ scheme: "file" }, new completionProvider_1.NexCodeCompletionProvider()));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map