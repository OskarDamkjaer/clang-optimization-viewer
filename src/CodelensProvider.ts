import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";

async function getAST(doc: vscode.TextDocument): Promise<string[]> {
  const clangPs = spawn(`clang -cc1 -ast-dump ${doc.fileName}`, {
    shell: "bash"
  });

  clangPs.stderr.on("data", _data => {
    vscode.window.showErrorMessage(
      `Error analyzing your file, is Clang installed?`
    );
  });

  clangPs.on("close", _code => {
    /* already sent an error message */
  });

  let ranges: string[] = [];
  const rl = createInterface({ input: clangPs.stdout });
  for await (const l of rl) {
    if (l.includes("FunctionDecl")) {
      ranges.push(l);
    }
    if (l.includes("ForStmt")) {
      ranges.push(l);
    }
    if (l.includes("WhileStmt")) {
      ranges.push(l);
    }
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
    const ast = await getAST(document);
    const ranges = ast
      .map(line => /<([^]+)>/.exec(line)![1])
      .map(parsePosStrings);

    return ranges.map(
      range =>
        new vscode.CodeLens(
          /* range should only span one line */
          new vscode.Range(
            range.start.line - 1,
            range.start.character,
            range.start.line - 1,
            range.start.character
          ),
          {
            title: "show remarks",
            command: "extension.addRemark",
            arguments: [range]
          }
        )
    );
  }
}
