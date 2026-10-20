#!/usr/bin/env python3
"""Check documentation, backlog and original source integrity without extra packages."""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
BUDGET = {'A': 135, 'B': 90, 'C': 30, 'D': 30, 'E': 15}
REQUIRED = [
    'README.md', 'AGENTS.md', '.gitignore', 'docs/context.md', 'docs/decisions.md',
    'docs/analysis.md', 'docs/checks/baseline.md', 'docs/checks/api-results.json',
    'docs/sources/README.md', 'docs/sources/ORTHOSOHLE_CODEX_CONTEXT.md',
    'docs/sources/Hausarbeit_Orthosohle.pdf', 'docs/sources/ponytail.md',
    'code/README.md', 'code/manifest.json',
]


def check():
    errors = []
    for item in REQUIRED:
        if not (ROOT / item).is_file():
            errors.append(f'Pflichtdatei fehlt: {item}')
    csv_path = ROOT / 'docs/backlog.csv'
    try:
        with csv_path.open(newline='') as stream:
            rows = list(csv.DictReader(stream))
        ids = [r['ID'] for r in rows]
        if len(set(ids)) != len(ids):
            errors.append('Doppelte Backlog-IDs')
        totals = {key: 0 for key in BUDGET}
        graph = {}
        for row in rows:
            rid = row['ID']
            group = row['Arbeitspaket']
            hours = int(row['Planungsstunden'])
            if hours <= 0 or int(row['Personenstunden']) != 2 * hours:
                errors.append(f'{rid}: ungültige Stundenumrechnung')
            totals[group] += hours
            if row['Prioritaet'] not in {'P0', 'P1', 'P2', 'P3'}:
                errors.append(f'{rid}: unbekannte Priorität')
            if row['Status'] not in {'Offen', 'In Arbeit', 'Blockiert', 'Review', 'Erledigt'}:
                errors.append(f'{rid}: unbekannter Status')
            if row['Status'] in {'In Arbeit', 'Review', 'Erledigt'} and not row['Verantwortlich'].strip():
                errors.append(f'{rid}: aktive Aufgabe ohne verantwortliche Person')
            if row['Status'] == 'Erledigt' and not row['Nachweis'].strip():
                errors.append(f'{rid}: erledigte Aufgabe ohne Abnahmenachweis')
            if not row['Aufgabe'].strip() or not row['Abnahmekriterium'].strip():
                errors.append(f'{rid}: Aufgabe oder Abnahme fehlt')
            graph[rid] = [] if row['Abhaengigkeiten'] == '—' else row['Abhaengigkeiten'].split(';')
            for dep in graph[rid]:
                if dep not in ids:
                    errors.append(f'{rid}: unbekannte Abhängigkeit {dep}')
        visiting, visited = set(), set()
        def visit(node):
            if node in visiting:
                raise ValueError(f'Zyklische Backlog-Abhängigkeit bei {node}')
            if node in visited:
                return
            visiting.add(node)
            for dep in graph.get(node, []):
                visit(dep)
            visiting.remove(node)
            visited.add(node)
        for rid in ids:
            visit(rid)
        if totals != BUDGET:
            errors.append(f'Budget weicht ab: {totals}; vereinbart: {BUDGET}')
    except (OSError, KeyError, ValueError) as exc:
        errors.append(f'Backlog nicht prüfbar: {exc}')

    try:
        manifest = json.loads((ROOT / 'code/manifest.json').read_text())
        ref = ROOT / 'code/orthopaul'
        original = manifest['files']
        for name, expected_hash in original.items():
            path = ref / name
            if not path.resolve().is_relative_to(ref.resolve()):
                errors.append(f'Ungültiger Referenzpfad: {name}')
            elif not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected_hash:
                errors.append(f'Referenzdatei fehlt oder geändert: {name}')
        generated = {'node_modules', 'dist', 'build', '.pio'}
        for path in ref.rglob('*'):
            relative = path.relative_to(ref)
            if any(part in generated for part in relative.parts):
                continue
            if path.is_file() and str(relative) not in original and path.suffix not in {'.log', '.db'}:
                errors.append(f'Unerwartete Referenzdatei: {relative}')
    except (OSError, KeyError, ValueError) as exc:
        errors.append(f'Referenzmanifest nicht prüfbar: {exc}')

    # Check local inline Markdown file links in maintained docs, excluding historical source text.
    maintained = [ROOT / name for name in ['README.md', 'AGENTS.md', 'code/README.md']]
    maintained += [p for p in (ROOT / 'docs').rglob('*.md') if 'sources' not in p.parts]
    maintained += [ROOT / 'docs/sources/README.md', ROOT / 'docs/sources/ponytail.md']
    for path in maintained:
        if not path.exists():
            continue
        content = re.sub(r'```.*?```', '', path.read_text(), flags=re.S)
        for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', content):
            target = match.group(1).strip().strip('<>')
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
                continue
            target = unquote(target.split('#', 1)[0])
            if target and not (path.parent / target).exists():
                errors.append(f'{path.relative_to(ROOT)}: Linkziel fehlt: {target}')
    if errors:
        for error in errors:
            print('FEHLER:', error, file=sys.stderr)
        return 1
    print('OK: Struktur, lokale Dokumentationslinks, Backlog/300–600h, Abhängigkeiten und Referenzprüfsummen.')
    return 0


if __name__ == '__main__':
    sys.exit(check())
