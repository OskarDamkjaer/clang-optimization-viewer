export type RemarkType = "Missed" | "Passed" | "Analysis";

export type Remark = {
  pass: string;
  type: RemarkType;
  name: string;
  loopLocation?: { Line: number; Column: number };
  debugLoc?: { File: string; Line: number; Column: number };
  fn: string;
  args: [string, string][];
};

export function yaml2obj(yaml: string[]): Remark {
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
      if (curr.includes("LoopLocation:")) {
        const [_file, line, col] = curr
          .split("LoopLocation:")[1]
          .trim()
          .replace(/\'|\"/g, "")
          .split(":");

        return {
          ...acc,
          loopLocation: { Line: parseInt(line, 10), Column: parseInt(col, 10) }
        };
      }

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
}
