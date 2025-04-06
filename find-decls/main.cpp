// build using `c++ find-decls/main.cpp -Ifind-decls/include/ -std=c++17 -L<path-to-libclang-dir> -lclang -o find-decls-<platform>-<arch>`
#include <clang-c/Index.h>
#include <clang-c/CXCompilationDatabase.h>
#include <iostream>
#include <filesystem>
namespace fs = std::filesystem;

bool should_print(CXCursorKind kind)
{
    switch (kind)
    {
    case CXCursor_FunctionDecl:
    case CXCursor_FunctionTemplate:
    case CXCursor_ObjCInstanceMethodDecl:
    case CXCursor_CXXMethod:
    case CXCursor_Constructor:
    case CXCursor_Destructor:
    case CXCursor_ConversionFunction:
    case CXCursor_LambdaExpr:
    case CXCursor_WhileStmt:
    case CXCursor_DoStmt:
    case CXCursor_ForStmt:
    case CXCursor_CXXForRangeStmt:
        return true;
    default:
        return false;
    }
}

class SmartString {
    CXString s;
public:
    SmartString(CXString s) : s(s) {}
    ~SmartString() {
        clang_disposeString(s);
    }

    const char *str() {
        return clang_getCString(s);
    }
};

void print_location(CXSourceLocation loc, bool is_end) {
    CXFile file;
    unsigned line, column, offset;
    clang_getExpansionLocation(loc, &file, &line, &column, &offset);
    if (is_end)
        std::cout << "line";
    else {
        SmartString file_name{clang_getFileName(file)};
        std::cout << file_name.str();
    }
    std::cout << ":" << line << ":" << column;
}

CXCompileCommand find_compile_command(CXCompileCommands cmds, const char *file_name) {
    unsigned n_cmds = clang_CompileCommands_getSize(cmds);
    fs::path file_path{file_name};
    fs::path abs_path = fs::absolute(file_path);

    // start by comparing absolute paths
    for (unsigned i = 0; i < n_cmds; i++) {
        CXCompileCommand cmd = clang_CompileCommands_getCommand(cmds, i);
        SmartString s{clang_CompileCommand_getFilename(cmd)};
        fs::path cmd_path{s.str()};
        SmartString s2{clang_CompileCommand_getDirectory(cmd)};
        fs::path cmd_dir{s2.str()};
        if (!cmd_path.is_absolute())
            cmd_path = cmd_dir / cmd_path;
        if (!cmd_path.is_absolute())
            cmd_path = fs::absolute(cmd_path);
        if (abs_path.lexically_normal() == cmd_path.lexically_normal())
            return cmd;
    }

    // fall back to comparing relative paths
    fs::path rel_path = file_path;
    if (!rel_path.is_relative())
        rel_path = fs::relative(rel_path);
    for (unsigned i = 0; i < n_cmds; i++) {
        CXCompileCommand cmd = clang_CompileCommands_getCommand(cmds, i);
        SmartString s{clang_CompileCommand_getFilename(cmd)};
        fs::path cmd_path{s.str()};
        SmartString s2{clang_CompileCommand_getDirectory(cmd)};
        fs::path cmd_dir{s2.str()};
        if (!cmd_path.is_relative())
            cmd_path = fs::relative(cmd_path, cmd_dir);
        if (rel_path.lexically_normal() == cmd_path.lexically_normal())
            return cmd;
    }

    return nullptr;
}

int main(int argc, const char *argv[argc])
{
    if (argc < 3) {
        std::cerr << "error: too few arguments provided.\n"
            << "Must provide path to directory containing compile_commands.json, and path to source file\n";
        return 1;
    }
    CXCompilationDatabase_Error error_code;
    CXCompilationDatabase db = clang_CompilationDatabase_fromDirectory(argv[1], &error_code);
    if (error_code) {
        std::cerr << "Failed to open compile_commands.json in " << argv[1] << "\n";
        return 1;
    }
    CXCompileCommands all_commands = clang_CompilationDatabase_getAllCompileCommands(db);
    if (clang_CompileCommands_getSize(all_commands) < 1) {
        std::cerr << "No compile commands found in compile_commands.json\n";
        return 1;
    }
    const char *file_name = argv[2];
    CXCompileCommand command = find_compile_command(all_commands, file_name);
    if (!command) {
        std::cerr << "No compile command found for " << file_name << "\n";
        return 1;
    }

    unsigned n_compile_args = clang_CompileCommand_getNumArgs(command);
    CXString *arg_strings = new CXString[n_compile_args];
    const char **compile_args = new const char*[n_compile_args];
    for (unsigned i = 0; i < n_compile_args; i++) {
        arg_strings[i] = clang_CompileCommand_getArg(command, i);
        compile_args[i] = clang_getCString(arg_strings[i]);
        std::cout << compile_args[i];
        if (i < n_compile_args - 1) std::cout << " ";
    }
    std::cout << "\n";
      
    CXIndex index = clang_createIndex(0, 0);
    CXTranslationUnit unit;
    enum CXErrorCode err = clang_parseTranslationUnit2(
        index,
        file_name, nullptr, 0,
        nullptr, 0,
        CXTranslationUnit_None, &unit);
    for (unsigned i = 0; i < n_compile_args; i++) {
        clang_disposeString(arg_strings[i]);
    }
    delete[] compile_args;
    delete[] arg_strings;
    clang_CompileCommands_dispose(all_commands);
    clang_CompilationDatabase_dispose(db);

    if (err) {
        switch(err) {
            case CXError_Failure:
                std::cerr << "error: unable to parse translation unit\n";
                break;
            case CXError_Crashed:
                std::cerr << "error: libclang crashed during parsing\n";
                break;
            case CXError_InvalidArguments:
                std::cerr << "error: invalid arguments passed to libclang\n";
                break;
            case CXError_ASTReadError:
                std::cerr << "error: AST deserialization failed\n";
                break;
            default:
                std::cerr << "error: unknown error occurred during parsing\n";
                break;
        }
        return 1;
    }

    CXCursor cursor = clang_getTranslationUnitCursor(unit);

    clang_visitChildren(
        cursor,
        [](CXCursor current_cursor, CXCursor parent, CXClientData client_data)
        {
            CXSourceRange cursor_range = clang_getCursorExtent(current_cursor);
            CXSourceLocation start_loc = clang_getRangeStart(cursor_range);
            if (!clang_Location_isFromMainFile(start_loc))
                // we don't care about contents in headers
                return CXChildVisit_Continue;

            CXCursorKind kind = clang_getCursorKind(current_cursor);
            if (!should_print(kind))
                return CXChildVisit_Recurse;

            SmartString kind_spelling{clang_getCursorKindSpelling(kind)};
            std::cout << kind_spelling.str() << ";<";
        
            print_location(start_loc, false);
            std::cout << ", ";
            print_location(clang_getRangeEnd(cursor_range), true);

            std::cout << ">\n";
            return CXChildVisit_Recurse;
        },
        nullptr);
    return 0;
}