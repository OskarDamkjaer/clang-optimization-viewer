export const fromDemo = [
  "--- !Analysis",
  "Pass:            loop-vectorize",
  "Name:            NonReductionValueUsedOutsideLoop",
  "DebugLoc:        { File: code.c, Line: 4, Column: 3 }",
  "Function:        main",
  "Args:",
  "  - String:          'loop not vectorized: '",
  "  - String:          value that could not be identified as reduction is used outside the loop"
];

export const brokenYaml = [
  "--- !Analysis",
  "Pass:            loop-vectorize",
  "DebugLoc:        { File: code.c, Line: 4, Column: 3 }",
  "Function:        main",
  "Args:",
  "  - String:          'loop not vectorized: '",
  "  - String:          value that could not be identified as reduction is used outside the loop"
];

export const llvmExample = [
  "--- !Missed",
  "Pass:            inline",
  "Name:            NoDefinition",
  "DebugLoc:        { File: /home/dic15oda/thesis-llvm/llvm/include/llvm/ADT/StringRef.h,",
  "                   Line: 81, Column: 14 }",
  "Function:        _ZN4llvm9StringRef6strLenEPKc",
  "Args:",
  "  - Callee:          strlen",
  "  - String:          ' will not be inlined into '",
  "  - Caller:          _ZN4llvm9StringRef6strLenEPKc",
  "    DebugLoc:        { File: /home/dic15oda/thesis-llvm/llvm/include/llvm/ADT/StringRef.h,",
  "                       Line: 77, Column: 0 }",
  "  - String:          ' because its definition is unavailable'"
];
