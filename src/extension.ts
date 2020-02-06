import * as vscode from "vscode";
import { exec } from "child_process";
const clangbin = "$HOME/thesis-llvm/build/bin/clang";
const flags = "-c -o /dev/null -O3 -foptimization-record-file=$1";
const clang = "clang";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "extension.helloWorld",
    async () =>
      new Promise(r =>
        exec(
          `${clang} ${flags} ${
            vscode.window.activeTextEditor!.document.fileName
          }`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`);
              return;
            }
            // todo skaffa en readabl3e steam att ge till exec eler dyl och ta bort promise
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            vscode.window.showInformationMessage("a");
            r();
          }
        )
      )
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
