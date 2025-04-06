import { ChildProcess, spawn } from "child_process";
import { once } from "events";
import { promises as fs, constants as fsConstants } from "fs";
import * as path from "path";
import * as os from "os";
import { createInterface } from "readline";
import * as vscode from "vscode";
import { log, ctx, CompileCommand } from "./extension";

type LensTemplate = {
  kind: "FunctionDecl" | "FunctionTemplate" | "ObjCInstanceMethodDecl" | "CXXMethod"
      | "Constructor" | "Destructor" | "ConversionFunction" | "LambdaExpr" | "WhileStmt"
      | "DoStmt" | "ForStmt" | "CXXForRangeStmt"
  range: vscode.Range;
};

function nodeKindToUIKind(kind: LensTemplate["kind"]) {
  switch (kind) {
    case "FunctionDecl":
    case "FunctionTemplate":
    case "ConversionFunction":
      return "function";
    case "ObjCInstanceMethodDecl":
    case "CXXMethod":
      return "method";
    case "Constructor":
      return "constructor";
    case "Destructor":
      return "destructor";
    case "LambdaExpr":
      return "lambda";
    case "WhileStmt":
    case "DoStmt":
    case "ForStmt":
    case "CXXForRangeStmt":
      return "loop";
  }
}

function selectExecutable() {
  const platform = os.platform();
  if (platform === "win32") {
    return `./find-decls-${platform}-${os.arch}.exe`;
  }
  return `./find-decls-${platform}-${os.arch}`;
}

function logDoc(s: string, doc: vscode.TextDocument) {
  log(`${doc.fileName}: ${s}`);
}

var compileCommandsDir: string | null = null;
// Look for compile_commands.json in the following order:
// 1. check for c_cpp_properties.json in workspace root, and check for path to compile commands there
// 2. check for compile_commands.json in workspace root
// 3. check for subdirectories with "build" or "out" in the name, and check for compile_commands.json there
// 4. traverse transitive parent directories from `doc` and check for compile_commands.json there
async function selectCompileCommandsDir(doc: vscode.TextDocument): Promise<string | null> {
  if (!vscode.workspace.workspaceFolders) {
    return null;
  }
  if (compileCommandsDir) {
    return compileCommandsDir;
  }
  const rootDir = vscode.workspace.workspaceFolders![0].uri.path;
  try {
    // (1)
    const propPath = path.join(rootDir, "c_cpp_properties.json");
    const content = await fs.readFile(propPath);
    const cCppProperties = JSON.parse(content.toString("utf-8"));
    const compileCommandPath = cCppProperties.configurations?.compileCommands;
    if (compileCommandPath) {
      return path.dirname(compileCommandPath);
    }
  } catch {}
  try {
    // (2)
    await fs.access(path.join(rootDir, "compile_commands.json"), fsConstants.F_OK);
    return rootDir;
  } catch {}
  try {
    // (3)
    const files = await fs.readdir(rootDir);

    for (let file in files) {
      if (!file.includes("build") && !file.includes("out")) {
        continue;
      }
      try {
        await fs.access(path.join(rootDir, file, "compile_commands.json"), fsConstants.F_OK);
      } catch {
        continue;
      }
      return file;
    }
  } catch {}
  try {
    // (4)
    var filePath = doc.uri.path;
    while (filePath.length && filePath !== "/" && filePath !== "." && filePath !== rootDir) {
      const dir = path.dirname(filePath);
      try {
        await fs.access(path.join(dir, "compile_commands.json"), fsConstants.F_OK);
      } catch {
        filePath = dir;
        continue;
      }
      return dir;
    }
  } catch {}
  return null;
}

type ParsedCompileCommand = {
  arguments: string[] | null,
  command: string | null,
  file: string,
  directory: string
};

function isValidCompileCommand(cmd: any): cmd is ParsedCompileCommand {
  return typeof cmd === "object" && typeof cmd.file === "string" && typeof cmd.directory === "string" &&
    ((cmd.arguments && Array.isArray(cmd.arguments)) || (cmd.command && typeof cmd.command === "string"));
}

function findCompileCommand(compileCommands: any[], doc: vscode.TextDocument): ParsedCompileCommand | undefined {
  const filePath = doc.uri.path;
  const absPath = path.resolve(filePath);
  for (let command of compileCommands) {
    if (!isValidCompileCommand(command)) {
      if (ctx.globalState.get("warn-malformed-compile-commands", true)) {
        vscode.window.showWarningMessage(`Found invalid compile command ${JSON.stringify(command)}`, "Don't show again").then(action => {
          if (action === "Don't show again") {
            ctx.globalState.update("warn-malformed-compile-commands", false);
          }
        });
      }
      continue;
    }
    const absCommandPath = path.resolve(command.directory, command.file);
    if (absCommandPath === absPath) {
      return command;
    }
  }

  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }
  const rootDir = vscode.workspace.workspaceFolders![0].uri.path;
  const relPath = path.relative(rootDir, filePath);
  for (let command in compileCommands) {
    if (!isValidCompileCommand(command)) {
      continue;
    }
    const relCommandPath = path.relative(command.directory, command.file);
    if (relCommandPath === relPath) {
      return command;
    }
  }
  return undefined;
}

async function getASTSlow(
  doc: vscode.TextDocument, compileCommandsDir: string
): Promise<[LensTemplate[], CompileCommand?]> {
  const compileCommandsPath = path.join(compileCommandsDir, "compile_commands.json");
  const compileCommandsContent = await fs.readFile(compileCommandsPath);
  const compileCommands = JSON.parse(compileCommandsContent.toString("utf-8"));
  if (!Array.isArray(compileCommands)) {
    if (ctx.globalState.get("err-malformed-compile-commands", true)) {
      vscode.window.showErrorMessage(`Compile commands file ${compileCommandsPath} invalid`, "Don't show again").then(action => {
        if (action === "Don't show again") {
          ctx.globalState.update("err-malformed-compile-commands", false);
        }
      });
    }
    return [[], undefined];
  }

  const command = findCompileCommand(compileCommands, doc);
  if (!command) {
    if (ctx.globalState.get("err-compile-command-missing", true)) {
      vscode.window.showErrorMessage(`Compile command for ${doc.uri.fsPath} missing in ${compileCommandsPath}`, "Don't show again").then(action => {
        if (action === "Don't show again") {
          ctx.globalState.update("err-compile-command-missing", false);
        }
      });
    }
    return [[], undefined];
  }

  let args = command.arguments ? [...command.arguments] : command.command!.split(" ");
  var binary = args.shift();
  const config = vscode.workspace.getConfiguration("opt-info");
  if (config.has("clangPath")) {
    binary = config.get("clangPath");
  }
  const cmd = `${binary} ${args.join(" ")}`;
  args.push("-Xclang");
  args.push("-ast-dump");
  args.push("-c");
  args.push("-o");
  args.push("/dev/null");
  args.push("-Wno-everything");
  const findFunctionDecls = spawn(binary!, args, {
    cwd: command.directory, shell: true,
  });

  const [err, errLines, ranges, _] = await parseCommandOutput(findFunctionDecls, true);

  if (err) {
    var message = `error while dumping AST with ${binary}.`;
    if (errLines.length) {
      message += `\nFull error message:\n${errLines.join("\n")}`;
    }
    if (ctx.globalState.get("warn-astdump-failure", true)) {
      vscode.window.showWarningMessage(message, "Don't show again").then(action => {
        if (action === "Don't show again") {
          ctx.globalState.update("warn-astdump-failure", false);
        }
      });
    }
    logDoc(message, doc);
    return [[], undefined];
  }

  logDoc("info: successful slow path", doc);
  return [ranges, { command: cmd, directory: compileCommandsDir, file: doc.fileName }];
}

function parsePosStrings(s: string): vscode.Range {
  // makes these into positions "/home/dic15oda/Desktop/code.cpp:1:1, line:10:1"
  const [start, end] = s.split(",");
  if (!(start && end)) {
    log(`failed to parse start and end location from ${s}`);
    throw new Error(s);
  }
  const [_, startLine, startChar] = start
    .split(":")
    .map((n) => parseInt(n, 10));

  let _2, endLine, endChar;
  const shortHandLocRegex = /^ col:\d+$/; // test if format is: filename:nbr:nbr, col:nbr
  if (shortHandLocRegex.test(end)) {
    endLine = startLine;
    endChar = parseInt(end.split(":")[1], 10);
  } else {
    [_2, endLine, endChar] = end.split(":").map((n) => parseInt(n, 10));
  }

  if (
    !(
      typeof startLine === "number" &&
      typeof startChar === "number" &&
      typeof endLine === "number" &&
      typeof endChar === "number"
    )
  ) {
    log(`failed to parse numbers from ${s}`);
    throw new Error(s);
  }
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

async function getAST(
  doc: vscode.TextDocument
): Promise<[LensTemplate[], CompileCommand?]> {
  const compileCommandsDir = await selectCompileCommandsDir(doc);
  log(compileCommandsDir || "no compile commands dir found");
  if (!compileCommandsDir) {
    return [[], undefined];
  }

  const findDecls = selectExecutable();
  try {
    await fs.access(path.join(__dirname, findDecls), fsConstants.F_OK);
  } catch {
    const message = `${path.join(__dirname, findDecls)} not found - platform may be unsupported. Falling back to slow path.`;
    console.log(message);
    log(message);
    if (ctx.globalState.get("warn-find-decls-not-found", true)) {
      vscode.window.showWarningMessage(message, "Don't show again").then(action => {
        if (action === "Don't show again") {
          ctx.globalState.update("warn-find-decls-not-found", false);
        }
      });
    }
    return getASTSlow(doc, compileCommandsDir);
  }

  const config = vscode.workspace.getConfiguration("opt-info");
  var ldVar = "";
  if (config.has("libClangDir")) {
    const libClangDir = config.get("libClangDir");
    if (os.platform() === "darwin") {
      ldVar = `DYLD_LIBRARY_PATH=${libClangDir}:${process.env.LD_LIBRARY_PATH} `;
    } else {
      ldVar = `LD_LIBRARY_PATH=${libClangDir}:${process.env.LD_LIBRARY_PATH} `;
    }
  }
  const findFunctionDecls = spawn(`${ldVar}${findDecls}`, [compileCommandsDir, doc.fileName], {
    cwd: __dirname, shell: true,
  });

  const [err, errLines, ranges, compileCommand] = await parseCommandOutput(findFunctionDecls, false);
  if (err) {
    var message = `error while running ${findDecls} - you may need to adjust the opt-info.libClangDir setting, or compile_commands.json may be missing. Falling back to slow path.`;
    if (errLines.length) {
      message += `\nFull error message:\n${errLines.join("\n")}`;
    }
    if (ctx.globalState.get("warn-libclangdir", true)) {
      vscode.window.showWarningMessage(message, "Don't show again").then(action => {
        if (action === "Don't show again") {
          ctx.globalState.update("warn-libclangdir", false);
        }
      });
    }
    log(message);
    return getASTSlow(doc, compileCommandsDir);
  }

  return [ranges, {command: compileCommand!, directory: compileCommandsDir, file: doc.fileName}];
}

function startsWithCapitalLetter(s: string): boolean {
  const char = s.charCodeAt(0);
  return char >= 'A'.charCodeAt(0) && char <= 'Z'.charCodeAt(0);
}

function parseKindSlowPath(l: string): string {
  while (l.length && !startsWithCapitalLetter(l)) {
    l = l.substring(1);
  }
  return l.split(" ")[0];
}

async function parseCommandOutput(findFunctionDecls: ChildProcess, isSlowPath: boolean): Promise<[boolean, string[], LensTemplate[], string?]> {
  var err = false;
  const errLines: string[] = [];
  findFunctionDecls.on("error", (data) => {
    console.log(data.toString());
    log(`on error: ${data.toString()}`);
    vscode.window.showErrorMessage(data.toString());
    err = true;
  });

  findFunctionDecls.stderr?.on("data", (data) => {
    console.log(data.toString());
    log(`on stderr.data: ${data.toString()}`);
    vscode.window.showErrorMessage(data);
    err = true;
    errLines.push(data.toString());
  });

  findFunctionDecls.on("close", (_code) => {
    /* already sent an error message */
  });

  let ranges: LensTemplate[] = [];
  const rl = createInterface({ input: findFunctionDecls.stdout! });
  let compileCommand: string | undefined = undefined;

  //rl.on("line", l => {
  for await (const l of rl) {
    // example line for slow path output: " | |-FunctionDecl 0x13115b310 <line:95:1, line:195:1> line:95:5 main 'int (int, const char **)'"
    // example line for fast path output: "FunctionDecl;<test.c:95:1, line:195:1>"

    // first line is compilecommand
    if (!compileCommand && !isSlowPath) {
      compileCommand = l;
      continue;
    }

    const kind = isSlowPath ? parseKindSlowPath(l) : l.split(";")[0];
    switch (kind) {
      case "FunctionDecl":
      case "FunctionTemplate":
      case "ObjCInstanceMethodDecl":
      case "CXXMethod":
      case "Constructor":
      case "Destructor":
      case "ConversionFunction":
      case "LambdaExpr":
      case "WhileStmt":
      case "DoStmt":
      case "ForStmt":
      case "CXXForRangeStmt":
        break;
      default:
        if (isSlowPath) {
          // entire AST is dumped for slow path
          continue;
        }
        log(`error: Unexpected lens-kind: ${kind}`);
        throw Error(`Unexpected lens-kind: ${kind}`);
    }

    const posString = /<([^]+?)>/.exec(l)![1];
    if (posString.split(",").length === 2) {
      const range = parsePosStrings(posString);
      ranges.push({ kind, range });
    } else {
      log(`expected source location, got '${posString}'`);
    }
  }

  return [err, errLines, ranges, compileCommand];
}

export class CodelensProvider implements vscode.CodeLensProvider {
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const [lensTemplates, compileCommand] = await getAST(document);
    if (!compileCommand) {
      return [];
    }

    return lensTemplates.map(
      ({ range, kind }) =>
        new vscode.CodeLens(
          /* range should only span one line */
          new vscode.Range(
            range.start.line - 1,
            range.start.character,
            range.start.line - 1,
            range.start.character
          ),
          {
            title: `Show remarks for this ${nodeKindToUIKind(kind)}`,
            command: "extension.addRemark",
            arguments: [range, compileCommand],
          }
        )
    );
  }
}
