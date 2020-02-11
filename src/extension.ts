import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { yaml2obj } from "./yaml2obj";
const clangbin = "$HOME/thesis-llvm/build/bin/clang";
const flags = "-c -o /dev/null -O3 -foptimization-record-file=>(cat)";
const clang = "clang";

function parseStream(
  input: Readable,
  collection: vscode.DiagnosticCollection
): void {
  const rl = createInterface({ input });

  let currentRemark: string[] = [];

  rl.on("line", (l: string) => {
    const line = l.trim();
    currentRemark.push(line);

    if (line === "...") {
      const remark = yaml2obj(currentRemark);
      collection.set(vscode.window.activeTextEditor!.document.uri, [
        {
          code: "",
          message: `${remark.type}: ${remark.name} in ${remark.fn}`,
          range: new vscode.Range(
            new vscode.Position(1, 4),
            new vscode.Position(3, 10)
          ),
          severity: vscode.DiagnosticSeverity.Information,
          source: "opt-info",
          relatedInformation: []
        }
      ]);
      currentRemark = [];
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  let disposable = vscode.commands.registerCommand("extension.helloWorld", () =>
    // todo why are args split into list
    {
      const clangPs = spawn(
        `clang -c ${
          vscode.window.activeTextEditor!.document.fileName
        } -o /dev/null -O2 -foptimization-record-file=>(cat)`,
        { shell: "bash" }
      );
      parseStream(clangPs.stdout, issues);
      // TODO connect to next call here

      clangPs.stderr.on("data", data => {
        console.log(`stderr: ${data}`);
      });

      clangPs.on("close", code => {
        console.log(`child process exited with code ${code}`);
      });
    }
  );
  // clear info command

  /* 
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        if (editor.document) {
          updateDiagnostics(editor.document, issues);
        } else {
          issues.clear();
        }
      }
    })
  );
  */

  function updateDiagnostics(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection
  ): void {
    collection.set(document.uri, [
      {
        code: "",
        message: "cannot assign twice to immutable variable `x`",
        range: new vscode.Range(
          new vscode.Position(3, 4),
          new vscode.Position(3, 10)
        ),
        severity: vscode.DiagnosticSeverity.Information,
        source: "",
        relatedInformation: []
      }
    ]);
  }

  context.subscriptions.push(disposable);
}
//new vscode.Diagnostic(new vscode.Range(1, 1, 7, 7), "oops");

export function deactivate() {}
