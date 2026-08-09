import * as vscode from "vscode";
import * as path from "path";

function getSafeRelativePath(filePath: string, workspaceRoot: vscode.Uri): string | undefined {
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!normalized || path.posix.isAbsolute(normalized)) {
    return undefined;
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return undefined;
  }

  const absolutePath = path.resolve(workspaceRoot.fsPath, ...segments);
  const relativePath = path.relative(workspaceRoot.fsPath, absolutePath);
  if (!relativePath || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    return undefined;
  }

  return normalized;
}

export async function applyProjectStructure(response: string, workspaceRoot: vscode.Uri): Promise<void> {
  const regex = /<file\s+path="([^"]+)">\s*([\s\S]*?)<\/file>/gi;
  let match;
  let filesCreated = 0;
  let invalidFiles = 0;
  const filePaths = new Set<string>();

  while ((match = regex.exec(response)) !== null) {
    const filePath = getSafeRelativePath(match[1], workspaceRoot);
    if (!filePath || filePaths.has(filePath)) {
      invalidFiles++;
      continue;
    }
    filePaths.add(filePath);
    let fileContent = match[2];

    // If the LLM wraps the content in markdown code blocks inside the file tag, strip it.
    if (fileContent.trim().startsWith("\`\`\`")) {
      fileContent = fileContent.trim().replace(/^\`\`\`[a-zA-Z]*\n/, "");
      fileContent = fileContent.replace(/\`\`\`\s*$/, "");
    } else {
      fileContent = fileContent.trimEnd(); // Just clean trailing spaces
    }

    const absoluteUri = vscode.Uri.joinPath(workspaceRoot, ...filePath.split("/"));

    // Ensure the parent directory exists
    if (filePath.includes('/')) {
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      const dirUri = vscode.Uri.joinPath(workspaceRoot, ...dirPath.split("/"));
      await vscode.workspace.fs.createDirectory(dirUri);
    }

    const data = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(absoluteUri, data);
    filesCreated++;
  }

  if (filesCreated === 0 || invalidFiles > 0) {
    vscode.window.showWarningMessage(
      filesCreated === 0
        ? "No valid project files were found in the response."
        : `Created ${filesCreated} files; rejected ${invalidFiles} invalid or duplicate paths.`,
    );
  } else {
    vscode.window.showInformationMessage(`Successfully created ${filesCreated} files in your workspace.`);
  }
}
