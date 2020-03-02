import * as vscode from "vscode";

export class CodelensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const topOfDocument = new vscode.Range(0, 0, 0, 0);
    const c: vscode.Command = {
      command: "extension.addConsoleLog",
      title: "Insert console.log"
    };
    const codeLens = new vscode.CodeLens(topOfDocument, c);

    const regexSrc = /(for\s*\(|while\s*\()/g;
    const regex = new RegExp(regexSrc);
    const text = document.getText();
    let matches;
    let codeLenses: vscode.CodeLens[] = [codeLens];

    while ((matches = regex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(matches.index).line);
      const indexOf = line.text.indexOf(matches[0]);
      const position = new vscode.Position(line.lineNumber, indexOf);
      const range = document.getWordRangeAtPosition(
        position,
        new RegExp(regexSrc)
      );
      if (range) {
        codeLenses = codeLenses.concat(new vscode.CodeLens(range, c));
      }
    }
    return codeLenses;
  }
}
