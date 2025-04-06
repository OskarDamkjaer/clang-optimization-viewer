#!/usr/bin/env python

import sys

def get_info(node, depth=0):
    if depth >= 10:
        children = "MAX_DEPTH_REACHED"
    else:
        children = [get_info(c, depth + 1) for c in node.get_children()]
    return {
        "kind": node.kind,
        "usr": node.get_usr(),
        "spelling": node.spelling,
        "location": node.location,
        "extent.start": node.extent.start,
        "extent.end": node.extent.end,
        "is_definition": node.is_definition(),
        "children": children,
    }


def main():
    from cindex import Index
    from cindex import conf
    from pprint import pprint

    if len(sys.argv) < 2:
        print("must provide file path")
        sys.exit(1)

    fileName = sys.argv[1]
    args = sys.argv[1:]
    conf.set_library_file("/Library/Developer/CommandLineTools/usr/lib/libclang.dylib")
    index = Index.create()
    tu = index.parse(fileName, args)
    if not tu:
        print("unable to load input")
        sys.exit(1)

    pprint(("nodes", get_info(tu.cursor)))


if __name__ == "__main__":
    main()