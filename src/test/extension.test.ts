//import { handleCodeLens } from "../extension";
const compileLoopVec =
  "cd /home/dic15oda/thesis-llvm/build &&  /usr/bin/c++ --driver-mode=g++ -DGTEST_HAS_RTTI=0 -D_DEBUG -D_GNU_SOURCE -D__STDC_CONSTANT_MACROS -D__STDC_FORMAT_MACROS -D__STDC_LIMIT_MACROS -Ilib/Transforms/Vectorize -I/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize -Iinclude -I/home/dic15oda/thesis-llvm/llvm/include -fPIC -fvisibility-inlines-hidden -Werror=date-time -Werror=unguarded-availability-new -Wall -Wextra -Wno-unused-parameter -Wwrite-strings -Wcast-qual -Wmissing-field-initializers -pedantic -Wno-long-long -Wimplicit-fallthrough -Wcovered-switch-default -Wno-noexcept-type -Wnon-virtual-dtor -Wdelete-non-virtual-dtor -Wno-comment -Wstring-conversion -fdiagnostics-color -ffunction-sections -fdata-sections -O3 -UNDEBUG -fno-exceptions -fno-rtti -std=c++14 -o lib/Transforms/Vectorize/CMakeFiles/LLVMVectorize.dir/LoopVectorizationLegality.cpp.o -c /home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp";
const filePath =
  "/home/dic15oda/thesis-llvm/llvm/lib/Transforms/Vectorize/LoopVectorizationLegality.cpp";

test("Handle loop vec code lens", () => {
  expect(null).toEqual(null);
  //( new Range(907, 5, 911, 5), compileLoopVec, Uri.file(filePath))
});
