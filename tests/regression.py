import pathlib,tempfile,shutil,subprocess,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
checks=0
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d)/'package';shutil.copytree(ROOT,p)
 def run(script,success):
  global checks
  r=subprocess.run(['python3',str(p/script)],capture_output=True,text=True)
  assert (r.returncode==0)==success,(script,r.stdout,r.stderr);checks+=1
 def change(fn):
  path=p/'config/customer.json';c=json.loads(path.read_text());fn(c);path.write_text(json.dumps(c))
 run('tools/generate.py',True);run('tests/offline.py',True)
 change(lambda c:c['typePurposes'].pop('kv'))
 run('tools/generate.py',False);run('tests/offline.py',False)
 assert not (p/'generated/main.json').exists();checks+=1
 change(lambda c:c['typePurposes'].update(kv=['core','apps']))
 run('tools/generate.py',True);run('tests/offline.py',True)
 change(lambda c:c.update(displayName='CustomerName Updated'))
 run('tests/offline.py',False)
 run('tools/generate.py',True);run('tests/offline.py',True)
 change(lambda c:c.update(organization='bad#prefix'))
 run('tools/generate.py',False);run('tests/offline.py',False)
 # New organization and four-letter subscription code are read from config, not test literals.
 change(lambda c:c.update(organization='cust02',subscriptionCode='prda'))
 run('tools/generate.py',True);run('tests/offline.py',True)
 # Generated output tampering must be detected.
 f=p/'generated/main.json';f.write_text(f.read_text()+' ')
 run('tests/offline.py',False)
print('PASS:',checks,'regression checks: failure invalidation, stale config, tampering, variable prefix and four-letter subscription code.')
