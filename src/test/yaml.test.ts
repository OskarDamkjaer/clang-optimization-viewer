import { Remark, RemarkType, yaml2obj } from "../yaml2obj";
import { fromDemo } from "./testdata";

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

test("parse LoopVectorizationLegality.cpp sample", () => {
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
