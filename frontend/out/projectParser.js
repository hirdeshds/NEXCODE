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
exports.applyProjectStructure = applyProjectStructure;
const vscode = __importStar(require("vscode"));
async function applyProjectStructure(response, workspaceRoot) {
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
        }
        else {
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
    }
    else {
        vscode.window.showInformationMessage(`Successfully created ${filesCreated} files in your workspace.`);
    }
}
//# sourceMappingURL=projectParser.js.map