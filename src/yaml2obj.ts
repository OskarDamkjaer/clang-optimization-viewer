export type RemarkType = "Missed" | "Passed" | "Analysis";
const YAML = require("yaml");

export type Remark = {
  Pass: string;
  Type: RemarkType;
  Name: string;
  DebugLoc?: { File: string; Line: number; Column: number };
  Function: string;
  Args: [string, string][];
};

export function yaml2obj(raw: string[]) {
  const Type = raw[0].replace("--- !", "");
  const parsed = YAML.parse(raw.slice(1).join("\n"));
  const { Function, Name, Pass } = parsed;
  const DebugLoc = parsed.DebugLoc;
  const Args = parsed.Args.map(Object.entries).flat();
  return { DebugLoc, Function, Name, Pass, Type, Args };

  /*
  function reducer(acc: any, c: string): any {
    const curr = c.replace(/'/g, "");
    if (curr.startsWith("---")) {
      const type = curr.split("!")[1].trim();
      return { ...acc, type };
    }

    if (curr.startsWith("Pass:")) {
      const pass = curr.split(":")[1].trim();
      return { ...acc, pass };
    }

    if (curr.startsWith("Name:")) {
      const name = curr.split(":")[1].trim();
      return { ...acc, name };
    }

    if (curr.startsWith("DebugLoc:")) {
      const debugLoc = curr
        .slice(9)
        .trim()
        .replace(/{|}/g, "")
        .split(",")
        .map(s => s.split(":").map(s => s.trim()))
        .map(([key, val]) => ({
          [key]: /^\d+$/.test(val) ? parseInt(val, 10) : val
        }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});

      return { ...acc, debugLoc: debugLoc };
    }
    if (curr.startsWith("Function:")) {
      const fn = curr.split(":")[1].trim();
      return { ...acc, fn };
    }

    if (curr.startsWith("Args")) {
      return acc;
    }

    if (curr.startsWith("-")) {
      const pair = curr
        .slice(2)
        .split(":")
        .map(s => s.trim());
      return {
        ...acc,
        args: acc.args ? acc.args.concat([pair]) : [pair]
      };
    }

    if (curr.startsWith("...")) {
      return acc;
    }

    return acc;
  }
  return yaml.reduce(reducer, {});
  */
}
