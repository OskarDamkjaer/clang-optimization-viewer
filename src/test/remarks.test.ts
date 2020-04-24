import { populateRemarks } from "../remarkFns";

const compileLoopVec =
  "cd /home/dic15oda/thesis-llvm/build &&  /usr/bin/c++ --driver-mode=g++ -DGTEST_HAS_RTTI=0 -D_DEBUG -D_GNU_SOURCE -D__STDC_CONSTANT_MACROS -D__STDC_FORMAT_MACROS -D__STDC_LIMIT_MACROS -Ilib/Transforms/Vectorize -I/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize -Iinclude -I/home/dic15oda/thesis-llvm/llvm/include -fPIC -fvisibility-inlines-hidden -Werror=date-time -Werror=unguarded-availability-new -Wall -Wextra -Wno-unused-parameter -Wwrite-strings -Wcast-qual -Wmissing-field-initializers -pedantic -Wno-long-long -Wimplicit-fallthrough -Wcovered-switch-default -Wno-noexcept-type -Wnon-virtual-dtor -Wdelete-non-virtual-dtor -Wno-comment -Wstring-conversion -fdiagnostics-color -ffunction-sections -fdata-sections -O3 -UNDEBUG -fno-exceptions -fno-rtti -std=c++14 -o lib/Transforms/Vectorize/CMakeFiles/LLVMVectorize.dir/LoopVectorizationLegality.cpp.o -c /home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp";
const filePath =
  "/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp";

test("parse code.c sample", async () => {
  expect(
    (
      await populateRemarks(compileLoopVec, filePath, console.error, {
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
