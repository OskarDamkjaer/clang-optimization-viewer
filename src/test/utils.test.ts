test("loop id", function() {
  function loopRangeBestEffort(text: string) {
    // TODO ett pass för att  loop och starter
    const regexSrc = /(for\s*\(|while\s*\()/g;
    const regex = new RegExp(regexSrc);
    let line = 0;
    let column = 0;
    let inLoop = false;
    let charsToFind = [];
    const lines = text.split("\n");

    for (const line of lines) {
      if (regex.test(line)) {
        inLoop = true;
        charsToFind = [")", "{", "}"];
        const restOfLine = line.split(regex)[1].split("");
        for (const char of restOfLine) {
          if (char === charsToFind[0]) {
            charsToFind = charsToFind.slice(2);
            if (charsToFind.length === 0) {
              // BREAK, LOOP END
            }
          }
        }
      }
    }
  }
  expect(loopRangeBestEffort(fn1)).toEqual("");
});

const fn1 = `void a()
{
    int sum[1000] = {1, 2, 3, 4, 5};
    for (int i = 1; i < 1000; i++)
    {
        sum[0] = sum[i - 1];
    }
}`;
