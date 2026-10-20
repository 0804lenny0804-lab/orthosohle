#!/usr/bin/env python3
"""Check project agreements; optionally regenerate the Markdown backlog from CSV."""
import argparse
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
    'docs/architecture.md', 'docs/WORK_LOG.csv',
    'docs/testing/REFERENCE_BASELINE.md', 'docs/references/README.md',
    'docs/references/ORTHOSOHLE_CODEX_CONTEXT.md', 'docs/references/Hausarbeit_Orthosohle.pdf',
    'docs/references/ponytail.md', 'reference/README.md', 'reference/manifest.json',
] + [p + '/README.md' for p in [
    'apps/web', 'apps/api', 'firmware/bracelet', 'firmware/insole',
    'contracts', 'hardware', 'tests/system',
]]


def render_backlog(rows):
    text = [
        '# OrthoSohle 2.0 – Semesterbacklog', '',
        'Maßgeblich ist ORTHOSOHLE_BACKLOG.csv. Diese Ansicht wird mit '
        '`python3 scripts/check_project.py --write-backlog` erzeugt; nicht separat bearbeiten.', '',
        'Ausgangsplanung: 20.10.2026. Alle Statusänderungen brauchen belegte Abnahme. '
        'Planungsstunden × 2 ergeben tatsächliche Personenstunden als Schätzung; '
        'geleistete Einzelzeiten separat in docs/WORK_LOG.csv erfassen. '
        'Aufgaben mit mehr als 4 Planungsstunden vor Beginn in kleinere Arbeitsschritte teilen.', '',
        'A = Armband, B = Web-App, C = Analyse/Planung, D = Integration, E = Abschluss. '
        'Zuständigkeit je Aufgabe festlegen. Watch ist optional; Abschlussbudget nach Hochschulklärung neu schätzen.', '',
        '| ID | Prio | Aufgabe | Plan-h / Personen-h | Abhängig von | Abnahme | Status | Verantwortlich | Nachweis |',
        '|---|---|---|---|---|---|---|---|---|',
    ]
    def escape(value):
        return str(value).replace('|', r'\|').replace('\n', ' ')
    for row in rows:
        values = [row['ID'], row['Prioritaet'], row['Aufgabe'],
                  f"{row['Planungsstunden']} / {row['Personenstunden']}",
                  row['Abhaengigkeiten'], row['Abnahmekriterium'], row['Status'],
                  row['Verantwortlich'] or 'Offen', row['Nachweis'] or '—']
        text.append('| ' + ' | '.join(map(escape, values)) + ' |')
    text += ['', '**Summe: 300 Planungsstunden / 600 Personenstunden.**', '',
             'Budget: A 135/270, B 90/180, C 30/60, D 30/60, E 15/30. '
             'Keine zusätzliche Reserve enthalten. Eine genehmigte Neuplanung muss CSV, '
             'Budgetvorgaben im Checker und Projektstatus gemeinsam ändern.']
    return '\n'.join(text) + '\n'


def check(write_backlog=False):
    errors = []
    for item in REQUIRED:
        if not (ROOT / item).is_file():
            errors.append(f'Pflichtdatei fehlt: {item}')
    csv_path = ROOT / 'docs/ORTHOSOHLE_BACKLOG.csv'
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
        expected = render_backlog(rows)
        md_path = ROOT / 'docs/ORTHOSOHLE_BACKLOG.md'
        if write_backlog and not errors:
            md_path.write_text(expected)
        elif not md_path.exists() or md_path.read_text() != expected:
            errors.append('Backlog-Markdown veraltet; --write-backlog ausführen')
    except (OSError, KeyError, ValueError) as exc:
        errors.append(f'Backlog nicht prüfbar: {exc}')

    try:
        manifest = json.loads((ROOT / 'reference/manifest.json').read_text())
        ref = ROOT / 'reference/orthopaul'
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
    maintained = [ROOT / name for name in ['README.md', 'AGENTS.md']]
    maintained += [p for p in (ROOT / 'docs').rglob('*.md') if 'references' not in p.parts]
    maintained += [ROOT / 'reference/README.md', ROOT / 'docs/references/README.md', ROOT / 'docs/references/ponytail.md']
    for directory in ['apps', 'firmware', 'contracts', 'hardware', 'tests']:
        maintained += list((ROOT / directory).rglob('*.md'))
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-backlog', action='store_true', help='Markdown-Ansicht aus CSV erzeugen')
    args = parser.parse_args()
    sys.exit(check(args.write_backlog))
