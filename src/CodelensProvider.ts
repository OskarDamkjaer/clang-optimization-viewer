import * as vscode from "vscode";
import { spawn } from "child_process";
import { createInterface } from "readline";

async function getAST(doc: vscode.TextDocument): Promise<string[]> {
  /*const path = "/home/dic15oda/thesis-llvm/build";
  const command =
    "/usr/bin/c++ -DGTEST_HAS_RTTI=0 -D_DEBUG -D_GNU_SOURCE -D__STDC_CONSTANT_MACROS -D__STDC_FORMAT_MACROS -D__STDC_LIMIT_MACROS -Ilib/Transforms/Vectorize -I/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize -Iinclude -I/home/dic15oda/thesis-llvm/llvm/include   -fPIC -fvisibility-inlines-hidden -Werror=date-time -Werror=unguarded-availability-new -Wall -Wextra -Wno-unused-parameter -Wwrite-strings -Wcast-qual -Wmissing-field-initializers -pedantic -Wno-long-long -Wimplicit-fallthrough -Wcovered-switch-default -Wno-noexcept-type -Wnon-virtual-dtor -Wdelete-non-virtual-dtor -Wno-comment -Wstring-conversion -fdiagnostics-color -ffunction-sections -fdata-sections -O3    -UNDEBUG  -fno-exceptions -fno-rtti -std=c++14 -o lib/Transforms/Vectorize/CMakeFiles/LLVMVectorize.dir/LoopVectorizationLegality.cpp.o -c /home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp";

  const clangPs = spawn(`cd ${path} && ${command} -Xclang -ast-dump `, {
    shell: "bash"
  });
  */
  console.log("as");
  const clangPs = spawn(
    `clang -Xclang -ast-dump ${doc.fileName} -c -o /dev/null -Wno-everything`,
    {
      shell: "bash"
    }
  );
  console.log("asdf");

  clangPs.stderr.on("data", _data => {
    console.log(_data.toString());
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
  console.log("done");

  return ranges;
}

function parsePosStrings(s: string): vscode.Range {
  // makes these into positions "/home/dic15oda/Desktop/code.cpp:1:1, line:10:1"
  const [start, end] = s.split(",");
  const [_, startLine, startChar] = start.split(":").map(n => parseInt(n, 10));
  const [_2, endLine, endChar] = end.split(":").map(n => parseInt(n, 10));
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

function createPosStrings(line: string): string {
  // assumes well formed functions

  const res = /<([^]+)>/.exec(line)![1];

  return res;
}

export class CodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    try {
      console.log("a");
      const ast = await getAST(document);
      console.log("b");
      const ranges = ast
        .filter(a => !a.endsWith("extern"))
        .map(createPosStrings)
        .map(parsePosStrings);
      console.log("c");

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
    } catch (e) {
      console.log(e);
      // otherwise no indication of crash
      return [];
    }
  }
}
