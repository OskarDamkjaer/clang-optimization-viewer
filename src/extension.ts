import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { Remark, yaml2obj } from "./yaml2obj";
import { CodelensProvider } from "./CodelensProvider";

const fileExtensions = [".c", ".cpp", ".cc", ".c++", ".cxx", ".cp"];
const extraFlags = " -c -o /dev/null -foptimization-record-file=>(cat)";

async function gatherRemarks(input: Readable): Promise<Remark[]> {
  const rl = createInterface({ input });
  let currentRemark: string[] = [];
  let remarks: Remark[] = [];
  for await (const line of rl) {
    currentRemark.push(line);

    if (line === "...") {
      const remark = yaml2obj(currentRemark);
      if (remark) {
        remarks.push(remark);
      }
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
    const { Line, Column } = remark.DebugLoc;
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
      message: `${remark.Type}: ${remark.Pass}`,
      range,
      severity: severity[remark.Type],
      source: "",
      relatedInformation: [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(doc.uri, range),
          remark.Args.map(([_key, value]) => value)
            .filter(t => typeof t === "string")
            .join(" ")
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

function populateRemarks(compileCommand: string): Promise<Remark[]> {
  const clangPs = spawn(`${compileCommand} ${extraFlags}`, {
    shell: "bash"
  });
  clangPs.stderr.on("data", data => {
    vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
  });
  clangPs.on("close", _code => {
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
  populateRemarks(`clang ${doc.fileName}`)
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

  async function handleCodeLens(
    range: vscode.Range,
    compileCommand: string
  ): Promise<void> {
    const ALL = "All remarks";
    const NONE = "No remarks found in range";
    const doc = getDocumentOrWarn();
    if (!doc) {
      return;
    }

    const remarks = await populateRemarks(compileCommand);

    const remarksInScope = remarks.filter(r =>
      range.contains(new vscode.Position(r.DebugLoc.Line, r.DebugLoc.Column))
    );

    const possibleRemarks = uniq(remarksInScope.map(r => r.Pass));

    const chosen = await vscode.window.showQuickPick(
      [possibleRemarks.length === 0 ? NONE : ALL].concat(possibleRemarks)
    );

    if (!chosen || chosen === NONE) {
      return;
    }

    const relevantRemarks =
      chosen === ALL
        ? remarksInScope
        : remarksInScope.filter(r => r.Pass === chosen);

    const diagnostics = remarkToDiagnostic(doc, relevantRemarks);

    issues.set(doc.uri, diagnostics);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.addRemark", handleCodeLens)
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
