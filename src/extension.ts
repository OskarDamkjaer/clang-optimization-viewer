import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { yaml2obj } from "./yaml2obj";
const clangbin = "$HOME/thesis-llvm/build/bin/clang";
const flags = "-c -o /dev/null -O3 -foptimization-record-file=>(cat)";
const clang = "clang";

function parseStream(input: Readable): void {
  const rl = createInterface({ input });

  let currentRemark: string[] = [];

  rl.on("line", (l: string) => {
    const line = l.trim();
    currentRemark.push(line);

    if (line === "...") {
      const objs = yaml2obj(currentRemark);
      console.log(objs);
      currentRemark = [];
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("extension.helloWorld", () =>
    // todo why are args slpilit into list
    {
      const clangPs = spawn(
        `clang -c ${
          vscode.window.activeTextEditor!.document.fileName
        } -o /dev/null -O2 -foptimization-record-file=>(cat)`,
        { shell: "bash" }
      );
      parseStream(clangPs.stdout);

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
//new vscode.Diagnostic(new vscode.Range(1, 1, 7, 7), "oops");

export function deactivate() {}
