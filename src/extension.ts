import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { yaml2obj } from "./yaml2obj";
const clangbin = "$HOME/thesis-llvm/build/bin/clang";
const flags = "-c -o /dev/null -O3 -foptimization-record-file=>(cat)";
const clang = "clang";

async function parseStream(
  input: Readable,
  collection: vscode.DiagnosticCollection
): Promise<void> {
  const rl = createInterface({ input });

  let currentRemark: string[] = [];

  for await (const l of rl) {
    //rl.on("line", (l: string) => { // quicker but no errors
    const line = l.trim();
    currentRemark.push(line);

    if (line === "...") {
      const remark = yaml2obj(currentRemark);
      // if Filename stops being active file quit and clear
      const { Line, Column } = remark.debugLoc || { Line: 0, Column: 0 };
      const pos = new vscode.Position(
        Math.max(0, Line - 1),
        Math.max(0, Column - 1)
      );

      const newDia = {
        code: "",
        message: `${remark.pass} ${remark.type}: ${remark.name} in ${remark.fn}`,
        range: new vscode.Range(pos, pos),
        severity: vscode.DiagnosticSeverity.Information,
        source: "opt-info",
        relatedInformation: []
      };

      collection.set(
        vscode.window.activeTextEditor!.document.uri,
        (
          collection.get(vscode.window.activeTextEditor!.document.uri) || []
        ).concat(newDia)
      );
      currentRemark = [];
    }
  }
  //});
}

export function activate(context: vscode.ExtensionContext) {
  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  let disposable = vscode.commands.registerCommand("extension.helloWorld", () =>
    // todo why are args split into list
    {
      const clangPs = spawn(
        `clang -c ${
          vscode.window.activeTextEditor!.document.fileName
        } -o /dev/null -O3 -foptimization-record-file=>(cat)`,
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

  context.subscriptions.push(disposable);
}

export function deactivate() {}
