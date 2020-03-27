import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";

type LensTemplate = {
  kind: "ForStmt" | "WhileStmt" | "FuncDecl" | "DoStmt";
  range: vscode.Range;
};

async function getAST(doc: vscode.TextDocument): Promise<LensTemplate[]> {
  // lägga till include
  const findFunctionDecls = spawn(
    "/home/dic15oda/thesis-llvm/build/bin/find-function-decls",
    [doc.fileName, "--"]
  );

  findFunctionDecls.stderr.on("data", _data => {
    console.log(_data.toString());
    vscode.window.showErrorMessage(_data);
  });

  findFunctionDecls.on("close", _code => {
    /* already sent an error message */
  });

  let ranges: LensTemplate[] = [];
  const rl = createInterface({ input: findFunctionDecls.stdout });
  // TODO for await is inefficient
  for await (const l of rl) {
    const kind = l.split(";")[0];
    if (
      kind !== "ForStmt" &&
      kind !== "WhileStmt" &&
      kind !== "FuncDecl" &&
      kind !== "DoStmt"
    ) {
      throw Error(`Unexpected lens-kind: ${kind}`);
    }

    const posString = /<([^]+?)>/.exec(l)![1];
    const range = parsePosStrings(posString);
    ranges.push({ kind, range });
  }

  return ranges;
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
      const lensTemplates = await getAST(document);

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
              arguments: [range]
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
