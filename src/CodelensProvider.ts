import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { once } from "events";

type LensTemplate = {
  kind: "ForStmt" | "WhileStmt" | "FuncDecl" | "DoStmt" | "ForRangeStmt";
  range: vscode.Range;
};

const stmtToTitle = {
  ForStmt: "Show remarks for this loop",
  WhileStmt: "Show remarks for this loop",
  FuncDecl: "Show remarks for this function",
  DoStmt: "Show remarks for this loop",
  ForRangeStmt: "Show remarks for this loop",
};

async function getAST(
  doc: vscode.TextDocument
): Promise<[LensTemplate[], string]> {
  const findFunctionDecls = spawn("./find-decls-linux", [doc.fileName], {
    cwd: __dirname, shell: true
  });

  findFunctionDecls.on("error", (data) => {
    console.log(data.toString());
    vscode.window.showErrorMessage(data.toString());
  });

  findFunctionDecls.stderr.on("data", (data) => {
    console.log(data.toString());
    vscode.window.showErrorMessage(data);
  });

  findFunctionDecls.on("close", (_code) => {
    /* already sent an error message */
  });

  let ranges: LensTemplate[] = [];
  const rl = createInterface({ input: findFunctionDecls.stdout });
  let compileCommand: string | null = null;

  rl.on("line", (l: string) => {
    // first line is compilecommand
    if (!compileCommand) {
      compileCommand = l;
      return;
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
  });

  await once(rl, "close");

  return [ranges, compileCommand || ""];
}

function parsePosStrings(s: string): vscode.Range {
  // makes these into positions "/home/dic15oda/Desktop/code.cpp:1:1, line:10:1"
  const [start, end] = s.split(",");
  if (!(start && end)) {
    throw new Error(s);
  }
  const [_, startLine, startChar] = start
    .split(":")
    .map((n) => parseInt(n, 10));

  let _2, endLine, endChar;
  const shortHandLocRegex = /^ col:\d+$/; // test if format is: filename:nbr:nbr, col:nbr
  if (shortHandLocRegex.test(end)) {
    endLine = startLine;
    endChar = parseInt(end.split(":")[1], 10);
  } else {
    [_2, endLine, endChar] = end.split(":").map((n) => parseInt(n, 10));
  }

  if (
    !(
      typeof startLine === "number" &&
      typeof startChar === "number" &&
      typeof endLine === "number" &&
      typeof endChar === "number"
    )
  ) {
    throw new Error(s);
  }
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

export class CodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
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
            title: stmtToTitle[kind],
            command: "extension.addRemark",
            arguments: [range, compileCommand],
          }
        )
    );
  }
}
