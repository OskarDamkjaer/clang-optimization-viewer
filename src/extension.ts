import * as vscode from "vscode";
import { Remark, populateRemarks } from "./yaml2obj";
import { CodelensProvider } from "./CodelensProvider";

const fileExtensions = [".c", ".cpp", ".cc", ".c++", ".cxx", ".cp"];

function remarkToDiagnostic(
  uri: vscode.Uri,
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
          new vscode.Location(uri, range),
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

function showRemarks(issues: vscode.DiagnosticCollection) {
  const doc = getDocumentOrWarn();
  if (!doc) {
    return;
  }

  issues.clear();
  populateRemarks(`clang ${doc.fileName}`, doc.fileName, onError)
    .then(r => remarkToDiagnostic(doc.uri, r))
    .then(diagnostics => issues.set(doc.uri, diagnostics));
}

function onError(data: string): void {
  vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
}

export async function handleCodeLens(
  range: vscode.Range,
  compileCommand: string,
  uri: vscode.Uri
): Promise<readonly vscode.Diagnostic[] | null> {
  const ALL = "All remarks";
  const NONE = "No remarks found in range";

  const remarks = await populateRemarks(compileCommand, uri.fsPath, onError);

  const remarksInScope = remarks.filter(r =>
    range.contains(new vscode.Position(r.DebugLoc.Line, r.DebugLoc.Column))
  );

  const possibleRemarks = uniq(remarksInScope.map(r => r.Pass));

  const chosen = await vscode.window.showQuickPick(
    [possibleRemarks.length === 0 ? NONE : ALL].concat(possibleRemarks)
  );

  if (!chosen || chosen === NONE) {
    return null;
  }

  const relevantRemarks =
    chosen === ALL
      ? remarksInScope
      : remarksInScope.filter(r => r.Pass === chosen);

  return remarkToDiagnostic(uri, relevantRemarks);
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
    vscode.commands.registerCommand(
      "extension.addRemark",
      async (range, command) => {
        const doc = getDocumentOrWarn();
        if (doc) {
          const diags = await handleCodeLens(range, command, doc.uri);
          if (diags) {
            issues.set(doc.uri, diags);
          }
        }
      }
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
