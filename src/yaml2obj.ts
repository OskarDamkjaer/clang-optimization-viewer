const dummy = [
  "--- !Analysis",
  "Pass:            asm-printer",
  "Name:            InstructionCount",
  "DebugLoc:        { File: 'opt-info/test/code.c', Line: 1, Column: 0 }",
  "Function:        main",
  "Args:",
  "- NumInstructions: '20'",
  "- String:          ' instructions in function",
  "..."
];

type Remark = {
  type: string;
  name: string;
  debugLoc: string;
  fn: string;
  args: string[];
};

export function yaml2obj(yaml: string[]): Remark {
  // todo proper reqursive parser/lib?
  function reducer(acc: any, c: string): any {
    const curr = c.replace(/'/g, "");
    if (curr.startsWith("---")) {
      const type = curr.split("!")[1].trim();
      return { ...acc, type };
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
        .map(([key, val]) => ({ [key]: val }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});

      return { ...acc, debugLoc };
    }
    if (curr.startsWith("Function:")) {
      const fn = curr.split(":")[1].trim();
      return { ...acc, fn };
    }

    if (curr.startsWith("Args")) {
      return acc;
    }

    if (curr.startsWith("-")) {
      const [key, val] = curr
        .slice(2)
        .split(":")
        .map(s => s.trim());
      const newArg = { [key]: val };
      return { ...acc, args: acc.args ? acc.args.concat(newArg) : [newArg] };
    }

    if (curr.startsWith("...")) {
      return acc;
    }

    return acc;
  }
  return yaml.reduce(reducer, {});
}
