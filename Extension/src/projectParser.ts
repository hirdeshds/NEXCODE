import * as vscode from "vscode";

export async function applyProjectStructure(response: string, workspaceRoot: vscode.Uri): Promise<void> {
  const regex = /<file\s+path="([^"]+)">\s*([\s\S]*?)<\/file>/gi;
  let match;
  let filesCreated = 0;

  while ((match = regex.exec(response)) !== null) {
    const filePath = match[1];
    let fileContent = match[2];

    // If the LLM wraps the content in markdown code blocks inside the file tag, strip it.
    if (fileContent.trim().startsWith("\`\`\`")) {
      fileContent = fileContent.trim().replace(/^\`\`\`[a-zA-Z]*\n/, "");
      fileContent = fileContent.replace(/\`\`\`\s*$/, "");
    } else {
      fileContent = fileContent.trimEnd(); // Just clean trailing spaces
    }

    const absoluteUri = vscode.Uri.joinPath(workspaceRoot, filePath);

    // Ensure the parent directory exists
    if (filePath.includes('/')) {
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      const dirUri = vscode.Uri.joinPath(workspaceRoot, dirPath);
      await vscode.workspace.fs.createDirectory(dirUri);
    }

    const data = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(absoluteUri, data);
    filesCreated++;
  }

  if (filesCreated === 0) {
    vscode.window.showWarningMessage("No valid <file> tags were found in the response.");
  } else {
    vscode.window.showInformationMessage(`Successfully created ${filesCreated} files in your workspace.`);
  }
}
