# Get optimization remarks from clang directly in your source code

## This extension is still in preview and may not function

Setup:

- Ensure you have a `compile_commands.json`, see "Compilation Database" for instructions
- Make sure clang is installed and available in your path (if not in path, you can use a setting)
- If you get errors about libclang, configure the correct path for this in the settings

### Compilation database

The tool needs to know how to compile your code and it does so using a compilation database. You can read about what they are and how to create them [here](https://sarcasm.github.io/notes/dev/compilation-database.html).

If you're using cmake, there is a flag in the link telling you how to generate the compile_commands.json

Make has no built in way to generate a compilation database but you can generate one using compiledb as follows:

`pip install compiledb`
`compiledb make`

### Disclaimers

- Windows is not supported
