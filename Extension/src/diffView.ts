import * as vscode from "vscode";

export async function showMarkdownResult(title: string, content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: "markdown",
  });

  await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
  });
}

export async function showFixedCode(originalCode: string, fixedCode: string): Promise<void> {
  const originalDocument = await vscode.workspace.openTextDocument({
    content: originalCode,
    language: "plaintext",
  });

  const fixedDocument = await vscode.workspace.openTextDocument({
    content: fixedCode,
    language: "plaintext",
  });

  await vscode.commands.executeCommand(
    "vscode.diff",
    originalDocument.uri,
    fixedDocument.uri,
    "NexCode Fix Preview",
  );
}
