import * as YAML from "yaml";
import * as path from "path";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";
import { once } from "events";

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
    //console.error("incomplete remark", parsed);
    return null;
  }
  return { DebugLoc, Function, Name, Pass, Type, Args };
}

function numberIsDefined(num: number): boolean {
  return !!num || num === 0;
}

export async function gatherRemarks(
  input: Readable,
  relevantFile: string
): Promise<Remark[]> {
  const rl = createInterface({ input });
  let currentRemark: string[] = [];
  let remarks: Remark[] = [];
  let isRelevantRemark = true;
  let missingDebugLocation = true;

  rl.on("line", (line) => {
    currentRemark.push(line);

    if (line.startsWith("DebugLoc:")) {
      missingDebugLocation = false;
      const match = line.match(/(.*?),/);
      if (!match) {
        console.error("No match", line);
      } else {
        const file = match[0].split("File: ")[1].slice(0, -1);

        if (
          file !== relevantFile &&
          path.basename(file) !== path.basename(relevantFile)
        ) {
          isRelevantRemark = false;
          if (file.endsWith(".cpp")) {
            console.log("should match?", file, relevantFile);
          }
        }
        if (!file) {
          console.log(line);
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
  compileCommand: string,
  fileName: string,
  onError: (error: string) => any
): Promise<Remark[]> {
  const extraFlags = " -c -o /dev/null -foptimization-record-file=>(cat)";
  const clangPs = spawn(`${compileCommand} ${extraFlags}`, {
    shell: "bash",
  });
  clangPs.stderr.on("data", onError);

  clangPs.on("close", (_code) => {
    /* already sent an error message */
  });
  return gatherRemarks(clangPs.stdout, fileName);
}
