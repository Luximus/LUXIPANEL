#!/usr/bin/env python3
"""Manually move an old flat checkout to the clean monorepo, preserving a full backup."""
import argparse, json, os, shutil, subprocess, tempfile, time, urllib.request
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location('manager',Path(__file__).with_name('release-manager.py'));manager=module_from_spec(spec);spec.loader.exec_module(manager)
def migrate(root,tag,apply=False,archive=False):
 root=root.resolve()
 if not (root/'backend').is_dir() or not (root/'frontend').is_dir():raise RuntimeError('Not a LUXIPANEL installation')
 if (root/'web').is_dir():raise RuntimeError('Already a monorepo; use the normal version installer')
 changes=manager.local_changes(root)
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
 ancestor=subprocess.run(['git','merge-base','--is-ancestor',head,'refs/remotes/origin/main'],cwd=root,capture_output=True).returncode==0
 if (changes or not ancestor) and not archive:raise RuntimeError('Local edits/custom commits preserved. Review them; use --archive-local-changes only when you want the entire old checkout archived.')
 if not __import__('re').fullmatch(r'v\d+\.\d+\.\d+',tag):raise ValueError('Invalid official tag')
 print(json.dumps({'tag':tag,'localChanges':changes,'oldCommit':head,'willArchiveWholeCheckout':True,'apply':apply}))
 if not apply:return
 with urllib.request.urlopen('https://api.github.com/repos/Luxisoft/LUXIPANEL/releases/tags/'+tag,timeout=15) as response:release=json.load(response)
 if release['draft'] or release['prerelease']:raise RuntimeError('Choose a published stable Release')
 prepared=Path(tempfile.mkdtemp(prefix='lxp-migration-',dir=root.parent));backup=root.with_name(root.name+'-private-backup-'+str(time.time_ns()))
 old_mode=root.stat().st_mode & 0o777
 moved=False
 try:
  subprocess.run(['git','clone','--branch',tag,'--depth','1','https://github.com/Luxisoft/LUXIPANEL.git',str(prepared)],check=True)
  app=prepared/'web'
  for area in ['backend','frontend']:
   if (root/area/'.env').is_file():shutil.copy2(root/area/'.env',app/area/'.env');(app/area/'.env').chmod(0o600)
  env=dict(os.environ,NODE_OPTIONS='--max-old-space-size=2560')
  for area in ['backend','frontend']:
   manager.run(['pnpm','install','--frozen-lockfile'],app/area,env=env);manager.run(['pnpm','run','build'],app/area,env=env)
  manager.run(['node','scripts/build-release-bundle.mjs','--verify'],app,env=env);manager.verify_bundle(prepared,tag);manager.preserve_previews(root,prepared)
  root.rename(backup);backup.chmod(0o700);moved=True;prepared.rename(root);root.chmod(old_mode)
  # Keep legacy nginx asset aliases functional without tracking duplicate client trees.
  for area in ['backend','frontend']:(root/area).symlink_to(Path('web')/area,target_is_directory=True)
  manager.activate(root)
  commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
  state=root/'.releases/state.json';state.parent.mkdir(mode=0o700,exist_ok=True);manager.write_state(state,{'installed':{'tag':tag,'commit':commit,'path':str(root)},'legacyBackup':str(backup),'operation':{'status':'complete','tag':tag}})
  print('Installed '+tag+'. Previous source, Git history and private configuration preserved at '+str(backup))
 except Exception:
  if moved:
   failed=root.with_name(root.name+'-failed-migration-'+str(time.time_ns()))
   if root.exists():root.rename(failed)
   backup.rename(root);root.chmod(old_mode);manager.activate(root)
  raise
 finally:
  if prepared.exists():shutil.rmtree(prepared)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('--tag',required=True);parser.add_argument('--apply',action='store_true');parser.add_argument('--archive-local-changes',action='store_true');args=parser.parse_args();migrate(args.root,args.tag,args.apply,args.archive_local_changes)
