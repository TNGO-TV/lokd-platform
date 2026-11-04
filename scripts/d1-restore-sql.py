#!/usr/bin/env python3
"""Validate a D1 SQL export and order restore without replaying trigger effects."""
import re
import sqlite3
import sys
from pathlib import Path


def prepare(source):
    statements = []
    current = ''
    for char in source:
        current += char
        if char == ";" and sqlite3.complete_statement(current):
            statements.append(current.strip())
            current = ''
    if re.sub(r'--[^\n]*', '', current).strip():
        raise ValueError('Incomplete SQL export')
    groups = {key: [] for key in ('table', 'data', 'view', 'index', 'trigger')}
    for statement in statements:
        plain = re.sub(r'/\*.*?\*/|--[^\n]*', '', statement, flags=re.S).strip()
        if not plain:
            continue
        if re.match(r'^(BEGIN|COMMIT|END|PRAGMA)\b', plain, re.I):
            continue
        match = re.match(r'^CREATE\s+(?:UNIQUE\s+)?(TABLE|VIEW|INDEX|TRIGGER)\b', plain, re.I)
        if match:
            groups[match[1].lower()].append(statement)
        elif re.match(r'^(INSERT|DELETE FROM ["`]?sqlite_sequence)\b', plain, re.I):
            groups['data'].append(statement)
        else:
            raise ValueError('Unexpected SQL statement in export')
    # D1 enforces foreign keys; defer until the import transaction finishes.
    ordered = 'PRAGMA defer_foreign_keys=ON;\n' + '\n'.join(s for group in groups.values() for s in group) + '\n'
    with sqlite3.connect(':memory:') as db:
        db.execute('PRAGMA foreign_keys=OFF')
        db.executescript(ordered)
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Export failed SQLite integrity validation')
    return ordered


if __name__ == '__main__':
    Path(sys.argv[2]).write_text(prepare(Path(sys.argv[1]).read_text()))
