# Change Log

## 0.0.2

- Fixed sidebar UI buttons (New Chat, Settings, More, Expand, Move to Panel) not responding to clicks.
- Fixed Copy and Apply buttons on code blocks silently failing due to VS Code webview CSP blocking inline `onclick` handlers — replaced with delegated event listeners.
- Fixed auto-triggered QuickPick dialog opening every time the sidebar loaded.
- Added markdown rendering in chat bubbles with syntax-highlighted code blocks, copy and apply-to-editor actions.
- Chat mode now routes through the `/ai` endpoint for proper conversational responses.
- Fixed new-chat icon (was incorrectly showing a checkmark).
- Clicking the status bar now opens the NexCode sidebar instead of running Explain Code.
- Fixed diff view to preserve the active file's language for syntax highlighting.

## 0.0.1

- Added NexCode VS Code commands for explaining, fixing, generating, and reviewing code.
- Added configurable backend URL support.
