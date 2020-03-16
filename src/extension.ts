import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { Remark, yaml2obj } from "./yaml2obj";
import { CodelensProvider } from "./CodelensProvider";

const fileExtensions = [".c", ".cpp", ".cc", ".c++", ".cxx", ".cp"];
//const compiler = "clang";
const compiler = "$HOME/thesis-llvm/build/bin/clang";
//const compiler = "Users/Catarina/clang/bin/clang";
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

function populateRemarks(doc: vscode.TextDocument): Promise<Remark[]> {
  const clangPs = spawn(`${compiler} ${doc.fileName} ${flags}`, {
    shell: "bash"
  });
  clangPs.stderr.on("data", data => {
    vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
  });
  clangPs.on("close", code => {
    /* already sent an error message */
  });
  return gatherRemarks(clangPs.stdout);
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

  async function handleCodeLens(range: vscode.Range): Promise<void> {
    const ALL = "All remarks";
    const NONE = "No remarks found in range";
    const doc = getDocumentOrWarn();
    if (!doc) {
      return;
    }

    const remarks = await populateRemarks(doc);

    const remarksInScope = remarks.filter(r => {
      if (r.loopLocation) {
        return r.loopLocation.Line === range.start.line + 1;
      }
      if (r.debugLoc) {
        return range.contains(
          new vscode.Position(r.debugLoc.Line + 1, r.debugLoc.Column + 1)
        );
      }
      return false;
    });

    const possibleRemarks = uniq(remarksInScope.map(r => r.pass));

    const chosen = await vscode.window.showQuickPick(
      [possibleRemarks.length === 0 ? NONE : ALL].concat(possibleRemarks)
    );

    if (!chosen || chosen === NONE) {
      return;
    }

    const relevantRemarks =
      chosen === ALL
        ? remarksInScope
        : remarksInScope.filter(r => r.pass === chosen);

    const diagnostics = remarkToDiagnostic(doc, relevantRemarks);

    issues.set(doc.uri, diagnostics);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.addLoopRemark", handleCodeLens)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addFunctionRemark",
      handleCodeLens
    )
  );
  vscode.languages.registerCodeLensProvider(
    [
      { scheme: "file", language: "c" },
      { scheme: "file", language: "cpp" }
    ],
    new CodelensProvider()
  );
}

function uniq(list: any[]) {
  return Array.from(new Set(list));
}

export function deactivate() {}
