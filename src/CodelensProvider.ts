import * as vscode from "vscode";

export class CodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const loopCommand: vscode.Command = {
      command: "extension.addLoopPragma",
      title: "loop"
    };

    const fnCommand: vscode.Command = {
      command: "extension.addFunctionPragma",
      title: "function"
    };
    const symbols = (await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      vscode.window.activeTextEditor?.document.uri
    )) as [vscode.DocumentSymbol];

    const fnLenses = symbols
      .filter(s => s.kind === vscode.SymbolKind.Function)
      .map(
        s =>
          new vscode.CodeLens(s.range, { ...fnCommand, arguments: [s.range] })
      );

    const regexSrc = /(for\s*\(|while\s*\()/g;
    const regex = new RegExp(regexSrc);
    const text = document.getText();
    let matches;
    let codeLenses: vscode.CodeLens[] = [...fnLenses];

    while ((matches = regex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(matches.index).line);
      const indexOf = line.text.indexOf(matches[0]);
      const position = new vscode.Position(line.lineNumber, indexOf);
      const range = document.getWordRangeAtPosition(
        position,
        new RegExp(regexSrc)
      );
      if (range) {
        codeLenses = codeLenses.concat(
          new vscode.CodeLens(range, { ...loopCommand, arguments: [range] })
        );
      }
    }
    return codeLenses;
  }
}
