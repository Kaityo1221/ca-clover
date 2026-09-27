from pathlib import Path

p=Path('docs/index.html')
s=p.read_text()
old='''.community-hub-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:22px;align-items:start}.feature-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.feature-app{aspect-ratio:1;border:1px solid #d9f99d;border-radius:24px;background:linear-gradient(145deg,#fff,#f7fee7);box-shadow:0 8px 22px rgba(77,124,15,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#365314;font-weight:950;text-align:center;padding:10px;transition:.18s transform,.18s box-shadow}.feature-app:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(77,124,15,.13)}.feature-app .feature-icon{font-size:28px;line-height:1}.feature-app .feature-label{font-size:12px;line-height:1.15}'''
new='''.community-hub-layout{position:relative;display:block;min-height:0}.community-hub-layout>div:last-child{position:absolute;right:0;bottom:0;width:140px}.feature-grid{display:grid;grid-template-columns:repeat(2,66px);gap:8px;width:140px}.feature-app{width:66px;height:66px;border:1px solid #d9f99d;border-radius:17px;background:linear-gradient(145deg,#fff,#f7fee7);box-shadow:0 5px 14px rgba(77,124,15,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#365314;font-weight:950;text-align:center;padding:5px;transition:.18s transform,.18s box-shadow}.feature-app:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(77,124,15,.13)}.feature-app .feature-icon{font-size:20px;line-height:1}.feature-app .feature-label{font-size:9px;line-height:1.05}'''
assert old in s, 'desktop feature CSS not found'
s=s.replace(old,new,1)
old2='''.community-hub-layout{grid-template-columns:1fr;gap:16px}.feature-grid{max-width:330px;width:100%;margin:0 auto}.feature-app{border-radius:21px}'''
new2='''.community-hub-layout{display:block}.community-hub-layout>div:last-child{width:132px;right:0;bottom:0}.feature-grid{grid-template-columns:repeat(2,62px);gap:8px;width:132px;margin:0}.feature-app{width:62px;height:62px;border-radius:16px;padding:4px}.feature-app .feature-icon{font-size:19px}.feature-app .feature-label{font-size:9px}'''
assert old2 in s, 'mobile feature CSS not found'
s=s.replace(old2,new2,1)
s=s.replace('const VERSION="my-community-20260927-community-hub2";','const VERSION="my-community-20260927-community-hub3";',1)
p.write_text(s)
