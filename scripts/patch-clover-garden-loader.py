from pathlib import Path

p=Path('docs/index.html')
s=p.read_text(encoding='utf-8')
needle='<script src="./home-clover.js?v=20260926-stage2" defer></script>'
insert=needle+'\n<script src="./clover-garden.js?v=20260926-1" defer></script>'
if insert not in s:
    if needle not in s:
        raise SystemExit('home-clover loader not found')
    s=s.replace(needle,insert,1)
p.write_text(s,encoding='utf-8')
