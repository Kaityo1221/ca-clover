from pathlib import Path

p=Path('docs/index.html')
s=p.read_text()
old='.community-hub-layout>div:last-child{position:absolute;right:0;bottom:0;width:140px}'
new='.community-hub-layout>div:last-child{position:absolute;right:0;bottom:-20px;width:140px}'
assert old in s, 'desktop compact button position not found'
s=s.replace(old,new,1)
old2='.community-hub-layout>div:last-child{width:132px;right:0;bottom:0}'
new2='.community-hub-layout>div:last-child{width:132px;right:0;bottom:-24px}'
assert old2 in s, 'mobile compact button position not found'
s=s.replace(old2,new2,1)
s=s.replace('const VERSION="my-community-20260927-community-hub3";','const VERSION="my-community-20260927-community-hub4";',1)
p.write_text(s)
