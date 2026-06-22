import * as vscode from "vscode";

export class NexCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(): vscode.CodeAction[] {
    const explainAction = new vscode.CodeAction(
      "NexCode: Explain Code",
      vscode.CodeActionKind.QuickFix,
    );
    explainAction.command = {
      command: "nexcode.explainCode",
      title: "Explain Code",
    };

    const fixAction = new vscode.CodeAction("NexCode: Fix Code", vscode.CodeActionKind.QuickFix);
    fixAction.command = {
      command: "nexcode.fixCode",
      title: "Fix Code",
    };

    return [explainAction, fixAction];
  }
}
