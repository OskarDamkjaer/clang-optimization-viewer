import { populateRemarks } from "../remarkFns";
const fs = require('fs').promises;
import * as path from "path";


test("parse code.c sample", async () => {
  const testContents = `
  int bar(int x) {
      return x * 2;
  }

  void foo(int *a, int *b, int n) {
      for (unsigned i = 0; i < n; i++)
          a[i] = bar(b[i]);
  }
  `;

  const filePath = 'code.c';

  await fs.writeFile(filePath, testContents);

  expect(
    (
      await populateRemarks({command: "cc -O3 -c", file: filePath, directory: path.dirname(filePath)}, console.error, {
        isCancellationRequested: false,
      })
    )[0]
  ).toEqual({
    Args: [
      ["Callee", "_ZN4llvm13isPowerOf2_32Ej"],
      [
        "DebugLoc",
        {
          Column: 0,
          File:
            "/home/dic15oda/thesis-llvm/llvm/include/llvm/Support/MathExtras.h",
          Line: 465,
        },
      ],
      ["String", " inlined into "],
      ["Caller", "_ZN4llvm18LoopVectorizeHints4Hint8validateEj"],
      [
        "DebugLoc",
        {
          Column: 0,
          File:
            "/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp",
          Line: 53,
        },
      ],
      ["String", " with cost="],
      ["Cost", "-10"],
      ["String", " (threshold="],
      ["Threshold", "325"],
      ["String", ")"],
    ],
    DebugLoc: {
      Column: 12,
      File:
        "/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp",
      Line: 56,
    },
    Function: "_ZN4llvm18LoopVectorizeHints4Hint8validateEj",
    Name: "Inlined",
    Pass: "inline",
    Type: "Passed",
  });
}, 30000);
