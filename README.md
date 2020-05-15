# NOT READY FOR OUTSIDE USERS
# Get optimization remarks from clang directly in your source code

# Requirements

## A recent version of clang

Tested with clang 9 and 10.

## A compilation database

The tool needs to know how to compile your code and it does so using a compilation database. You can read about what they are and how to create them [here](https://sarcasm.github.io/notes/dev/compilation-database.html).

If you're using cmake, there is a flag in the link telling you how to generate the compile_commands.json

Make has no built in way to generate a compilation database but you can generate one using compiledb as follows:

`pip install compiledb`
`compiledb make`

## A linux or mac computer

Currently the tool does not support on windows.
