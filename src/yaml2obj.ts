import * as YAML from "yaml";

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
  const { Function, Name, Pass } = parsed;
  const DebugLoc = parsed.DebugLoc;
  const Args = parsed.Args.map(Object.entries).flat();
  if (
    !DebugLoc ||
    !DebugLoc.File ||
    !DebugLoc.Line ||
    !DebugLoc.Column ||
    !Function ||
    !Name ||
    !Pass ||
    !Args ||
    (Type !== "Missed" && Type !== "Passed" && Type !== "Analysis")
  ) {
    console.error("incomplete remark", parsed);
    return null;
  }
  return { DebugLoc, Function, Name, Pass, Type, Args };
}
