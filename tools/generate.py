import json,re,pathlib,hashlib,argparse,os
ROOT=pathlib.Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,obj):
 tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(obj,indent=2)+'\n');os.replace(tmp,p)
def build(c,types):
 o=c['organization'].lower();s=c['subscriptionCode'];prefix=c['policyPrefix']
 if not re.fullmatch('[a-z][a-z0-9]{1,11}',o):raise ValueError('organization must be 2-12 alphanumeric characters starting with a letter')
 if s not in ['con','mgt','idn','sec','dapl','prda','efi','efa','aia']:raise ValueError('Unknown subscriptionCode')
 if not re.fullmatch('[a-z][a-z0-9-]{0,39}',prefix):raise ValueError('Invalid policyPrefix')
 if c['effect'] not in ['Audit','Deny','Disabled'] or c['enforcementMode'] not in ['Default','DoNotEnforce']:raise ValueError('Invalid effect/enforcement mode')
 if c['regions']!={'canadacentral':'cc','canadaeast':'ce'}:raise ValueError('Only reviewed cc/ce region mapping is supported')
 for k in ['purposes','vmRoles','storageComponents','serverNames']:
  if not c[k] or any(not re.fullmatch('[a-z][a-z0-9]*',v) for v in c[k]):raise ValueError('Invalid '+k)
 out=[]
 for t in types:
  ps=c.get('typePurposes',{}).get(t['key'],c['purposes'])
  if not ps or any(not re.fullmatch('[a-z][a-z0-9]*',v) for v in ps):raise ValueError('Invalid typePurposes for '+t['key'])
  rules=[];forbidden=[]
  for loc,r in c['regions'].items():
   base=f'{o}-{s}-{r}';style=t['style'];abbr=t['abbreviation']
   if style=='vm':
    patterns=[f'{base}-{v}##-vm' for v in c['vmRoles']];forbidden += [f'{base}-{v}00-vm' for v in c['vmRoles']]
   elif style=='nsg':patterns=[f'{base}-hub-vnet-nsg-{v}' for v in ps]
   elif style=='server':patterns=[f'{base}-{v}-{abbr}' for v in c['serverNames']]
   elif style=='lb':patterns=[f'{base}-{v}-{a}' for v in c['serverNames'] for a in ['lbi','lbe']]
   elif style=='gateway':patterns=[f'{base}-hub-vng-{a}' for a in ['vpn','er']]
   elif style=='storage':patterns=[f'{o}{s}{r}{v}sa' for v in c['storageComponents']]
   elif style=='compact':patterns=[f'{o}{s}{r}{v}{abbr}' for v in ps]
   else:patterns=[f'{base}-{v}-{abbr}' for v in ps]
   for pattern in patterns:
    sample=pattern.replace('##','01')
    minimum,maximum=t['minLength'],t['maxLength']
    if not minimum<=len(sample)<=maximum:raise ValueError(f"{t['key']}: {pattern!r} has {len(sample)} characters; allowed {minimum}-{maximum}. Set typePurposes.{t['key']} to approved shorter tokens; no automatic truncation.")
    if style in ['storage','compact'] and not re.fullmatch('[a-z0-9]+',sample):raise ValueError('Compact character constraint')
    if t['key']=='kv' and ('--' in sample or not re.fullmatch('[a-z][a-z0-9-]*[a-z0-9]',sample)):raise ValueError('Key Vault character constraint')
    rules.append({'location':loc,'pattern':pattern})
  if len(rules)>100 or len(forbidden)>100:raise ValueError('Value-count list exceeds reviewed limit')
  out.append({**t,'rules':rules,'forbiddenPatterns':forbidden})
 return out

def policy_rule(t):
 allowed={'anyOf':[{'allOf':[{'field':'location','equals':r['location']},{'field':'name','matchInsensitively':r['pattern']}]} for r in t['rules']]}
 invalid=[{'not':allowed}]
 if t['forbiddenPatterns']:
  invalid.append({'anyOf':[{'field':'name','matchInsensitively':v} for v in t['forbiddenPatterns']]})
 return {'if':{'allOf':[{'field':'type','equals':t['resourceType']},{'anyOf':invalid}]},'then':{'effect':"[parameters('effect')]"}}

def arm(c,items):
 prefix=c['policyPrefix'];defs=[];refs=[]
 for t in items:
  name=prefix+'-'+t['key'];rid=f"[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '{name}')]"
  # Escape policy expression so ARM delivers it literally to Azure Policy.
  rule=policy_rule(t);rule['then']['effect']="[[parameters('effect')]"
  defs.append({'type':'Microsoft.Authorization/policyDefinitions','apiVersion':'2023-04-01','name':name,'properties':{'displayName':c['displayName']+' naming - '+t['key'],'description':t['source'],'mode':'All','metadata':{'category':'Naming','version':'2.0.0'},'parameters':{'effect':{'type':'String','allowedValues':['Audit','Deny','Disabled'],'defaultValue':'Audit'}},'policyRule':rule}})
  refs.append({'policyDefinitionId':rid,'policyDefinitionReferenceId':t['key'],'parameters':{'effect':{'value':"[[parameters('effect')]"}}})
 initiative=prefix+'-initiative';assignment=prefix+'-test';iid=f"[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '{initiative}')]"
 defs.append({'type':'Microsoft.Authorization/policySetDefinitions','apiVersion':'2023-04-01','name':initiative,'dependsOn':[r['policyDefinitionId'] for r in refs],'properties':{'displayName':c['displayName']+' naming initiative','parameters':{'effect':{'type':'String','allowedValues':['Audit','Deny','Disabled'],'defaultValue':'Audit'}},'policyDefinitions':refs}})
 defs.append({'type':'Microsoft.Authorization/policyAssignments','apiVersion':'2023-04-01','name':assignment,'dependsOn':[iid],'properties':{'displayName':c['displayName']+' naming audit','policyDefinitionId':iid,'enforcementMode':"[parameters('enforcementMode')]",'notScopes':"[parameters('notScopes')]",'parameters':{'effect':{'value':"[parameters('effect')]"}}}})
 return {'$schema':'https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#','contentVersion':'2.0.0.0','parameters':{'effect':{'type':'string','defaultValue':'Audit','allowedValues':['Audit','Deny','Disabled']},'enforcementMode':{'type':'string','defaultValue':'Default','allowedValues':['Default','DoNotEnforce']},'notScopes':{'type':'array','defaultValue':[]}},'resources':defs,'outputs':{'assignmentId':{'type':'string','value':f"[subscriptionResourceId('Microsoft.Authorization/policyAssignments', '{assignment}')]"}}}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default=str(ROOT/'config/customer.json'));a=ap.parse_args();cp=pathlib.Path(a.config).resolve();g=ROOT/'generated';g.mkdir(exist_ok=True)
 for f in ['policies.json','main.json','parameters.json','manifest.json','validation.json']:(g/f).unlink(missing_ok=True)
 c=json.loads(cp.read_text());tp=ROOT/'config/types.json';items=build(c,json.loads(tp.read_text()));template=arm(c,items)
 write(g/'policies.json',items);write(g/'main.json',template)
 write(g/'parameters.json',{'$schema':'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#','contentVersion':'2.0.0.0','parameters':{'effect':{'value':c['effect']},'enforcementMode':{'value':c['enforcementMode']},'notScopes':{'value':c.get('notScopes',[])}}})
 write(g/'manifest.json',{'config':str(cp.relative_to(ROOT)) if cp.is_relative_to(ROOT) else str(cp),'hashes':{'config':digest(cp),'types':digest(tp),'generator':digest(pathlib.Path(__file__)),'policies':digest(g/'policies.json'),'template':digest(g/'main.json'),'parameters':digest(g/'parameters.json')}})
 print(f"Generated {len(items)} definitions for {c['displayName']} / {c['organization']}; effect={c['effect']}; enforcement={c['enforcementMode']}")
if __name__=='__main__':main()
