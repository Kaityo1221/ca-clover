from pathlib import Path
p=Path('docs/index.html')
s=p.read_text(encoding='utf-8')
old='<script src="./clover-garden.js?v=20260926-1" defer></script>'
new='<script src="./clover-garden.js?v=20260926-scrapbook1" defer></script>'
if new not in s:
    if old not in s:
        raise SystemExit('clover-garden loader not found')
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
