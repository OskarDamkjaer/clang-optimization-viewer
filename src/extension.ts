import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface, ReadLine } from "readline";
import { Readable } from "stream";
import { Remark, yaml2obj } from "./yaml2obj";
const clangbin = "$HOME/thesis-llvm/build/bin/clang";
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
  const diagnostics = (await gatherRemarks(input)).map(remark => {
    const { Line, Column } = remark.debugLoc! || { Line: 0, Column: 0 };
    const pos = new vscode.Position(
      Math.max(0, Line - 1),
      Math.max(0, Column - 1)
    );

    return {
      code: "",
      message: `${remark.pass} ${remark.type}: ${remark.name} in ${remark.fn}`,
      range: new vscode.Range(pos, pos),
      severity: vscode.DiagnosticSeverity.Information,
      source: "opt-info",
      relatedInformation: []
    };
  });

  collection.set(vscode.window.activeTextEditor!.document.uri, diagnostics);
}

export function activate(context: vscode.ExtensionContext) {
  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  let disposable = vscode.commands.registerCommand(
    "extension.helloWorld",
    () => {
      const clangPs = spawn(
        `clang -c ${
          vscode.window.activeTextEditor!.document.fileName
        } -o /dev/null -O3 -foptimization-record-file=>(cat)`,
        { shell: "bash" }
      );
      parseStream(clangPs.stdout, issues);

      clangPs.stderr.on("data", data => {
        console.log(`stderr: ${data}`);
      });

      clangPs.on("close", code => {
        code !== 0 && console.log(`child process exited with code ${code}`);
      });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
