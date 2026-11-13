# Independent Python ZIP parser: ensure compatibility with standard unzippers.
import sys,zipfile,pathlib
p=pathlib.Path('qa-artifacts/meetup-mobile/zip-compat-20.csv.zip')
with zipfile.ZipFile(p) as z:
    names=z.namelist()
    assert len(names)==20 and len(set(names))==20,names
    assert all(name.endswith('.csv') and 'コミュニティデイ' in name for name in names)
    assert z.testzip() is None,'CRC failure'
    assert all(info.compress_type==zipfile.ZIP_STORED for info in z.infolist())
    for name in names:
        content=z.read(name)
        assert content.startswith(b'\xef\xbb\xbf')
        decoded=content.decode('utf-8-sig')
        assert decoded.startswith('"username","display_name","rsvp_status"\r\n')
        assert '東京・合成参加者🍀' in decoded
        assert decoded.endswith('\r\n')
print('PASS: 20 UTF-8 Japanese filename CSV entries, BOM, CRLF, headers, CRC32 and ZIP STORE')
