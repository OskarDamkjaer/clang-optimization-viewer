import * as vscode from "vscode";
import { spawn, exec } from "child_process";
import { createInterface } from "readline";

type LensTemplate = {
  kind: "ForStmt" | "WhileStmt" | "FuncDecl" | "DoStmt" | "ForRangeStmt";
  range: vscode.Range;
};

async function getAST(
  doc: vscode.TextDocument
): Promise<[LensTemplate[], string]> {
  const [compileCommandURI] = await vscode.workspace.findFiles(
    "compile_commands.json",
    null,
    1
  );

  const findFunctionDecls = spawn(
    "/home/dic15oda/opt-info/find-function-decls",
    [doc.fileName, "-p", compileCommandURI?.path || ""]
    // if we pass -- then compile commands are no longer used properly
  );

  findFunctionDecls.stderr.on("data", data => {
    console.log(data.toString());
    vscode.window.showErrorMessage(data);
  });

  findFunctionDecls.on("close", _code => {
    /* already sent an error message */
  });

  let ranges: LensTemplate[] = [];
  const rl = createInterface({ input: findFunctionDecls.stdout });
  let compileCommand = null;
  for await (const l of rl) {
    // first line is compilecommand
    if (!compileCommand) {
      compileCommand = l;
      continue;
    }

    const kind = l.split(";")[0];
    if (
      kind !== "ForStmt" &&
      kind !== "ForRangeStmt" &&
      kind !== "WhileStmt" &&
      kind !== "FuncDecl" &&
      kind !== "DoStmt"
    ) {
      throw Error(`Unexpected lens-kind: ${kind}`);
    }

    const posString = /<([^]+?)>/.exec(l)![1];
    if (posString.split(",").length === 2) {
      const range = parsePosStrings(posString);
      ranges.push({ kind, range });
    }
  }

  return [ranges, compileCommand || ""];
}

function parsePosStrings(s: string): vscode.Range {
  // makes these into positions "/home/dic15oda/Desktop/code.cpp:1:1, line:10:1"
  const [start, end] = s.split(",");
  const [_, startLine, startChar] = start.split(":").map(n => parseInt(n, 10));
  const [_2, endLine, endChar] = end.split(":").map(n => parseInt(n, 10));
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

export class CodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    try {
      const [lensTemplates, compileCommand] = await getAST(document);

      return lensTemplates.map(
        ({ range, kind }) =>
          new vscode.CodeLens(
            /* range should only span one line */
            new vscode.Range(
              range.start.line - 1,
              range.start.character,
              range.start.line - 1,
              range.start.character
            ),
            {
              title: kind,
              command: "extension.addRemark",
              arguments: [range, compileCommand]
            }
          )
      );
    } catch (e) {
      console.log(e);
      // otherwise no indication of crash
      return [];
    }
  }
}
