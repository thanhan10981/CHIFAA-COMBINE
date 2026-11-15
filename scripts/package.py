from pathlib import Path
import zipfile, hashlib, json

root=Path(__file__).resolve().parent.parent
target=root/'output'/'CHIFAA_DEV_PACKAGE.zip'
items=['.gitignore','.gitattributes','.npmrc','package.json','package-lock.json','README.md','TASKS.md','HANDOFF.md','CHANGELOG.md','MAPPING_GIAO_DIEN.md','src','scripts','tests','docs','source','assets','dist']
files=[]
for item in items:
    p=root/item
    files.extend([p] if p.is_file() else [f for f in p.rglob('*') if f.is_file() and '__pycache__' not in f.parts])
for item in ['verifier/package.json','verifier/package-lock.json','verifier/server.mjs','verifier/Dockerfile','output/chifaa-dev/CHIFAA_DEV.xlsx','output/chifaa-dev/verification.json','output/CHIFAA_APP.html','output/CHIFAA_PHAT_THAO_LOGO_MOI.html','output/demo.html','output/test-results.txt']:
    files.append(root/item)
manifest={str(f.relative_to(root)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED)as z:
    for f in files:z.write(f,str(f.relative_to(root)))
    z.writestr('PACKAGE_MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
with zipfile.ZipFile(target)as z:
    assert z.testzip() is None
    names=z.namelist()
    assert not any('node_modules/'in n or n.endswith('.clasp.json')or'/'.join(n.split('/')).startswith('.env') for n in names)
print(json.dumps({'file':str(target),'files':len(files),'bytes':target.stat().st_size,'zipVerified':True},ensure_ascii=False))
