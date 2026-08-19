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
exports.SidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
const apiClient_1 = require("./apiClient");
const projectParser_1 = require("./projectParser");
const config_1 = require("./config");
// ── Chat helper ────────────────────────────────────────────────────────────
async function chatRespond(prompt) {
    const baseUrl = (0, config_1.getBackendUrl)();
    const url = new url_1.URL(`${baseUrl}/ai`);
    const body = JSON.stringify({ prompt, feature: "generate" });
    const client = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
        const req = client.request(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body).toString(),
            },
        }, (res) => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.code ?? parsed.explanation ?? parsed.review ?? data);
                }
                catch {
                    resolve(data);
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}
// ── Provider ───────────────────────────────────────────────────────────────
class SidebarProvider {
    _extensionUri;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value)
                        return;
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value)
                        return;
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
                case "generate": {
                    const prompt = data.value;
                    if (!prompt)
                        return;
                    const feature = data.feature || "chat";
                    try {
                        let result;
                        if (feature === "generate-project") {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (!workspaceFolders || workspaceFolders.length === 0) {
                                webviewView.webview.postMessage({
                                    type: "error",
                                    value: "Please open a workspace folder first to generate a project.",
                                });
                                break;
                            }
                            result = await (0, apiClient_1.completeCode)(prompt);
                            await (0, projectParser_1.applyProjectStructure)(result, workspaceFolders[0].uri);
                            webviewView.webview.postMessage({
                                type: "response",
                                value: "Project structure generated successfully! Check your workspace.",
                            });
                        }
                        else if (feature === "explain") {
                            result = await (0, apiClient_1.explainCode)(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else if (feature === "fix") {
                            result = await (0, apiClient_1.fixCode)(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else if (feature === "review") {
                            result = await (0, apiClient_1.reviewCode)(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else if (feature === "complete") {
                            result = await (0, apiClient_1.completeCode)(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else if (feature === "generate") {
                            result = await (0, apiClient_1.generateCode)(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else if (feature === "pipeline") {
                            // Pipeline scan: detect language from active editor
                            const editor = vscode.window.activeTextEditor;
                            const language = editor ? editor.document.languageId.toLowerCase() : "python";
                            const supportedLangs = new Set(["python", "javascript", "js", "ruby", "php"]);
                            if (!supportedLangs.has(language)) {
                                webviewView.webview.postMessage({
                                    type: "pipelineError",
                                    value: `Pipeline does not support \"${language}\" yet. Supported: Python, JavaScript, Ruby, PHP.`,
                                });
                                break;
                            }
                            // Notify UI that pipeline is starting
                            webviewView.webview.postMessage({ type: "pipelineStart", language });
                            const jobId = await (0, apiClient_1.startPipelineScan)(prompt, language);
                            // Poll for completion (max 60 × 5s = 5 min)
                            let pipelineResult;
                            for (let attempt = 0; attempt < 60; attempt++) {
                                const status = await (0, apiClient_1.getPipelineStatus)(jobId);
                                webviewView.webview.postMessage({
                                    type: "pipelineProgress",
                                    jobId,
                                    status: status.overall_status ?? "processing",
                                    attempt,
                                });
                                if (status.overall_status !== "processing") {
                                    pipelineResult = status;
                                    break;
                                }
                                await new Promise((r) => setTimeout(r, 5000));
                            }
                            webviewView.webview.postMessage({
                                type: "pipelineDone",
                                result: pipelineResult ?? { overall_status: "timeout", error: "Pipeline timed out after 5 minutes." },
                            });
                        }
                        else {
                            // "chat" — conversational response via /ai endpoint
                            result = await chatRespond(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                    }
                    catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        webviewView.webview.postMessage({ type: "error", value: errorMessage });
                        console.error("Generate error:", err);
                    }
                    break;
                }
                case "openSettings": {
                    vscode.commands.executeCommand("workbench.action.openSettings", "nexcode");
                    break;
                }
                case "newChat": {
                    webviewView.webview.postMessage({ type: "clearChat" });
                    break;
                }
                case "moreOptions": {
                    const items = [
                        "Clear Chat",
                        "Export Chat History",
                        "Configure Credentials",
                        "Restart Backend Connection",
                        "Check Backend Status",
                    ];
                    const choice = await vscode.window.showQuickPick(items, {
                        placeHolder: "Select an action",
                    });
                    if (choice === "Clear Chat") {
                        webviewView.webview.postMessage({ type: "clearChat" });
                    }
                    else if (choice === "Export Chat History") {
                        webviewView.webview.postMessage({ type: "exportChat" });
                    }
                    else if (choice === "Configure Credentials") {
                        vscode.commands.executeCommand("nexcode.configureCredentials");
                    }
                    else if (choice === "Restart Backend Connection") {
                        vscode.window.showInformationMessage("Reconnecting to NexCode backend...");
                    }
                    else if (choice === "Check Backend Status") {
                        const isHealthy = await (0, apiClient_1.checkHealth)();
                        webviewView.webview.postMessage({
                            type: "checkHealth",
                            status: isHealthy ? "ok" : "error",
                            message: isHealthy ? "Backend is online" : "Backend is offline",
                        });
                    }
                    break;
                }
                case "moveToPanel": {
                    vscode.commands.executeCommand("workbench.action.moveFocusedView");
                    break;
                }
                case "expandView": {
                    vscode.window.showInformationMessage("Drag the sidebar edge to resize the NexCode panel.");
                    break;
                }
                case "insertCode": {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const selection = editor.document.getText(editor.selection);
                        if (selection.trim()) {
                            webviewView.webview.postMessage({ type: "insertCode", value: selection });
                        }
                        else {
                            vscode.window.showWarningMessage("No code selected in the editor. Select some code first.");
                        }
                    }
                    else {
                        vscode.window.showWarningMessage("No active editor found.");
                    }
                    break;
                }
                case "attachFile": {
                    const fileUri = await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        openLabel: "Attach File",
                        filters: { "All Files": ["*"] },
                    });
                    if (fileUri && fileUri[0]) {
                        const content = await vscode.workspace.fs.readFile(fileUri[0]);
                        const text = Buffer.from(content).toString("utf8");
                        const parts = fileUri[0].path.split("/");
                        const fileName = parts[parts.length - 1] || "file";
                        webviewView.webview.postMessage({
                            type: "attachedFile",
                            value: text,
                            fileName,
                        });
                    }
                    break;
                }
                case "exportChatData": {
                    const doc = await vscode.workspace.openTextDocument({
                        content: data.value,
                        language: "markdown",
                    });
                    await vscode.window.showTextDocument(doc, { preview: false });
                    break;
                }
                case "applyCode": {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        await editor.edit((eb) => eb.replace(editor.selection, data.value));
                    }
                    else {
                        vscode.window.showWarningMessage("No active editor to insert code into.");
                    }
                    break;
                }
            }
        });
    }
    // ── HTML + CSS ─────────────────────────────────────────────────────────────
    _getHtmlForWebview() {
        const css = this._getCss();
        const js = this._getJs();
        return [
            "<!DOCTYPE html>",
            '<html lang="en">',
            "<head>",
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            "  <title>NexCode</title>",
            '  <link href="https://microsoft.github.io/vscode-codicons/dist/codicon.css" rel="stylesheet" />',
            "  <style>" + css + "</style>",
            "</head>",
            "<body>",
            this._getBodyHtml(),
            "  <script>" + js + "</script>",
            "</body>",
            "</html>",
        ].join("\n");
    }
    _getCss() {
        return `
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-sideBar-background);
      display: flex; flex-direction: column; height: 100vh; overflow: hidden;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--vscode-widget-border); flex-shrink: 0;
    }
    .header-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--vscode-foreground); }
    .actions { display: flex; gap: 4px; }
    .icon-button {
      appearance: none; background: transparent; border: none;
      color: var(--vscode-foreground); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 4px; font-size: 14px;
      transition: background-color 0.15s ease; padding: 0;
    }
    .icon-button:hover { background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08)); }
    .icon-button:focus-visible, .feature-selector:focus-visible, textarea:focus-visible {
      outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px;
    }
    .chat-container {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 10px; min-height: 0;
    }
    .message { display: flex; flex-direction: column; gap: 2px; animation: slideIn 0.2s ease-out; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .message.user  { align-items: flex-end; }
    .message.assistant { align-items: flex-start; }
    .bubble {
      padding: 9px 12px; border-radius: 6px; max-width: 92%;
      word-wrap: break-word; font-size: 13px; line-height: 1.55; overflow-wrap: break-word;
    }
    .message.user .bubble { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 8px 2px 8px 8px; }
    .message.assistant .bubble { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); color: var(--vscode-editor-foreground); border-radius: 2px 8px 8px 8px; }
    .bubble p { margin: 0 0 6px 0; } .bubble p:last-child { margin-bottom: 0; }
    .bubble ul, .bubble ol { margin: 4px 0 6px 0; padding-left: 18px; }
    .bubble li { margin-bottom: 2px; }
    .bubble strong { font-weight: 600; } .bubble em { font-style: italic; }
    .bubble h1,.bubble h2,.bubble h3 { font-size: 13px; font-weight: 700; margin: 8px 0 4px 0; }
    .bubble hr { border: none; border-top: 1px solid var(--vscode-widget-border); margin: 8px 0; }
    .bubble code {
      font-family: var(--vscode-editor-font-family, monospace); font-size: 12px;
      background: var(--vscode-textBlockQuote-background, rgba(0,0,0,0.2));
      padding: 1px 4px; border-radius: 3px;
    }
    .code-block-wrapper { position: relative; margin: 6px 0; }
    .code-block-header {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--vscode-editorGroupHeader-tabsBackground, rgba(0,0,0,0.3));
      border: 1px solid var(--vscode-widget-border); border-bottom: none;
      border-radius: 4px 4px 0 0; padding: 3px 10px; font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .code-block-header button {
      appearance: none; background: transparent; border: none; cursor: pointer;
      color: var(--vscode-descriptionForeground); font-size: 11px; padding: 2px 6px;
      border-radius: 3px; display: flex; align-items: center; gap: 3px;
    }
    .code-block-header button:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }
    .code-block-wrapper pre {
      margin: 0; padding: 10px 12px;
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.25));
      border: 1px solid var(--vscode-widget-border); border-radius: 0 0 4px 4px;
      overflow-x: auto; font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px; line-height: 1.45; white-space: pre;
    }
    .code-block-wrapper pre code { background: none; padding: 0; border-radius: 0; font-size: inherit; }
    .typing-bubble { display: flex; align-items: center; gap: 4px; padding: 10px 14px; }
    .typing-bubble span {
      display: inline-block; width: 6px; height: 6px;
      background: var(--vscode-descriptionForeground); border-radius: 50%;
      animation: bounce 1.2s infinite ease-in-out;
    }
    .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
    .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,80%,100% { transform:scale(0.7); opacity:0.4; } 40% { transform:scale(1); opacity:1; } }
    .input-area { padding: 10px 12px; border-top: 1px solid var(--vscode-widget-border); flex-shrink: 0; }
    .input-box {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; transition: border-color 0.15s;
    }
    .input-box:focus-within { border-color: var(--vscode-focusBorder); }
    .input-box textarea {
      width: 100%; background: transparent; border: none;
      color: var(--vscode-input-foreground); font-family: var(--vscode-font-family);
      font-size: 13px; resize: none; outline: none; min-height: 36px; max-height: 180px; overflow-y: auto; line-height: 1.45;
    }
    .input-actions { display: flex; justify-content: space-between; align-items: center; }
    .left-actions, .right-actions { display: flex; align-items: center; gap: 4px; }
    .feature-selector {
      cursor: pointer;
      background: var(--vscode-dropdown-background, var(--vscode-input-background));
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
      border-radius: 4px; padding: 2px 6px;
      color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
      font-size: 12px; font-family: var(--vscode-font-family); outline: none; height: 22px;
    }
    .feature-selector:focus { border-color: var(--vscode-focusBorder); }
    .attach-context-bar { display: flex; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; align-items: center; }
    .context-button {
      appearance: none; background: transparent; border: none;
      color: var(--vscode-descriptionForeground); cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px;
      border-radius: 4px; font-size: 11px; font-family: var(--vscode-font-family);
    }
    .context-button:hover { background: var(--vscode-toolbar-hoverBackground); }
    .context-pill {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
      border-radius: 10px; padding: 2px 8px; font-size: 11px;
    }
    .context-pill button {
      background: none; border: none; cursor: pointer; color: inherit;
      padding: 0; line-height: 1; display: flex; align-items: center; font-size: 10px;
    }
    .status-bar { display: flex; align-items: center; gap: 12px; font-size: 10px; margin-top: 6px; color: var(--vscode-descriptionForeground); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--vscode-terminal-ansiGreen, #4caf50); display: inline-block; margin-right: 2px; }
    .status-dot.offline { background: var(--vscode-errorForeground, #f44336); }
    /* ── Pipeline card styles ── */
    .pipeline-card { border: 1px solid var(--vscode-widget-border); border-radius: 6px; overflow: hidden; margin: 4px 0; font-size: 12px; }
    .pipeline-card-header { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: var(--vscode-editorGroupHeader-tabsBackground, rgba(0,0,0,0.2)); font-weight: 600; font-size: 12px; }
    .pipeline-card-header .pipeline-icon { font-size: 14px; }
    .pipeline-stage { display: flex; align-items: flex-start; gap: 8px; padding: 6px 12px; border-top: 1px solid var(--vscode-widget-border); }
    .pipeline-stage-badge { min-width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .badge-pass { background: var(--vscode-terminal-ansiGreen, #4caf50); color: #fff; }
    .badge-fail { background: var(--vscode-errorForeground, #f44336); color: #fff; }
    .badge-skip { background: var(--vscode-descriptionForeground); color: #fff; }
    .badge-spin { background: var(--vscode-button-background); color: var(--vscode-button-foreground); animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pipeline-stage-info { flex: 1; }
    .pipeline-stage-name { font-weight: 600; margin-bottom: 2px; }
    .pipeline-stage-detail { color: var(--vscode-descriptionForeground); font-size: 11px; white-space: pre-wrap; word-break: break-word; }
    .pipeline-pr-row { padding: 6px 12px; border-top: 1px solid var(--vscode-widget-border); display: flex; align-items: center; gap: 8px; }
    .pipeline-pr-link { color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer; font-size: 11px; }
    .pipeline-progress-bar { height: 3px; background: var(--vscode-widget-border); border-radius: 0; }
    .pipeline-progress-fill { height: 100%; background: var(--vscode-button-background); border-radius: 0; transition: width 0.4s ease; }
    `;
    }
    _getBodyHtml() {
        return `
  <div class="header">
    <div class="header-title">NEXCODE</div>
    <div class="actions">
      <button type="button" class="icon-button codicon codicon-comment-add" id="btn-new-chat" title="New Chat" aria-label="New Chat"></button>
      <button type="button" class="icon-button codicon codicon-settings-gear" id="btn-settings" title="Settings" aria-label="Settings"></button>
      <button type="button" class="icon-button codicon codicon-ellipsis" id="btn-more" title="More Actions" aria-label="More Actions"></button>
      <button type="button" class="icon-button codicon codicon-screen-full" id="btn-expand" title="Expand" aria-label="Expand View"></button>
      <button type="button" class="icon-button codicon codicon-layout-sidebar-right" id="btn-move-panel" title="Move to Panel" aria-label="Move to Panel"></button>
    </div>
  </div>

  <div class="chat-container" id="chat-container">
    <div class="message assistant" id="welcome-message">
      <div class="bubble">
        Hello! I am <strong>NexCode</strong> — your AI coding assistant.<br><br>
        Pick a mode from the dropdown and start typing:<br>
        <ul style="margin:6px 0 0 0;padding-left:16px;font-size:12px;">
          <li><strong>Chat</strong> — general AI assistant</li>
          <li><strong>Generate Code</strong> — create code from description</li>
          <li><strong>Generate Project</strong> — scaffold an entire project</li>
          <li><strong>Explain Code</strong> — understand any code</li>
          <li><strong>Fix Code</strong> — find and fix bugs</li>
          <li><strong>Review Code</strong> — get a detailed code review</li>
          <li><strong>Complete Code</strong> — auto-complete partial code</li>
          <li><strong>Pipeline Scan</strong> — 3-stage AI scan &amp; PR creation</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="input-area">
    <div class="attach-context-bar" id="attach-context-bar">
      <button type="button" id="add-context-btn" class="context-button" title="Attach file as context" aria-label="Attach file as context">
        <span class="codicon codicon-paperclip"></span>
        <span>Add Context</span>
      </button>
    </div>
    <div class="input-box" id="input-box">
      <textarea id="prompt-input" rows="1" placeholder="Ask NexCode anything... (Enter to send, Shift+Enter for newline)"></textarea>
      <div class="input-actions">
        <div class="left-actions">
          <button type="button" class="icon-button codicon codicon-code" id="insert-code-btn" title="Insert Selected Code" aria-label="Insert Selected Code"></button>
          <select class="feature-selector" id="feature-selector" title="Select Feature" aria-label="Select Feature">
            <option value="chat">Chat</option>
            <option value="generate">Generate Code</option>
            <option value="generate-project">Generate Project</option>
            <option value="explain"> Explain Code</option>
            <option value="fix"> Fix Code</option>
            <option value="review"> Review Code</option>
            <option value="complete"> Complete Code</option>
            <option value="pipeline"> Pipeline Scan</option>
          </select>
        </div>
        <div class="right-actions">
          <button type="button" class="icon-button codicon codicon-send" id="send-btn" title="Send (Enter)" aria-label="Send"></button>
        </div>
      </div>
    </div>
    <div class="status-bar">
      <span><span class="status-dot" id="status-dot"></span><span id="status-text">Connected</span></span>
    </div>
  </div>
`;
    }
    // ── JavaScript (returned as plain string, no template literals needed) ────
    _getJs() {
        // Use regular string concatenation to avoid TypeScript template-literal
        // conflicts with any backtick characters inside the webview JS.
        return [
            "const vscode = acquireVsCodeApi();",
            "const promptInput = document.getElementById('prompt-input');",
            "const sendBtn = document.getElementById('send-btn');",
            "const chatContainer = document.getElementById('chat-container');",
            "const featureSelector = document.getElementById('feature-selector');",
            "const statusDot = document.getElementById('status-dot');",
            "const statusText = document.getElementById('status-text');",
            "",
            "// Auto-resize textarea",
            "promptInput.addEventListener('input', function() {",
            "  promptInput.style.height = 'auto';",
            "  promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';",
            "});",
            "",
            "// HTML escape helper",
            "function escHtml(str) {",
            "  var d = document.createElement('div');",
            "  d.appendChild(document.createTextNode(str));",
            "  return d.innerHTML;",
            "}",
            "",
            "// Lightweight markdown renderer",
            "function renderMarkdown(text) {",
            "  if (!text || typeof text !== 'string') return '';",
            "",
            "  var codeBlocks = [];",
            "  // Use \\x60 as backtick to avoid TS template-literal conflicts",
            "  var BT = '\\x60';",
            "  var fence = new RegExp(BT+BT+BT+'([a-zA-Z0-9_+\\\\-]*)\\n?([\\\\s\\\\S]*?)'+BT+BT+BT, 'g');",
            "  var processed = text.replace(fence, function(_, lang, code) {",
            "    var idx = codeBlocks.length;",
            "    codeBlocks.push({ lang: (lang.trim() || 'code'), code: code.trimEnd() });",
            "    return '\\x00CODE' + idx + '\\x00';",
            "  });",
            "",
            "  var lines = processed.split('\\n');",
            "  var htmlLines = [];",
            "  var inList = null;",
            "  var listBuffer = [];",
            "",
            "  function flushList() {",
            "    if (listBuffer.length === 0) return;",
            "    htmlLines.push('<' + inList + '>' + listBuffer.join('') + '</' + inList + '>');",
            "    listBuffer = [];",
            "    inList = null;",
            "  }",
            "",
            "  function inlineFmt(line) {",
            "    return line",
            "      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')",
            "      .replace(/__(.+?)__/g, '<strong>$1</strong>')",
            "      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')",
            "      .replace(/_(.+?)_/g, '<em>$1</em>')",
            "      .replace(/\\x60([^\\x60]+)\\x60/g, function(_, c) { return '<code>' + escHtml(c) + '</code>'; });",
            "  }",
            "",
            "  for (var li = 0; li < lines.length; li++) {",
            "    var line = lines[li];",
            "    if (/^\\x00CODE\\d+\\x00$/.test(line.trim())) { flushList(); htmlLines.push(line); continue; }",
            "    var hm = line.match(/^(#{1,3})\\s+(.+)/);",
            "    if (hm) { flushList(); htmlLines.push('<h'+hm[1].length+'>'+escHtml(hm[2])+'</h'+hm[1].length+'>'); continue; }",
            "    if (/^---+$/.test(line.trim())) { flushList(); htmlLines.push('<hr>'); continue; }",
            "    var ulm = line.match(/^[*\\-]\\s+(.+)/);",
            "    if (ulm) { if (inList !== 'ul') { flushList(); inList = 'ul'; } listBuffer.push('<li>'+inlineFmt(escHtml(ulm[1]))+'</li>'); continue; }",
            "    var olm = line.match(/^\\d+\\.\\s+(.+)/);",
            "    if (olm) { if (inList !== 'ol') { flushList(); inList = 'ol'; } listBuffer.push('<li>'+inlineFmt(escHtml(olm[1]))+'</li>'); continue; }",
            "    flushList();",
            "    if (line.trim() === '') { htmlLines.push(''); } else { htmlLines.push('<p>'+inlineFmt(escHtml(line))+'</p>'); }",
            "  }",
            "  flushList();",
            "",
            "  var html = htmlLines.join('\\n').replace(/\\n{3,}/g, '\\n\\n');",
            "",
            "  html = html.replace(/\\x00CODE(\\d+)\\x00/g, function(_, idx) {",
            "    var block = codeBlocks[parseInt(idx, 10)];",
            "    var safeCode = escHtml(block.code);",
            "    var safeAttr = block.code.replace(/\"/g, '&quot;');",
            "    return '<div class=\"code-block-wrapper\">'",
            "         + '<div class=\"code-block-header\">'",
            "         + '<span>' + escHtml(block.lang) + '</span>'",
            "         + '<div style=\"display:flex;gap:4px;\">'",
            "         + '<button class=\"code-action-btn\" data-action=\"apply\" data-code=\"' + safeAttr + '\" title=\"Apply to editor\">'",
            "         + '<span class=\"codicon codicon-check\"></span> Apply</button>'",
            "         + '<button class=\"code-action-btn\" data-action=\"copy\" data-code=\"' + safeAttr + '\" title=\"Copy\">'",
            "         + '<span class=\"codicon codicon-copy\"></span> Copy</button>'",
            "         + '</div></div>'",
            "         + '<pre><code>' + safeCode + '</code></pre></div>';",
            "  });",
            "",
            "  return html;",
            "}",
            "",
            "// Append a message bubble",
            "function appendMessage(role, text) {",
            "  var msgDiv = document.createElement('div');",
            "  msgDiv.className = 'message ' + role;",
            "  var bubble = document.createElement('div');",
            "  bubble.className = 'bubble';",
            "  if (role === 'assistant') {",
            "    bubble.innerHTML = renderMarkdown(text);",
            "  } else {",
            "    bubble.style.whiteSpace = 'pre-wrap';",
            "    bubble.textContent = text || '';",
            "  }",
            "  msgDiv.appendChild(bubble);",
            "  chatContainer.appendChild(msgDiv);",
            "  chatContainer.scrollTop = chatContainer.scrollHeight;",
            "  return msgDiv;",
            "}",
            "",
            "// Typing indicator",
            "function showTyping() {",
            "  var msgDiv = document.createElement('div');",
            "  msgDiv.className = 'message assistant';",
            "  msgDiv.id = 'typing-indicator';",
            "  var bubble = document.createElement('div');",
            "  bubble.className = 'bubble typing-bubble';",
            "  bubble.innerHTML = '<span></span><span></span><span></span>';",
            "  msgDiv.appendChild(bubble);",
            "  chatContainer.appendChild(msgDiv);",
            "  chatContainer.scrollTop = chatContainer.scrollHeight;",
            "}",
            "function hideTyping() {",
            "  var el = document.getElementById('typing-indicator');",
            "  if (el) el.remove();",
            "}",
            "",
            "// Send message",
            "function sendMessage() {",
            "  var text = promptInput.value.trim();",
            "  if (!text) return;",
            "  var feature = featureSelector.value;",
            "  appendMessage('user', text);",
            "  promptInput.value = '';",
            "  promptInput.style.height = 'auto';",
            "  showTyping();",
            "  chatContainer.scrollTop = chatContainer.scrollHeight;",
            "  vscode.postMessage({ type: 'generate', value: text, feature: feature });",
            "}",
            "promptInput.addEventListener('keydown', function(e) {",
            "  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }",
            "});",
            "sendBtn.addEventListener('click', sendMessage);",
            "",
            "// Event delegation: handle code-block Copy/Apply + pill Remove",
            "chatContainer.addEventListener('click', function(e) {",
            "  var btn = e.target && e.target.closest ? e.target.closest('button[data-action]') : null;",
            "  if (!btn) return;",
            "  var action = btn.getAttribute('data-action');",
            "  var code = btn.getAttribute('data-code') || '';",
            "  if (action === 'copy') {",
            "    navigator.clipboard.writeText(code).then(function() {",
            "      var orig = btn.innerHTML;",
            "      btn.innerHTML = '<span class=\"codicon codicon-check\"></span> Copied!';",
            "      setTimeout(function() { btn.innerHTML = orig; }, 1500);",
            "    }).catch(function() {",
            "      var ta = document.createElement('textarea');",
            "      ta.value = code; document.body.appendChild(ta); ta.select();",
            "      document.execCommand('copy'); ta.remove();",
            "    });",
            "  } else if (action === 'apply') {",
            "    vscode.postMessage({ type: 'applyCode', value: code });",
            "  } else if (action === 'remove-pill') {",
            "    var pill = btn.closest('.context-pill');",
            "    if (pill) pill.remove();",
            "  }",
            "});",
            "",
            "// Add context pill",
            "function addContextPill(fileName) {",
            "  var bar = document.getElementById('attach-context-bar');",
            "  var pill = document.createElement('span');",
            "  pill.className = 'context-pill';",
            "  var icon = document.createElement('span');",
            "  icon.className = 'codicon codicon-file';",
            "  var name = document.createElement('span');",
            "  name.textContent = fileName;",
            "  var rmBtn = document.createElement('button');",
            "  rmBtn.title = 'Remove'; rmBtn.textContent = 'x';",
            "  rmBtn.setAttribute('data-action', 'remove-pill');",
            "  pill.appendChild(icon); pill.appendChild(name); pill.appendChild(rmBtn);",
            "  bar.appendChild(pill);",
            "}",
            "",
            "// ── Pipeline card renderer ──",
            "var _pipelineMsgEl = null;",
            "function renderPipelineCard(data) {",
            "  var r = data.result || {};",
            "  var status = r.overall_status || 'unknown';",
            "  var isPassed = status === 'passed';",
            "  var isTimeout = status === 'timeout';",
            "  var headerIcon = isPassed ? '\u2705' : isTimeout ? '\u23f1\ufe0f' : '\u274c';",
            "  var headerLabel = isPassed ? 'Pipeline Passed' : isTimeout ? 'Pipeline Timed Out' : 'Pipeline Failed (' + status + ')';",
            "  var stages = [",
            "    { key: 'stage1', name: 'Stage 1 — Basic Bug Check' },",
            "    { key: 'stage2', name: 'Stage 2 — Syntax & Keywords' },",
            "    { key: 'stage3', name: 'Stage 3 — Full Scan & Run' },",
            "  ];",
            "  var stagesHtml = '';",
            "  stages.forEach(function(s) {",
            "    var sd = r[s.key];",
            "    var badgeClass, badgeChar, detail;",
            "    if (!sd) { badgeClass = 'badge-skip'; badgeChar = '—'; detail = 'Not executed'; }",
            "    else if (sd.status === 'passed') { badgeClass = 'badge-pass'; badgeChar = '\u2713'; detail = sd.analysis || 'All checks passed.'; }",
            "    else { badgeClass = 'badge-fail'; badgeChar = '\u2717'; detail = sd.analysis || 'Check failed.'; }",
            "    stagesHtml += '<div class=\"pipeline-stage\">'",
            "      + '<div class=\"pipeline-stage-badge ' + badgeClass + '\">' + badgeChar + '</div>'",
            "      + '<div class=\"pipeline-stage-info\">'",
            "      + '<div class=\"pipeline-stage-name\">' + escHtml(s.name) + '</div>'",
            "      + '<div class=\"pipeline-stage-detail\">' + escHtml(detail) + '</div>'",
            "      + '</div></div>';",
            "  });",
            "  var prHtml = '';",
            "  if (r.pr && r.pr.pr_url) {",
            "    prHtml = '<div class=\"pipeline-pr-row\">'",
            "      + '<span>\ud83d\udd17 Pull Request:</span>'",
            "      + '<a class=\"pipeline-pr-link\" href=\"' + escHtml(r.pr.pr_url) + '\">' + escHtml(r.pr.pr_url) + '</a>'",
            "      + '</div>';",
            "  }",
            "  var errorHtml = '';",
            "  if (r.error) {",
            "    errorHtml = '<div class=\"pipeline-stage\"><div class=\"pipeline-stage-badge badge-fail\">!</div>'",
            "      + '<div class=\"pipeline-stage-info\"><div class=\"pipeline-stage-name\">Error</div>'",
            "      + '<div class=\"pipeline-stage-detail\">' + escHtml(r.error) + '</div></div></div>';",
            "  }",
            "  return '<div class=\"pipeline-card\">'",
            "    + '<div class=\"pipeline-card-header\"><span class=\"pipeline-icon\">' + headerIcon + '</span>' + escHtml(headerLabel) + '</div>'",
            "    + stagesHtml + errorHtml + prHtml",
            "    + '</div>';",
            "}",
            "",
            "// Messages from the extension host",
            "window.addEventListener('message', function(event) {",
            "  var message = event.data;",
            "  switch (message.type) {",
            "    case 'response': hideTyping(); appendMessage('assistant', message.value); break;",
            "    case 'error': hideTyping(); appendMessage('assistant', '\u274c Error: ' + message.value); break;",
            "    case 'pipelineStart': {",
            "      hideTyping();",
            "      var msgDiv = document.createElement('div');",
            "      msgDiv.className = 'message assistant';",
            "      msgDiv.id = 'pipeline-live-msg';",
            "      var bubble = document.createElement('div');",
            "      bubble.className = 'bubble';",
            "      bubble.innerHTML = '<strong>\ud83d\ude80 Pipeline Scan Started</strong><br><small>Language: ' + escHtml(message.language) + '</small>'",
            "        + '<div class=\"pipeline-progress-bar\"><div class=\"pipeline-progress-fill\" id=\"ppfill\" style=\"width:5%\"></div></div>'",
            "        + '<div id=\"pipeline-stage-status\" style=\"font-size:11px;margin-top:4px;color:var(--vscode-descriptionForeground)\">Submitting code to pipeline...</div>';",
            "      msgDiv.appendChild(bubble);",
            "      chatContainer.appendChild(msgDiv);",
            "      _pipelineMsgEl = msgDiv;",
            "      chatContainer.scrollTop = chatContainer.scrollHeight;",
            "      break;",
            "    }",
            "    case 'pipelineProgress': {",
            "      var fill = document.getElementById('ppfill');",
            "      var stageStatus = document.getElementById('pipeline-stage-status');",
            "      var progress = Math.min(5 + message.attempt * 8, 90);",
            "      if (fill) fill.style.width = progress + '%';",
            "      if (stageStatus) stageStatus.textContent = 'Status: ' + (message.status || 'processing') + ' (check #' + (message.attempt + 1) + ')';",
            "      break;",
            "    }",
            "    case 'pipelineDone': {",
            "      if (_pipelineMsgEl) { _pipelineMsgEl.remove(); _pipelineMsgEl = null; }",
            "      var msgDiv2 = document.createElement('div');",
            "      msgDiv2.className = 'message assistant';",
            "      var bubble2 = document.createElement('div');",
            "      bubble2.className = 'bubble';",
            "      bubble2.innerHTML = renderPipelineCard(message);",
            "      msgDiv2.appendChild(bubble2);",
            "      chatContainer.appendChild(msgDiv2);",
            "      chatContainer.scrollTop = chatContainer.scrollHeight;",
            "      break;",
            "    }",
            "    case 'pipelineError': {",
            "      hideTyping();",
            "      appendMessage('assistant', '\u274c Pipeline Error: ' + message.value);",
            "      break;",
            "    }",
            "    case 'checkHealth':",
            "      if (message.status === 'ok') {",
            "        statusDot.className = 'status-dot'; statusText.textContent = 'Backend online';",
            "        appendMessage('assistant', 'Backend is **online** and reachable.');",
            "      } else {",
            "        statusDot.className = 'status-dot offline'; statusText.textContent = 'Backend offline';",
            "        appendMessage('assistant', 'Backend is **offline**. Check the nexcode.backendUrl setting.');",
            "      }",
            "      break;",
            "    case 'insertCode':",
            "      promptInput.value += message.value;",
            "      promptInput.style.height = 'auto';",
            "      promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';",
            "      promptInput.focus();",
            "      break;",
            "    case 'attachedFile':",
            "      var prefix = promptInput.value.trim() ? '\\n\\n' : '';",
            "      promptInput.value += prefix + '--- ' + message.fileName + ' ---\\n' + message.value;",
            "      promptInput.style.height = 'auto';",
            "      promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';",
            "      promptInput.focus();",
            "      addContextPill(message.fileName);",
            "      appendMessage('assistant', 'Attached file: ' + message.fileName);",
            "      break;",
            "    case 'clearChat':",
            "      var msgs = chatContainer.querySelectorAll('.message:not(#welcome-message)');",
            "      msgs.forEach(function(m) { m.remove(); });",
            "      hideTyping();",
            "      _pipelineMsgEl = null;",
            "      if (!document.getElementById('welcome-message')) {",
            "        var wDiv = document.createElement('div');",
            "        wDiv.id = 'welcome-message'; wDiv.className = 'message assistant';",
            "        var wb = document.createElement('div');",
            "        wb.className = 'bubble';",
            "        wb.innerHTML = 'Hello! I am <strong>NexCode</strong> - your AI coding assistant.';",
            "        wDiv.appendChild(wb); chatContainer.insertBefore(wDiv, chatContainer.firstChild);",
            "      }",
            "      document.querySelectorAll('.context-pill').forEach(function(p) { p.remove(); });",
            "      break;",
            "    case 'exportChat':",
            "      var chatText = '';",
            "      chatContainer.querySelectorAll('.message').forEach(function(m) {",
            "        var role = m.classList.contains('user') ? 'You' : 'NexCode';",
            "        var bbl = m.querySelector('.bubble');",
            "        var txt = bbl ? (bbl.innerText || bbl.textContent || '') : '';",
            "        chatText += role + ':\\n' + txt + '\\n\\n';",
            "      });",
            "      vscode.postMessage({ type: 'exportChatData', value: chatText });",
            "      break;",
            "  }",
            "});",
            "",
            "// Map header buttons to message types",
            "var actionMap = {",
            "  'btn-new-chat':    'newChat',",
            "  'btn-settings':    'openSettings',",
            "  'btn-more':        'moreOptions',",
            "  'btn-expand':      'expandView',",
            "  'btn-move-panel':  'moveToPanel',",
            "  'add-context-btn': 'attachFile',",
            "  'insert-code-btn': 'insertCode'",
            "};",
            "Object.keys(actionMap).forEach(function(id) {",
            "  var el = document.getElementById(id);",
            "  if (!el) return;",
            "  var type = actionMap[id];",
            "  el.addEventListener('click', function() { vscode.postMessage({ type: type }); });",
            "  el.addEventListener('keydown', function(e) {",
            "    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }",
            "  });",
            "});",
            "",
            "// Dynamic placeholder based on selected feature",
            "var placeholderMap = {",
            "  'chat':             'Ask NexCode anything... (Enter to send, Shift+Enter for newline)',",
            "  'generate':         'Describe the code you want to generate...',",
            "  'generate-project': 'Describe the project to scaffold (e.g. \"a REST API with Flask + SQLite\")...',",
            "  'explain':          'Paste the code you want explained...',",
            "  'fix':              'Paste the buggy code to fix...',",
            "  'review':           'Paste the code you want reviewed...',",
            "  'complete':         'Paste partial code to auto-complete...',",
            "  'pipeline':         'Paste code to run through the 3-stage pipeline scan (Python / JS / Ruby / PHP)...',",
            "};",
            "featureSelector.addEventListener('change', function() {",
            "  var ph = placeholderMap[featureSelector.value] || placeholderMap['chat'];",
            "  promptInput.setAttribute('placeholder', ph);",
            "});"
        ].join("\n");
    }
}
exports.SidebarProvider = SidebarProvider;
//# sourceMappingURL=SidebarProvider.js.map