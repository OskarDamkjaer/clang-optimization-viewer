import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { Remark, yaml2obj } from "./yaml2obj";
import { CodelensProvider } from "./CodelensProvider";

const fileExtensions = [".c", ".cpp", ".cc", ".c++", ".cxx", ".cp"];
const compiler = "/Users/Catarina/clang/bin/clang"; //"clang"; //"$HOME/thesis-llvm/build/bin/clang";
const flags = "-c -o /dev/null -O3 -foptimization-record-file=>(cat)";

let remarks = [];

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

function remarkToDiagnostic(
  doc: vscode.TextDocument,
  remarks: Remark[]
): vscode.Diagnostic[] {
  return remarks.map(remark => {
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
          new vscode.Location(doc.uri, range),
          remark.args.map(([_key, value]) => value).join(" ")
        )
      ]
    };
  });
}

function getDocumentOrWarn(): vscode.TextDocument | null {
  const doc = vscode.window.activeTextEditor?.document;

  if (
    doc &&
    fileExtensions.some(ending => doc.fileName.toLowerCase().endsWith(ending))
  ) {
    return doc;
  } else {
    vscode.window.showErrorMessage(
      "Make sure there's a c or cpp file open when running this command"
    );
    return null;
  }
}

async function populateRemarks(doc: vscode.TextDocument): Promise<Remark[]> {
  const clangPs = spawn(`${compiler} ${doc.fileName} ${flags}`, {
    shell: "bash"
  });
  clangPs.stderr.on("data", data => {
    vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
  });
  clangPs.on("close", code => {
    code !== 0 &&
      vscode.window.showErrorMessage(`Clang exited with code: ${code}`);
  });
  remarks = await gatherRemarks(clangPs.stdout);
  return remarks;
}

function showRemarks(issues: vscode.DiagnosticCollection) {
  const doc = getDocumentOrWarn();
  if (!doc) {
    return;
  }

  issues.clear();
  populateRemarks(doc)
    .then(r => remarkToDiagnostic(doc, r))
    .then(diagnostics => issues.set(doc.uri, diagnostics));
}

export function activate(context: vscode.ExtensionContext) {
  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showRemarks", () => {
      showRemarks(issues);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.hideRemarks", () =>
      issues.clear()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.addLoopPragma", range => {
      console.log("loop", range);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.addFunctionPragma", range => {
      console.log("fn", range);
    })
  );

  vscode.languages.registerCodeLensProvider(
    [
      { scheme: "file", language: "c" },
      { scheme: "file", language: "cpp" }
    ],
    new CodelensProvider()
  );
}

export function deactivate() {}
