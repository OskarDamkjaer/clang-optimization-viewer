import { yaml2obj } from "../yaml2obj";
import { fromDemo, brokenYaml, llvmExample } from "./testdata";

test("parse code.c sample", () => {
  expect(yaml2obj(fromDemo)).toEqual({
    DebugLoc: {
      Column: 3,
      File: "code.c",
      Line: 4
    },
    Function: "main",
    Name: "NonReductionValueUsedOutsideLoop",
    Pass: "loop-vectorize",
    Type: "Analysis",
    Args: [
      ["String", "loop not vectorized: "],
      [
        "String",
        "value that could not be identified as reduction is used outside the loop"
      ]
    ]
  });
});

test("incomplete sample yields null", () => {
  expect(yaml2obj(brokenYaml)).toEqual(null);
});

test("parse LoopVectorizationLegality.cpp sample", () => {
  expect(yaml2obj(llvmExample)).toEqual({
    DebugLoc: {
      Column: 14,
      File: "/home/dic15oda/thesis-llvm/llvm/include/llvm/ADT/StringRef.h",
      Line: 81
    },
    Function: "_ZN4llvm9StringRef6strLenEPKc",
    Name: "NoDefinition",
    Pass: "inline",
    Type: "Missed",
    Args: [
      ["Callee", "strlen"],
      ["String", " will not be inlined into "],
      ["Caller", "_ZN4llvm9StringRef6strLenEPKc"],
      [
        "DebugLoc",
        {
          Column: 0,
          File: "/home/dic15oda/thesis-llvm/llvm/include/llvm/ADT/StringRef.h",
          Line: 77
        }
      ],
      ["String", " because its definition is unavailable"]
    ]
  });
});
