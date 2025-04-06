import * as vscode from "vscode";
import { Remark, populateRemarks } from "./remarkFns";
import { CodelensProvider } from "./CodelensProvider";

const outputChannel = vscode.window.createOutputChannel('Clang Optimization Remarks');

export type CompileCommand = {
  directory: string,
  file: string,
  command: string
};

const fileExtensions = [".c", ".cpp", ".cc", ".c++", ".cxx", ".cp", ".m"];
type RemarkCache = null | { file: string; remarks: Remark[] };
type Work = null | { file: string; range: vscode.Range };
let remarkCache: RemarkCache = null;
let currentlyWorkingOn: Work = null;

function remarkToDiagnostic(
  uri: vscode.Uri,
  remarks: Remark[]
): vscode.Diagnostic[] {
  return remarks.map((remark) => {
    const { Line, Column } = remark.DebugLoc;
    const pos = new vscode.Position(
      Math.max(0, Line - 1),
      Math.max(0, Column - 1)
    );

    const range = new vscode.Range(pos, pos);
    const severity = {
      Passed: vscode.DiagnosticSeverity.Information,
      Analysis: vscode.DiagnosticSeverity.Warning,
      Missed: vscode.DiagnosticSeverity.Error,
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
            .filter((t) => typeof t === "string")
            .join(" ")
        ),
      ],
    };
  });
}

function getDocumentOrWarn(): vscode.TextDocument | null {
  const doc = vscode.window.activeTextEditor?.document;

  if (
    doc &&
    fileExtensions.some((ending) => doc.fileName.toLowerCase().endsWith(ending))
  ) {
    return doc;
  } else {
    vscode.window.showErrorMessage(
      "Make sure there's a c or cpp file open when running this command"
    );
    return null;
  }
}

async function populateRemarksWithProgress(
  doc: vscode.TextDocument,
  command: CompileCommand,
): Promise<RemarkCache> {
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Creating remarks",
      cancellable: true,
    },
    async (_progress, token) => {
      const remarks = await populateRemarks(
        command,
        onError,
        token
      );

      if (token.isCancellationRequested) {
        return null;
      }
      return {
        file: doc.fileName,
        remarks,
      };
    }
  );
}

function onError(data: string): void {
  vscode.window.showErrorMessage(`Compilation failed:\n ${data}`);
  log(`extension error:${data}`);
}

export async function handleCodeLens(
  range: vscode.Range,
  uri: vscode.Uri,
  remarks: Remark[]
): Promise<readonly vscode.Diagnostic[] | null> {
  const ALL = "All remarks";
  const NONE = "No remarks found in range";

  const remarksInScope = remarks.filter((r) =>
    range.contains(new vscode.Position(r.DebugLoc.Line, r.DebugLoc.Column))
  );

  const possibleRemarks = uniq(remarksInScope.map((r) => r.Pass));

  log(`quick pick shown with options: ${possibleRemarks.join(":")}`);
  const chosen = await vscode.window.showQuickPick(
    [possibleRemarks.length === 0 ? NONE : ALL].concat(possibleRemarks)
  );
  log(`picked: ${chosen}`);

  if (!chosen || chosen === NONE) {
    return null;
  }

  const relevantRemarks =
    chosen === ALL
      ? remarksInScope
      : remarksInScope.filter((r) => r.Pass === chosen);

  return remarkToDiagnostic(uri, relevantRemarks);
}

export let ctx: vscode.ExtensionContext;
export function activate(context: vscode.ExtensionContext) {
  const issues = vscode.languages.createDiagnosticCollection("opt-info");
  log("Extension activated");
  ctx = context;

  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.hideRemarks", () =>
      issues.clear()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addRemark",
      async (range: vscode.Range, command) => {
        const doc = getDocumentOrWarn();
        if (!doc) {
          return;
        }
        log(`code lens in ${doc.fileName} clicked at ${range.start.line}`);

        if (currentlyWorkingOn) {
          const sameFile = currentlyWorkingOn.file === doc.fileName;
          const sameRange = currentlyWorkingOn.range.isEqual(range);
          if (sameFile) {
            if (!sameRange) {
              // if same file but new range set to open that range instead
              currentlyWorkingOn = { ...currentlyWorkingOn, range };
            }
            return;
          } else {
            // it would be better to cancel the old work automatically and continue
            vscode.window.showErrorMessage(
              "Please cancel the running task to start a task in a new file"
            );
            return;
          }
        }

        currentlyWorkingOn = { file: doc.fileName, range };
        if (!remarkCache || remarkCache.file !== doc.fileName) {
          remarkCache = await populateRemarksWithProgress(doc, command);
        }

        if (remarkCache) {
          const diags = await handleCodeLens(
            currentlyWorkingOn.range,
            doc.uri,
            remarkCache.remarks
          );

          if (diags) {
            issues.set(doc.uri, diags);
          } else {
            issues.clear();
          }
        }
        currentlyWorkingOn = null;
      }
    )
  );

  vscode.workspace.onDidSaveTextDocument((savedDoc: vscode.TextDocument) => {
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (
      activeDoc &&
      fileExtensions.some((ending) =>
        activeDoc.fileName.toLowerCase().endsWith(ending)
      )
    ) {
      if (savedDoc.fileName === activeDoc.fileName) {
        remarkCache = null;
        issues.clear();
      }
    }
  });

  if (!process.env.CTRL) {
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: "file", language: "c" },
        { scheme: "file", language: "cpp" },
        { scheme: "file", language: "objective-c" },
        { scheme: "file", language: "objective-cpp" },
      ],
      new CodelensProvider()
    );
  }
}

function uniq(list: any[]) {
  return Array.from(new Set(list));
}

export function deactivate() { }

export function log(msg: string) {
  outputChannel.appendLine(msg);
  console.log(`[Opt Info] ${msg}`);
}