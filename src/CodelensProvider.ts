import * as vscode from "vscode";

export class CodelensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<
    void
  > = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(_ => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (
      vscode.workspace
        .getConfiguration("codelens-sample")
        .get("enableCodeLens", true)
    ) {
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
          codeLenses = codeLenses.concat(new vscode.CodeLens(range));
        }
      }
      return codeLenses;
    }
    return [];
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    _token: vscode.CancellationToken
  ) {
    if (
      vscode.workspace
        .getConfiguration("codelens-sample")
        .get("enableCodeLens", true)
    ) {
      codeLens.command = {
        title: "Codelens provided by sample extension",
        tooltip: "Tooltip provided by sample extension",
        command: "codelens-sample.codelensAction",
        arguments: ["Argument 1", false]
      };
      return codeLens;
    }
    return null;
  }
}
