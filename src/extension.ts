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

function showRemarks(issues: vscode.DiagnosticCollection) {
  const fileName = vscode.window.activeTextEditor?.document.fileName;

  if (
    !fileName ||
    ![".c", ".cpp", ".cc", ".c++", ".cxx", ".cp"].some(ending =>
      fileName.toLowerCase().endsWith(ending)
    )
  ) {
    vscode.window.showErrorMessage(
      "Make sure there's a c or cpp file open when running this command"
    );
    return;
  }

  issues.clear();
  const clangPs = spawn(`${compiler} ${fileName} ${flags}`, {
    shell: "bash"
  });

  parseStream(clangPs.stdout, issues);
  clangPs.stderr.on("data", data => {
    vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
  });
  clangPs.on("close", code => {
    code !== 0 &&
      vscode.window.showErrorMessage(`Clang exited with code: ${code}`);
  });
}

function addCodeLens() {
  vscode.commands
    .executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      vscode.window.activeTextEditor?.document?.uri
    )
    .then(console.log);
}

export function activate(context: vscode.ExtensionContext) {
  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showRemarks", () =>
      showRemarks(issues)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.hideRemarks", () =>
      issues.clear()
    )
  );
  addCodeLens();
}
export function deactivate() {}
