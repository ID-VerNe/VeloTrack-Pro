import re

with open('docs/audit_report.md', 'r', encoding='utf-8') as f:
    text = f.read()

patterns = [r'\bTODO\b', r'\bFIXME\b', r'\bTBD\b', r'\bPLACEHOLDER\b', r'待定', r'未完成', r'占位符']
for p in patterns:
    matches = [(m.start(), text[max(0, m.start()-40):min(len(text), m.end()+40)]) for m in re.finditer(p, text, re.IGNORECASE)]
    print(f'Pattern "{p}": {len(matches)} matches')
    for pos, snippet in matches[:5]:
        print(f'   Snippet: {snippet.strip().replace(chr(10), " ")}')
