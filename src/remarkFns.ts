import * as YAML from "yaml";
import * as path from "path";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { createInterface } from "readline";
import { once } from "events";
import { log, CompileCommand } from "./extension";

export type RemarkType = "Missed" | "Passed" | "Analysis";
export type Remark = {
  Pass: string;
  Type: RemarkType;
  Name: string;
  DebugLoc: { File: string; Line: number; Column: number };
  Function: string;
  Args: [string, string | object][];
};

export function yaml2obj(raw: string[]): Remark | null {
  const Type = raw[0].replace("--- !", "");
  const parsed = YAML.parse(raw.slice(1).join("\n"));
  const { Function, Name, Pass, DebugLoc } = parsed;
  const Args = parsed.Args.map(Object.entries).flat();
  if (
    !DebugLoc ||
    !DebugLoc.File ||
    !numberIsDefined(DebugLoc.Line) ||
    !numberIsDefined(DebugLoc.Column) ||
    !Function ||
    !Name ||
    !Pass ||
    !Args ||
    (Type !== "Missed" && Type !== "Passed" && Type !== "Analysis")
  ) {
    log("incomplete remark " + JSON.stringify(parsed));
    return null;
  }
  return { DebugLoc, Function, Name, Pass, Type, Args };
}

function numberIsDefined(num: number): boolean {
  return !!num || num === 0;
}

export async function gatherRemarks(
  clangPs: ChildProcessWithoutNullStreams,
  relevantFile: string,
  token: { isCancellationRequested: boolean }
): Promise<Remark[]> {
  const rl = createInterface({ input: clangPs.stdout });
  let currentRemark: string[] = [];
  let remarks: Remark[] = [];
  let isRelevantRemark = true;
  let missingDebugLocation = true;

  rl.on("line", (line) => {
    if (token.isCancellationRequested) {
      clangPs.stdout.pause();
      clangPs.kill();
      rl.close();
      return;
    }
    currentRemark.push(line);

    if (line.startsWith("DebugLoc:")) {
      missingDebugLocation = false;
      const fileNameFinder = /File: (.*?(?=,))/;
      const match = line.match(fileNameFinder);
      if (!match) {
        log("No match " + line);
      } else {
        const file = match[1].replace(/'/g, "");

        if (!file) {
          log("no file " + line);
        }

        if (
          file !== relevantFile &&
          path.basename(file) !== path.basename(relevantFile)
        ) {
          isRelevantRemark = false;
        }
      }
    }

    if (line === "...") {
      if (isRelevantRemark && !missingDebugLocation) {
        const remark = yaml2obj(currentRemark);
        if (remark) {
          remarks.push(remark);
        }
      }
      currentRemark = [];
      isRelevantRemark = true;
      missingDebugLocation = true;
    }
  });

  await once(rl, "close");

  return remarks;
}

export function populateRemarks(
  compileCommand: CompileCommand,
  onError: (error: string) => any,
  token: {
    isCancellationRequested: boolean;
  }
): Promise<Remark[]> {
  const extraFlags =
    " -c -o /dev/null -fsave-optimization-record -foptimization-record-file=>(cat)";

  const clangPs = spawn(`${compileCommand.command} ${extraFlags}`, {
    shell: "bash", cwd: compileCommand.directory,
  });

  clangPs.stderr.on("data", onError);
  clangPs.on("error", onError);


  clangPs.on("close", (_code) => {
    /* already sent an error message */
  });

  return gatherRemarks(clangPs, compileCommand.file, token);
}
