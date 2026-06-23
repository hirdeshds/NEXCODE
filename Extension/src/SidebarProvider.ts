import * as vscode from "vscode";

export class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
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
          if (!prompt) return;
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
            } else if (feature === "explain") {
              const { explainCode } = require("./apiClient");
              const result = await explainCode(prompt);
              webviewView.webview.postMessage({ type: "response", value: result });
            } else if (feature === "fix") {
              const { fixCode } = require("./apiClient");
              const result = await fixCode(prompt);
              webviewView.webview.postMessage({ type: "response", value: result });
            } else {
              const { generateCode } = require("./apiClient");
              const code = await generateCode(prompt);
              webviewView.webview.postMessage({ type: "response", value: code });
            }
          } catch (err: any) {
            webviewView.webview.postMessage({ type: "error", value: err.message });
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
          const items = ["Clear Chat", "Export Chat History", "Restart Backend Connection"];
          const choice = await vscode.window.showQuickPick(items, {
            placeHolder: "Select an action"
          });
          if (choice === "Clear Chat") {
            webviewView.webview.postMessage({ type: "clearChat" });
          } else if (choice === "Export Chat History") {
            webviewView.webview.postMessage({ type: "exportChat" });
          } else if (choice === "Restart Backend Connection") {
            vscode.window.showInformationMessage("Reconnecting to NexCode backend...");
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
            } else {
              vscode.window.showWarningMessage("No code selected in the editor. Select some code first.");
            }
          } else {
            vscode.window.showWarningMessage("No active editor found.");
          }
          break;
        }
        case "attachFile": {
          const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: "Attach File",
            filters: { "All Files": ["*"] }
          });
          if (fileUri && fileUri[0]) {
            const content = await vscode.workspace.fs.readFile(fileUri[0]);
            const text = Buffer.from(content).toString("utf8");
            const parts = fileUri[0].path.split("/");
            const fileName = parts[parts.length - 1] || "file";
            webviewView.webview.postMessage({ type: "attachedFile", value: text, fileName: fileName });
          }
          break;
        }
        case "exportChatData": {
          const doc = await vscode.workspace.openTextDocument({
            content: data.value,
            language: "markdown"
          });
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
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
      <span class="codicon codicon-check-all" id="btn-new-chat" title="New Chat"></span>
      <span class="codicon codicon-settings-gear" id="btn-settings" title="Settings"></span>
      <span class="codicon codicon-ellipsis" id="btn-more" title="More"></span>
      <span class="codicon codicon-screen-full" id="btn-expand" title="Expand"></span>
      <span class="codicon codicon-layout-sidebar-right" id="btn-move-panel" title="Move to Panel"></span>
    </div>
  </div>
  
  <div class="chat-container" id="chat-container">
    <div class="message assistant" id="welcome-message">
      <div class="bubble">Hello! Describe what you'd like to build.</div>
    </div>
    <div class="loader" id="loader">NexCode is thinking...</div>
  </div>

  <div class="input-area">
    <div id="add-context-btn" style="font-size: 11px; margin-bottom: 4px; display: flex; gap: 4px; align-items: center; color: var(--vscode-descriptionForeground); cursor: pointer;" title="Attach file as context">
      <span class="codicon codicon-add"></span>
      <span style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 4px; border-radius: 4px;">Context</span>
    </div>
    <div class="input-box">
      <textarea id="prompt-input" placeholder="Describe what to build... (Press Enter to send)"></textarea>
      <div class="input-actions">
        <div class="left-actions">
          <span class="codicon codicon-add" id="attach-btn" title="Attach File"></span>
          <span class="codicon codicon-code" id="insert-code-btn" title="Insert Selected Code"></span>
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
      if (message.type !== 'insertCode' && message.type !== 'attachedFile') {
        loader.style.display = 'none';
      }
      switch (message.type) {
        case 'response':
          appendMessage('assistant', message.value);
          break;
        case 'error':
          appendMessage('assistant', 'Error: ' + message.value);
          break;
        case 'insertCode':
          input.value += message.value;
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 200) + 'px';
          input.focus();
          break;
        case 'attachedFile':
          var prefix = input.value.trim() ? '\n' : '';
          input.value += prefix + '--- ' + message.fileName + ' ---\n' + message.value;
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 200) + 'px';
          input.focus();
          appendMessage('assistant', '📎 Attached: ' + message.fileName);
          break;
        case 'clearChat':
          var messages = chatContainer.querySelectorAll('.message');
          messages.forEach(function(m) { m.remove(); });
          var welcome = document.createElement('div');
          welcome.className = 'message assistant';
          var wb = document.createElement('div');
          wb.className = 'bubble';
          wb.textContent = "Hello! Describe what you'd like to build.";
          welcome.appendChild(wb);
          chatContainer.insertBefore(welcome, loader);
          break;
        case 'exportChat':
          var chatText = '';
          chatContainer.querySelectorAll('.message').forEach(function(m) {
            var role = m.classList.contains('user') ? 'You' : 'NexCode';
            var bubble = m.querySelector('.bubble');
            var text = bubble ? bubble.textContent : '';
            chatText += role + ': ' + text + '\n\n';
          });
          vscode.postMessage({ type: 'exportChatData', value: chatText });
          break;
      }
    });

    // Header action buttons
    document.getElementById('btn-new-chat').addEventListener('click', function() {
      vscode.postMessage({ type: 'newChat' });
    });

    document.getElementById('btn-settings').addEventListener('click', function() {
      vscode.postMessage({ type: 'openSettings' });
    });

    document.getElementById('btn-more').addEventListener('click', function() {
      vscode.postMessage({ type: 'moreOptions' });
    });

    document.getElementById('btn-expand').addEventListener('click', function() {
      vscode.postMessage({ type: 'expandView' });
    });

    document.getElementById('btn-move-panel').addEventListener('click', function() {
      vscode.postMessage({ type: 'moveToPanel' });
    });

    // Input area action buttons
    document.getElementById('add-context-btn').addEventListener('click', function() {
      vscode.postMessage({ type: 'attachFile' });
    });

    document.getElementById('attach-btn').addEventListener('click', function() {
      vscode.postMessage({ type: 'attachFile' });
    });

    document.getElementById('insert-code-btn').addEventListener('click', function() {
      vscode.postMessage({ type: 'insertCode' });
    });
  </script>
</body>
</html>`;
  }
}
