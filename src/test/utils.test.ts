test("loop id", function() {
  function nestedLoop(text: string) {}
  function loopRangeBestEffort(text: string) {
    // TODO ett pass för att  loop och starter
    const regexSrc = /(for\s*\(|while\s*\()/g;
    const regex = new RegExp(regexSrc);
    let inLoop = false;
    let charsToFind: string[] = [];
    const lines = text.split("\n");
    const found = [];
    const position: any = [];

    for (let lineNbr = 0; lineNbr < lines.length; lineNbr++) {
      const line = lines[lineNbr];
      if (!inLoop) {
        if (regex.test(line)) {
          found.push("for(");
          position.push({ line: lineNbr, column: 0 });
          inLoop = true;
          charsToFind = [")", "{", "}"];
          const restOfLine = line.split(regex)[2].split("");
          for (const char of restOfLine) {
            if (char === charsToFind[0]) {
              charsToFind = charsToFind.slice(1);
              found.push(char);
            }
          }
        }
      } else {
        for (let charNbr = 0; charNbr < line.split("").length; charNbr++) {
          const char = line.split("")[charNbr];
          if (char === charsToFind[0]) {
            charsToFind = charsToFind.slice(1);
            found.push(char);
            if (charsToFind.length === 0) {
              position.push({ line: lineNbr, column: charNbr });
              inLoop = false;
            }
          }
        }
      }
    }
    return position;
  }

  expect(loopRangeBestEffort(fn1)).toEqual([
    { column: 0, line: 3 },
    { column: 4, line: 6 }
  ]);
  expect(loopRangeBestEffort(fn2)).toEqual([
    { column: 0, line: 2 },
    { column: 4, line: 3 },
    { column: 0, line: 5 },
    { column: 4, line: 6 }
  ]);
  expect(loopRangeBestEffort(fn3)).toEqual([
    { column: 0, line: 2 },
    { column: 0, line: 4 },
    { column: 4, line: 7 }
  ]);
});

const fn1 = `void a()
{ 
  int sum[1000] = {1, 2, 3, 4, 5};
    for (int i = 1; i < 1000; i++)
    {
        sum[0] = sum[i - 1];
    }
}`;

const fn2 = `void a() {
    int sum[1000] = {1, 2, 3, 4, 5};
    for (int i = 1; i < 1000; i++) {
    }

    for (;1000; i++) {
    }
}`;

const fn3 = `void a() { 
  int sum[1000] = {1, 2, 3, 4, 5};
  for (int i = 1; i < 1000; i++)
  {
    for (int i = 1; i < 1000; i++)
    {
        sum[0] = sum[i - 1];
    }
  }
}`;
