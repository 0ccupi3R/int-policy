import json,re,pathlib,hashlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check_current():
 g=ROOT/'generated';(g/'validation.json').unlink(missing_ok=True)
 if not (g/'manifest.json').exists():raise ValueError('No successful generation; run tools/generate.py')
 m=json.loads((g/'manifest.json').read_text());cp=pathlib.Path(m['config']);cp=cp if cp.is_absolute() else ROOT/cp
 paths={'config':cp,'types':ROOT/'config/types.json','generator':ROOT/'tools/generate.py','policies':g/'policies.json','template':g/'main.json','parameters':g/'parameters.json'}
 for k,p in paths.items():
  if not p.exists() or digest(p)!=m['hashes'][k]:raise ValueError('Stale generation: '+k)
 return json.loads(cp.read_text())
def match(name,pattern):return re.fullmatch(''.join('[0-9]' if x=='#' else '[A-Za-z]' if x=='?' else '.' if x=='.' else re.escape(x) for x in pattern),name,re.I) is not None
def evaluate(cond,resource):
 if 'allOf' in cond:return all(evaluate(x,resource) for x in cond['allOf'])
 if 'anyOf' in cond:return any(evaluate(x,resource) for x in cond['anyOf'])
 if 'not' in cond:return not evaluate(cond['not'],resource)
 value=resource[cond['field']]
 if 'equals' in cond:return value.lower()==cond['equals'].lower()
 if 'matchInsensitively' in cond:return match(value,cond['matchInsensitively'])
 raise ValueError('Unsupported test condition '+str(cond))
def main():
 c=check_current();template=json.loads((ROOT/'generated/main.json').read_text());items=json.loads((ROOT/'generated/policies.json').read_text());defs={r['name']:r for r in template['resources'] if r['type']=='Microsoft.Authorization/policyDefinitions'};count=0
 def expect(t,name,loc,noncompliant,typ=None):
  nonlocal count
  rule=defs[c['policyPrefix']+'-'+t['key']]['properties']['policyRule']['if']
  actual=evaluate(rule,{'name':name,'location':loc,'type':typ or t['resourceType']});assert actual==noncompliant,(t['key'],name,loc,actual,noncompliant);count+=1
 for t in items:
  for r in t['rules']:
   name=r['pattern'].replace('##','01');expect(t,name,r['location'],False);expect(t,name+'-extra',r['location'],True);expect(t,name,'eastus',True);expect(t,name,r['location'],False,'Microsoft.Test/uncovered');expect(t,name.upper(),r['location'],False);expect(t,name,'canadaeast' if r['location']=='canadacentral' else 'canadacentral',True)
  for p in t['forbiddenPatterns']:expect(t,p,'canadacentral' if '-cc-' in p else 'canadaeast',True)
 vm=next(t for t in items if t['key']=='vm')
 for r in vm['rules']:
  for n in range(1,100):expect(vm,r['pattern'].replace('##',str(n).zfill(2)),r['location'],False)
  for n in ['00','001','a1','1','100']:expect(vm,r['pattern'].replace('##',n),r['location'],True)
 kv=next(t for t in items if t['key']=='kv');assert all(3<=len(r['pattern'])<=24 for r in kv['rules'])
 assert template['parameters']['effect']['defaultValue']=='Audit'
 assert len(defs)==len(items)==25
 assert len(template['resources'])==27
 for d in defs.values():assert d['properties']['policyRule']['then']['effect']=="[[parameters('effect')]"
 params=json.loads((ROOT/'generated/parameters.json').read_text());assert params['parameters']['effect']['value']==c['effect']
 report={'localAssertions':count,'definitions':len(defs),'deploymentResources':27,'status':'passed','configuration':{'displayName':c['displayName'],'organization':c['organization'],'effect':c['effect'],'enforcementMode':c['enforcementMode']},'bicepCompiled':False,'azureValidated':False,'azureDeployed':False,'note':'Tests evaluate generated condition trees locally, not the Azure Policy engine.'}
 (ROOT/'generated/validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':
 try:main()
 except Exception as e:print('FAIL:',str(e),file=sys.stderr);sys.exit(1)
