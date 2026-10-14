#!/usr/bin/env python3
"""Inspect or provision canonical release governance; requires maintainer GitHub auth."""
import argparse, json, subprocess, urllib.error, os
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec=spec_from_file_location('prepare',Path(__file__).with_name('prepare-release.py'));prepare=module_from_spec(spec);spec.loader.exec_module(prepare)
parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
if not os.environ.get('GH_TOKEN'):
 result=subprocess.run(['gh','auth','token','--hostname','github.com'],capture_output=True,text=True)
 if result.returncode: raise SystemExit('Authenticate with gh auth login first; never paste tokens into an issue or chat.')
 os.environ['GH_TOKEN']=result.stdout.strip()
repo=prepare.api(''); actor=json.loads(subprocess.check_output(['gh','api','user'],text=True)) if not os.environ.get('GH_TOKEN') else None
if not repo.get('permissions',{}).get('admin'): raise SystemExit('Repository administrator permission is required to configure review protection.')
main=prepare.api('/branches/main')['commit']['sha']
try: prepare.api('/branches/modules')
except urllib.error.HTTPError as error:
 if error.code !=404: raise
 if args.apply:prepare.api('/git/refs','POST',{'ref':'refs/heads/modules','sha':main})
 else:print('Missing modules branch')
for name in ['announcement','module-report','core-report','warning','release']:
 try:prepare.api('/labels/'+name)
 except urllib.error.HTTPError as error:
  if error.code!=404:raise
  if args.apply:prepare.api('/labels','POST',{'name':name,'color':'1565c0'})
  else:print('Missing label:',name)
for branch,check in [('main','release-checks'),('modules','static-review')]:
 try: protection=prepare.api('/branches/'+branch+'/protection')
 except urllib.error.HTTPError as error:
  if error.code!=404:raise
  protection=None
 if args.apply and protection is None:
  prepare.api('/branches/'+branch+'/protection','PUT',{'required_status_checks':{'strict':True,'contexts':[check]},'enforce_admins':True,'required_pull_request_reviews':{'dismiss_stale_reviews':True,'required_approving_review_count':1},'restrictions':None,'allow_force_pushes':False,'allow_deletions':False})
 elif protection is None: print('Missing reviewed branch protection:',branch)
 else: print('Existing protection retained:',branch)
if args.apply:prepare.api('/actions/permissions/workflow','PUT',{'default_workflow_permissions':'read','can_approve_pull_request_reviews':True})
print('Official workflows use short-lived OIDC identity. LP_REVIEW_URL optionally overrides the public authority endpoint; no LP secret is required.')
print('Make the repository public in GitHub Settings if anonymous installations must read releases and discussions.')
print('Run this script after reviewed pipeline code has reached main; branches are never merged or released by this setup.')
