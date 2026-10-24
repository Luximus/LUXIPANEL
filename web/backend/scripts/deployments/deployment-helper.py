#!/usr/bin/python3
"""Restricted supervisor: metadata and systemd only; customer code runs as its
hosting identity in rootless containers. Installed root-owned by install.sh."""
import base64, fcntl, hashlib, json, math, os, pathlib, pwd, re, stat, subprocess, sys, time, signal
sys.path.insert(0, '/usr/lib/luxipanel')
from deployment_policy import healthy_components

POLICY = '/etc/luxipanel-deployment-runtime.json'
def require(condition, message):
    if not condition: raise RuntimeError(message)
def regular(path, owners):
    path = pathlib.Path(path)
    for parent in [*reversed(path.parents), path]:
        item = parent.lstat()
        require(not stat.S_ISLNK(item.st_mode), 'unsafe_runtime_path')
        if str(parent).startswith('/etc/luxipanel'):
            require(item.st_uid in owners and not item.st_mode & 0o002 and (not item.st_mode & 0o020 or item.st_gid in owners), 'unsafe_runtime_owner')
    return path
def run(argv, **kwargs):
    timeout=kwargs.pop('timeout',30)
    body=kwargs.pop('input',None)
    capture=kwargs.pop('capture_output',False)
    process=subprocess.Popen(argv,start_new_session=True,stdin=subprocess.PIPE if body is not None else None,
        stdout=subprocess.PIPE if capture else None,stderr=subprocess.PIPE if capture else None,**kwargs)
    try: output,error=process.communicate(body,timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid,signal.SIGKILL);process.communicate();raise
    if process.returncode: raise subprocess.CalledProcessError(process.returncode,argv,output,error)
    return subprocess.CompletedProcess(argv,process.returncode,output,error)
require(os.geteuid() == 0, 'supervisor_requires_root')
regular(POLICY, [0])
policy = json.loads(pathlib.Path(POLICY).read_text())
service = pwd.getpwnam(policy['serviceUser'])
require(len(sys.argv) in [2,3], 'invalid_arguments')
file = regular(sys.argv[1], [0, service.pw_uid])
root = pathlib.Path(policy['configRoot']) / 'hosting/deployments'
relative = str(file.relative_to(root))
require(re.fullmatch(r'[a-f0-9]{64}/(?:jobs/[a-f0-9-]{36}/(?:input|state)\.json|(?:retire|resume)\.json|data/[a-f0-9-]{36}\.json)', relative), 'invalid_job_path')
task = json.loads(file.read_text())
operation = sys.argv[2] if len(sys.argv) == 3 else 'run'
require(operation in ['run','activate','cleanup','retire','resume','data'], 'invalid_operation')
budget = task.get('executionBudget') if operation == 'run' else None
if budget is not None:
    require(isinstance(budget, dict) and set(budget) == {'version', 'maxExecutionSeconds'}, 'invalid_execution_budget')
    require(type(budget['version']) is int and budget['version'] == 1, 'invalid_execution_budget')
    require(type(budget['maxExecutionSeconds']) is int and 1 <= budget['maxExecutionSeconds'] <= 1900, 'invalid_execution_budget')
require(re.fullmatch(r'hp[a-f0-9]{20}', task['username']), 'invalid_hosting_identity')
user = pwd.getpwnam(task['username'])
require(user.pw_uid >= 1000 and user.pw_dir == task['home'] == '/home/'+user.pw_name, 'invalid_hosting_home')
require(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',task['projectId']), 'invalid_project')
require(task.get('environment', 'preview') in ['preview', 'production'], 'invalid_environment')
for key in ['versionId','requestId']:
    if key in task: require(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',task[key]), 'invalid_'+key)
if operation == 'data':
    require(re.fullmatch(r'[a-f0-9]{64}/data/[a-f0-9-]{36}\.json', relative), 'invalid_data_path')
    require(task.get('request', {}).get('environment') == task.get('environment'), 'invalid_data_environment')
    env=['/usr/sbin/runuser','-u',user.pw_name,'--','/usr/bin/env','-i',
         'HOME='+user.pw_dir,'PATH=/usr/local/bin:/usr/bin:/bin','LANG=C.UTF-8',
         'XDG_RUNTIME_DIR=/run/user/'+str(user.pw_uid),'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/'+str(user.pw_uid)+'/bus',
         '/usr/bin/node','/usr/lib/luxipanel/deployment-data.mjs']
    try:
        result=run(env,input=json.dumps({'home':user.pw_dir,'projectId':task['projectId'],'request':task['request']}),text=True,capture_output=True,timeout=35)
        sys.stdout.write(result.stdout)
    except subprocess.CalledProcessError:
        sys.stdout.write(json.dumps({'ok':False,'error':'project_data_unavailable'}))
    finally:
        file.unlink(missing_ok=True)
    sys.exit(0)
statefile = file.parent / 'state.json'
execution_started = None
def measured_usage():
    return {'executionSeconds': max(0, math.ceil(time.monotonic() - execution_started))} if execution_started is not None else {'executionSeconds': 0}
def save(patch):
    current = json.loads(statefile.read_text()) if statefile.exists() else {}
    current.update(patch)
    current.update(username=user.pw_name, home=user.pw_dir, projectId=task['projectId'])
    temporary = statefile.with_suffix('.tmp')
    temporary.write_text(json.dumps(current)); os.chmod(temporary,0o600); os.chown(temporary,service.pw_uid,service.pw_gid)
    os.replace(temporary,statefile)
try:
    with open('/run/lock/luxisoft-deployment-provision.lock','a') as provision:
        fcntl.flock(provision,fcntl.LOCK_EX)
        for filename,flag in [('/etc/subuid','--add-subuids'),('/etc/subgid','--add-subgids')]:
            rows = pathlib.Path(filename).read_text().splitlines()
            if not any(row.startswith(user.pw_name+':') for row in rows):
                end=max([100000]+[int(row.split(':')[1])+int(row.split(':')[2]) for row in rows if re.fullmatch(r'[^:]+:\d+:\d+',row)])
                start=((end+65535)//65536)*65536
                require(start+65535<2**32,'subordinate_id_capacity_exceeded')
                run(['/usr/sbin/usermod',flag,str(start)+'-'+str(start+65535),user.pw_name])
        run(['/usr/bin/loginctl','enable-linger',user.pw_name])
        run(['/usr/bin/systemctl','set-property','user-'+str(user.pw_uid)+'.slice','MemoryMax=4096M','CPUQuota=150%','TasksMax=1536'])
        run(['/usr/bin/systemctl','start','user@'+str(user.pw_uid)+'.service'])
    env=['/usr/sbin/runuser','-u',user.pw_name,'--','/usr/bin/env','-i',
         'HOME='+user.pw_dir,'PATH=/usr/local/bin:/usr/bin:/bin','LANG=C.UTF-8',
         'XDG_RUNTIME_DIR=/run/user/'+str(user.pw_uid),'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/'+str(user.pw_uid)+'/bus',
         '/usr/bin/node','/usr/lib/luxipanel/deployment-tenant.mjs']
    if operation == 'run':
        require(not (file.parent.parent.parent/'retire.json').exists(),'deployment_retired')
        save({'status':'running'})
        version_root = file.parent.parent.parent / 'versions' / task['versionId']
        require(pathlib.Path(task['versionRoot']) == version_root, 'invalid_version_path')
        archive=regular(version_root/'source.zip',[0,service.pw_uid]).read_bytes()
        require(hashlib.sha256(archive).hexdigest()==task['snapshot']['sourceDigest'],'source_digest_mismatch')
        # The client never chooses a host path or host command. Only the owned
        # source archive and validated application manifest cross the boundary.
        payload={key:task[key] for key in ['projectId','versionId','environment','username','home','snapshot','limits','variables','requestId']}
        payload['archive']=base64.b64encode(archive).decode()
        # One lock across all accounts. Runner holds it through installation,
        # compilation and validation; platform build adapters share this lock.
        with open('/run/lock/luxisoft-heavy-build.lock','a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            execution_started = time.monotonic()
            try:
                result=run(env,input=json.dumps(payload),text=True,capture_output=True,
                           timeout=budget['maxExecutionSeconds'] if budget else 1900)
            except subprocess.TimeoutExpired:
                raise RuntimeError('deployment_time_budget_exceeded')
        if (file.parent.parent.parent/'retire.json').exists():
            cleanup={'operation':'retire','home':user.pw_dir,'username':user.pw_name,'projectId':task['projectId']}
            run(env,input=json.dumps(cleanup),text=True,capture_output=True,timeout=120)
            raise RuntimeError('deployment_retired')
        output=json.loads(result.stdout)
        require(output['ok'],'deployment_failed')
        try:
            healthy_components(output['result']['components'],task['snapshot']['manifest']['components'])
        except Exception:
            cleanup={'operation':'discard','home':user.pw_dir,'username':user.pw_name,'projectId':task['projectId'],'requestId':task['requestId']}
            run(env,input=json.dumps(cleanup),text=True,capture_output=True,timeout=120)
            raise
        if task['environment'] == 'preview':
            finalize={'operation':'finalize-preview','home':user.pw_dir,'username':user.pw_name,'projectId':task['projectId'],'requestId':task['requestId']}
            previous=run(env,input=json.dumps(finalize),text=True,capture_output=True,timeout=120)
            output['result']['evictedVersionIds']=json.loads(previous.stdout)['result']['evictedVersionIds']
        static_parts=[part for part in output['result']['components'] if part.get('surface')=='static']
        if static_parts:
            target=file.parent/'static'
            target.mkdir(mode=0o700,exist_ok=True)
            os.chown(target,service.pw_uid,service.pw_gid)
            for part in static_parts:
                name=part['name']; meta=part['staticArchive']
                require(re.fullmatch(r'[a-z][a-z0-9-]{0,29}',name),'invalid_static_component')
                require(re.fullmatch(r'[a-f0-9]{64}',meta['sha256']),'invalid_static_digest')
                require(isinstance(meta['bytes'],int) and 0<meta['bytes']<=33554432,'invalid_static_size')
                source=regular(pathlib.Path(user.pw_dir)/'.luxisoft/deployments'/task['projectId'].replace('-','')/'versions'/task['versionId']/('static-'+name+'-'+task['requestId']+'.zip'),[user.pw_uid])
                fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW)
                try:
                    info=os.fstat(fd)
                    require(stat.S_ISREG(info.st_mode) and info.st_uid==user.pw_uid and info.st_size==meta['bytes'],'invalid_static_source')
                    with os.fdopen(fd,'rb',closefd=False) as stream: data=stream.read(33554433)
                    require(len(data)==meta['bytes'] and hashlib.sha256(data).hexdigest()==meta['sha256'],'static_digest_mismatch')
                finally: os.close(fd)
                destination=target/(name+'.zip')
                temporary=target/(name+'.tmp')
                temporary.write_bytes(data);os.chmod(temporary,0o600);os.chown(temporary,service.pw_uid,service.pw_gid)
                os.replace(temporary,destination)
                source.unlink()
        save({'status':'finished','result':output['result'],'logs':output.get('logs',''),'usage':measured_usage()})
    else:
        payload={'operation':operation,'home':user.pw_dir,'username':user.pw_name,'projectId':task['projectId'],'requestId':task.get('id','')}
        result=run(env,input=json.dumps(payload),text=True,capture_output=True,timeout=120)
        require(json.loads(result.stdout).get('ok'),'deployment_lifecycle_failed')
except Exception as error:
    # Raw subprocess output could contain credentials. Trusted runner provides
    # its own sanitized diagnostics in the failure envelope.
    logs=''; code=str(error)
    if isinstance(error,subprocess.CalledProcessError):
        try:
            output=json.loads(error.stdout or '{}');code=output.get('error','deployment_process_failed');logs=output.get('logs','')
        except Exception: code='deployment_process_failed'
    if operation=='run': save({'status':'failed','error':code[:500],'logs':logs[-24000:],'usage':measured_usage()})
    sys.exit(1)
finally:
    if operation=='run':
        try: file.unlink()
        except FileNotFoundError: pass
