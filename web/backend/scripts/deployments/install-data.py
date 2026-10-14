#!/usr/bin/python3
"""Install the published private data bridge without replacing the network guard."""
import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile
def require(ok,message):
    if not ok: raise RuntimeError(message)
def digest(data): return hashlib.sha256(data).hexdigest()
def git(root,*args):
    return subprocess.check_output(['runuser','-u',(os.environ.get('LUXISOFT_DEPLOY_SERVICE_USER') or json.loads(pathlib.Path('/etc/luxipanel-deployment-runtime.json').read_text())['serviceUser']),'--','git','-c','safe.directory='+str(root),'-C',str(root),*args],text=True).strip()
require(os.geteuid()==0,'root_required')
provider=pathlib.Path(__file__).resolve().parents[3]
consumer=pathlib.Path(sys.argv[1]).resolve()
for root in [provider,consumer]:
    require(not git(root,'status','--porcelain'),'uncommitted_release')
    require(git(root,'rev-parse','HEAD')==git(root,'ls-remote','origin','refs/heads/main').split()[0],'unpublished_release')
policyfile=pathlib.Path('/etc/luxisoft-development-runtime/policy.json')
policy=json.loads(policyfile.read_text())
require(policyfile.stat().st_uid==0 and policyfile.stat().st_mode & 0o022==0,'unsafe_policy')
original=pathlib.Path(policy['originalHelper'])
require(str(original)=='/usr/lib/luxisoft-development-runtime/provider-helper','unexpected_original')
require(digest(original.read_bytes())==policy['originalHash'],'original_drift')
require(original.read_bytes()==subprocess.check_output(['git','-c','safe.directory='+str(provider),'-C',str(provider),'show','HEAD^:backend/scripts/deployments/deployment-helper.py']),'original_source_drift')
wrapper=pathlib.Path('/usr/lib/luxipanel/deployment-helper')
require(wrapper.read_bytes()==subprocess.check_output(['git','-c','safe.directory='+str(consumer),'-C',str(consumer),'show','HEAD^:backend/ops/development-runtime/guarded-helper.py']),'guard_drift')
targets={
 original:provider/'backend/scripts/deployments/deployment-helper.py',
 wrapper:consumer/'backend/ops/development-runtime/guarded-helper.py',
 pathlib.Path('/usr/lib/luxipanel/deployment-data.mjs'):provider/'backend/scripts/deployments/deployment-data.mjs',
 pathlib.Path('/usr/lib/luxipanel/data-query.mjs'):provider/'backend/scripts/deployments/data-query.mjs',
}
backup=pathlib.Path(tempfile.mkdtemp(prefix='luxisoft-data-bridge.',dir='/var/backups'))
os.chmod(backup,0o700)
before={}
for target in [*targets,policyfile]:
    require(not target.is_symlink(),'unsafe_target')
    if target.exists():
        before[str(target)]={'sha256':digest(target.read_bytes()),'mode':target.stat().st_mode & 0o777}
        shutil.copy2(target,backup/target.name)
    else: before[str(target)]=None
def atomic(target,data,mode):
    staged=target.with_name(target.name+'.data-release')
    with open(staged,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
    os.chown(staged,0,0);os.chmod(staged,mode);os.replace(staged,target)
try:
    for target,source in targets.items():atomic(target,source.read_bytes(),0o755 if target in [original,wrapper] else 0o644)
    policy['originalHash']=digest(original.read_bytes())
    atomic(policyfile,(json.dumps(policy,indent=2)+'\n').encode(),0o600)
    require(digest(original.read_bytes())==json.loads(policyfile.read_text())['originalHash'],'policy_hash_mismatch')
    report={'ok':True,'providerCommit':git(provider,'rev-parse','HEAD'),'consumerCommit':git(consumer,'rev-parse','HEAD'),'backup':str(backup),'before':before,'installed':[{'path':str(p),'sha256':digest(p.read_bytes())}for p in targets]}
    (backup/'release.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
except:
    for target in [*targets,policyfile]:
        saved=before[str(target)]
        if saved:atomic(target,(backup/target.name).read_bytes(),saved['mode'])
        else:target.unlink(missing_ok=True)
    raise
