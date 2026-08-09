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
function activate(context) {
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