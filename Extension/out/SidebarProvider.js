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
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
                case "generate": {
                    const prompt = data.value;
                    if (!prompt)
                        return;
                    const feature = data.feature || "chat";
                    try {
                        if (feature === "generate-project") {
                            const { completeCode } = require("./apiClient");
                            const { applyProjectStructure } = require("./projectParser");
                            const workspaceFolders = require("vscode").workspace.workspaceFolders;
                            if (!workspaceFolders || workspaceFolders.length === 0) {
                                webviewView.webview.postMessage({ type: "error", value: "Please open a workspace folder first to generate a project." });
                                break;
                            }
                            const response = await completeCode(prompt);
                            await applyProjectStructure(response, workspaceFolders[0].uri);
                            webviewView.webview.postMessage({ type: "response", value: "Project structure generated successfully!" });
                        }
                        else if (feature === "explain") {
                            const { explainCode } = require("./apiClient");
                            const result = await explainCode(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else if (feature === "fix") {
                            const { fixCode } = require("./apiClient");
                            const result = await fixCode(prompt);
                            webviewView.webview.postMessage({ type: "response", value: result });
                        }
                        else {
                            const { generateCode } = require("./apiClient");
                            const code = await generateCode(prompt);
                            webviewView.webview.postMessage({ type: "response", value: code });
                        }
                    }
                    catch (err) {
                        webviewView.webview.postMessage({ type: "error", value: err.message });
                    }
                    break;
                }
            }
        });
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NexCode</title>
  <link href="https://microsoft.github.io/vscode-codicons/dist/codicon.css" rel="stylesheet" />
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-title {
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1px;
      color: var(--vscode-foreground);
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .actions span {
      cursor: pointer;
      font-size: 14px;
    }
    .actions span:hover {
      color: var(--vscode-foreground);
    }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .message.user {
      align-items: flex-end;
    }
    .message.user .bubble {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .message.assistant .bubble {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      color: var(--vscode-editor-foreground);
    }
    .bubble {
      padding: 8px 12px;
      border-radius: 6px;
      max-width: 90%;
      word-wrap: break-word;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .input-area {
      padding: 12px;
      border-top: 1px solid var(--vscode-widget-border);
    }
    .input-box {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .input-box textarea {
      width: 100%;
      background: transparent;
      border: none;
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      resize: none;
      outline: none;
      height: 40px;
      box-sizing: border-box;
    }
    .input-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .left-actions, .right-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .right-actions span {
      cursor: pointer;
    }
    .right-actions span:hover {
      color: var(--vscode-foreground);
    }
    .feature-selector {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      background: var(--vscode-dropdown-background, var(--vscode-input-background));
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
      border-radius: 4px;
      padding: 2px 6px;
      color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
      font-size: 12px;
      font-family: var(--vscode-font-family);
      outline: none;
    }
    .feature-selector:focus {
      border-color: var(--vscode-focusBorder);
    }
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      font-size: 10px;
      margin-top: 8px;
      color: var(--vscode-descriptionForeground);
    }
    .loader {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      display: none;
      padding: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">NEXCODE</div>
    <div class="actions">
      <span class="codicon codicon-check-all" title="Approve All"></span>
      <span class="codicon codicon-settings-gear" title="Settings"></span>
      <span class="codicon codicon-ellipsis" title="More"></span>
      <span class="codicon codicon-screen-full" title="Expand"></span>
      <span class="codicon codicon-layout-sidebar-right" title="Move to Panel"></span>
    </div>
  </div>
  
  <div class="chat-container" id="chat-container">
    <div class="message assistant" id="welcome-message">
      <div class="bubble">Hello! Describe what you'd like to build.</div>
    </div>
    <div class="loader" id="loader">NexCode is thinking...</div>
  </div>

  <div class="input-area">
    <div style="font-size: 11px; margin-bottom: 4px; display: flex; gap: 4px; align-items: center; color: var(--vscode-descriptionForeground);">
      <span class="codicon codicon-add"></span>
      <span style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 4px; border-radius: 4px;">Context</span>
    </div>
    <div class="input-box">
      <textarea id="prompt-input" placeholder="Describe what to build... (Press Enter to send)"></textarea>
      <div class="input-actions">
        <div class="left-actions">
          <span class="codicon codicon-add" title="Attach"></span>
          <span class="codicon codicon-code" title="Insert Code"></span>
          <select class="feature-selector" id="feature-selector" title="Select Feature">
            <option value="chat">Chat</option>
            <option value="generate">Generate Code</option>
            <option value="generate-project">Generate Project</option>
            <option value="explain">Explain Code</option>
            <option value="fix">Fix Code</option>
          </select>
        </div>
        <div class="right-actions">
          <span class="codicon codicon-send" id="send-btn" title="Send (Enter)"></span>
        </div>
      </div>
    </div>
    <div class="status-bar">
      <span><span class="codicon codicon-device-desktop"></span> Local</span>
      <span><span class="codicon codicon-shield"></span> Default Approvals</span>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const chatContainer = document.getElementById('chat-container');
    const loader = document.getElementById('loader');
    const featureSelector = document.getElementById('feature-selector');

    function appendMessage(role, text) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message ' + role;
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;
      msgDiv.appendChild(bubble);
      chatContainer.insertBefore(msgDiv, loader);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      const feature = featureSelector.value;
      appendMessage('user', text);
      input.value = '';
      loader.style.display = 'block';
      chatContainer.scrollTop = chatContainer.scrollHeight;

      vscode.postMessage({ type: 'generate', value: text, feature: feature });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    window.addEventListener('message', event => {
      const message = event.data;
      loader.style.display = 'none';
      switch (message.type) {
        case 'response':
          appendMessage('assistant', message.value);
          break;
        case 'error':
          appendMessage('assistant', 'Error: ' + message.value);
          break;
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.SidebarProvider = SidebarProvider;
//# sourceMappingURL=SidebarProvider.js.map