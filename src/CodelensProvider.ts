import * as vscode from "vscode";

export class CodelensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
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
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      vscode.window.activeTextEditor?.document?.uri
    );
    this.codeLenses = [];
    //const regex = new RegExp(/(for\()|(while\()/g);
    const regex = new RegExp(/for/g);
    const text = document.getText();
    const noWhiteSpace = text.replace(/\s/g, "");

    let matches;
    while ((matches = regex.exec(text)) !== null) {
      let line = document.lineAt(document.positionAt(matches.index).line);
      let indexOf = line.text.indexOf(matches[0]);
      let position = new vscode.Position(line.lineNumber, indexOf);
      let range = document.getWordRangeAtPosition(position, regex);
      if (range) {
        this.codeLenses.push(new vscode.CodeLens(range));
      }
    }
    return this.codeLenses;
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    codeLens.command = {
      title: "Codelens provided by sample extension",
      tooltip: "Tooltip provided by sample extension",
      command: "codelens-sample.codelensAction",
      arguments: ["Argument 1", false]
    };

    return codeLens;
  }
}
