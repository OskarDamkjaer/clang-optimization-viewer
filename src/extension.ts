import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { Remark, yaml2obj } from "./yaml2obj";

const compiler = "clang"; //"$HOME/thesis-llvm/build/bin/clang";
const flags = "-c -o /dev/null -O3 -foptimization-record-file=>(cat)";

async function gatherRemarks(input: Readable): Promise<Remark[]> {
  const rl = createInterface({ input });
  let currentRemark: string[] = [];
  let remarks: Remark[] = [];
  for await (const l of rl) {
    const line = l.trim();
    currentRemark.push(line);

    if (line === "...") {
      const remark = yaml2obj(currentRemark);
      remarks.push(remark);
      currentRemark = [];
    }
  }
  return remarks;
}

async function parseStream(
  input: Readable,
  collection: vscode.DiagnosticCollection
): Promise<void> {
  const documentUri = vscode.window.activeTextEditor!.document.uri;
  const diagnostics = (await gatherRemarks(input)).map(remark => {
    const { Line, Column } = remark.debugLoc! || { Line: 0, Column: 0 };
    const pos = new vscode.Position(
      Math.max(0, Line - 1),
      Math.max(0, Column - 1)
    );
    const range = new vscode.Range(pos, pos);
    const severity = {
      Passed: vscode.DiagnosticSeverity.Information,
      Analysis: vscode.DiagnosticSeverity.Hint,
      Missed: vscode.DiagnosticSeverity.Warning
    };

    return {
      code: "",
      message: `${remark.type}: ${remark.pass}`,
      range,
      severity: severity[remark.type],
      source: "",
      relatedInformation: [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(documentUri, range),
          remark.args.map(([_key, value]) => value).join(" ")
        )
      ]
    };
  });

  collection.set(documentUri, diagnostics);
}

export function activate(context: vscode.ExtensionContext) {
  const fileName = vscode.window.activeTextEditor?.document.fileName;
  if (!fileName) {
    vscode.window.showErrorMessage(
      "Make sure there's a file opened before running this command"
    );
  }

  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  let disposable = vscode.commands.registerCommand("extension.optInfo", () => {
    issues.clear();
    const clangPs = spawn(
      `${compiler} ${
        vscode.window.activeTextEditor!.document.fileName
      } ${flags}`,
      { shell: "bash" }
    );

    parseStream(clangPs.stdout, issues);

    clangPs.stderr.on("data", data => {
      vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
    });

    clangPs.on("close", code => {
      code !== 0 &&
        vscode.window.showErrorMessage(`Clang exited with code: ${code}`);
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
