"""Real Git fixtures; PM2 activation is simulated, production is never touched."""
import importlib.util,json,subprocess,tempfile,unittest,hashlib,types
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('manager',Path(__file__).with_name('release-manager.py'));manager=importlib.util.module_from_spec(spec);spec.loader.exec_module(manager)
def git(root,*args):return subprocess.check_output(['git',*args],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
class ReleaseTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.base=Path(self.temp.name);self.root=self.base/'root';self.root.mkdir();self.remote=self.base/'remote.git'
  git(self.base,'init','--bare',str(self.remote));git(self.root,'init','-b','main');git(self.root,'config','user.name','Test');git(self.root,'config','user.email','test@example.test')
  (self.root/'.gitignore').write_text('.releases/\n.lxp/\n**/dist/\n**/.env\n')
  (self.root/'source').write_text('old');(self.root/'release.manifest.json').write_text(json.dumps({'format':1,'version':'1.0.0','modules':[]}));git(self.root,'add','.');git(self.root,'commit','-m','initial');self.old=git(self.root,'rev-parse','HEAD')
  (self.root/'source').write_text('new');(self.root/'release.manifest.json').write_text(json.dumps({'format':1,'version':'1.0.1','modules':[]}));git(self.root,'add','.');git(self.root,'commit','-m','fix: new');self.commit=git(self.root,'rev-parse','HEAD');git(self.root,'tag','v1.0.1');git(self.root,'push',str(self.remote),'main','--tags');git(self.root,'reset','--hard',self.old)
  self.release=self.root/'.releases'/self.commit;self.release.mkdir(parents=True);(self.release/'.build-complete').write_text(self.commit);(self.release/'release.manifest.json').write_text(json.dumps({'format':1,'version':'1.0.1','modules':[]}))
  for area in ['backend','frontend']:
   (self.root/area/'dist').mkdir(parents=True);(self.root/area/'dist/asset').write_text('old');(self.root/area/'.env').write_text('LOCAL_VALUE=preserved\n')
   (self.release/area/'dist').mkdir(parents=True);(self.release/area/'dist/asset').write_text('new')
  self.pm2=self.base/'pm2';self.pm2.write_text('fixture')
  self.patches=[patch.object(manager,'UPSTREAM',str(self.remote)),patch.object(manager,'PM2',str(self.pm2)),patch.object(manager.shutil,'disk_usage',return_value=types.SimpleNamespace(free=10*1024**3))]
  for p in self.patches:p.start()
 def tearDown(self):
  for p in self.patches:p.stop()
  self.temp.cleanup()
 def test_invalid_tag_never_touches_installation(self):
  with self.assertRaises(ValueError):manager.main(self.root,'v1.0.1;touch /tmp/unsafe')
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
 def test_failed_activation_recovers_static_paths_and_old_runtime(self):
  with patch.object(manager,'activate',side_effect=[RuntimeError('health failed'),None]) as activate:
   with self.assertRaisesRegex(RuntimeError,'health failed'):manager.main(self.root,'v1.0.1')
  self.assertEqual([c.args[0] for c in activate.call_args_list],[self.release,self.root]);self.assertEqual((self.root/'frontend/dist/asset').read_text(),'old');self.assertFalse((self.root/'frontend/dist').is_symlink());self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
  state=json.loads((self.root/'.releases/state.json').read_text());self.assertEqual(state['operation']['status'],'rolled_back');self.assertNotIn('installed',state)
 def test_success_switches_clone_assets_and_environment_together(self):
  with patch.object(manager,'activate'):manager.main(self.root,'v1.0.1')
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.commit);self.assertEqual((self.root/'frontend/dist/asset').read_text(),'new');self.assertTrue((self.root/'backend/.env').is_symlink());self.assertEqual((self.root/'backend/.env').read_text(),'LOCAL_VALUE=preserved\n')
  self.assertEqual(json.loads((self.root/'.releases/state.json').read_text())['installed']['tag'],'v1.0.1')
 def test_dirty_tracked_and_untracked_files_are_preserved(self):
  (self.root/'source').write_text('local edit');(self.root/'private-draft').write_text('private')
  with patch.object(manager,'activate') as activate:
   with self.assertRaisesRegex(RuntimeError,'Cambios locales'):manager.main(self.root,'v1.0.1')
   activate.assert_not_called()
  self.assertEqual((self.root/'source').read_text(),'local edit');self.assertEqual((self.root/'private-draft').read_text(),'private')
 def test_custom_commit_is_preserved_and_blocks_update(self):
  (self.root/'custom').write_text('user');git(self.root,'add','custom');git(self.root,'commit','-m','custom');head=git(self.root,'rev-parse','HEAD')
  with patch.object(manager,'activate') as activate:
   with self.assertRaisesRegex(RuntimeError,'Commits personalizados'):manager.main(self.root,'v1.0.1')
   activate.assert_not_called()
  self.assertEqual(git(self.root,'rev-parse','HEAD'),head)
 def test_partial_static_switch_restores_first_directory(self):
  real=manager.os.replace
  def fail(src,dest):
   if str(dest).endswith('/frontend/dist'):raise OSError('injected rename failure')
   return real(src,dest)
  with patch.object(manager.os,'replace',side_effect=fail):
   with self.assertRaisesRegex(OSError,'injected'):manager.switch_static(self.root,self.release,self.root/'.releases')
  self.assertEqual((self.root/'backend/dist/asset').read_text(),'old');self.assertEqual((self.root/'frontend/dist/asset').read_text(),'old')
 def test_private_preview_survives_and_conflicts_block(self):
  old=self.root/'backend/dist/modules/community/installed/private-module';old.mkdir(parents=True);(old/'.preview.json').write_text('{}');(old/'backend.js').write_text('private source')
  manager.preserve_previews(self.root,self.release);self.assertEqual((self.release/'backend/dist/modules/community/installed/private-module/backend.js').read_text(),'private source')
  destination=self.release/'backend/dist/modules/community/installed/private-module';(destination/'.preview.json').unlink()
  with self.assertRaisesRegex(RuntimeError,'conflicto'):manager.preserve_previews(self.root,self.release)
 def test_manifest_rejects_tampered_and_linked_module_artifacts(self):
  folder=self.release/'backend/dist/modules/community/installed/example-module';folder.mkdir(parents=True);file=folder/'backend.js';file.write_text('approved')
  row={'id':'example-module','version':'1.0.0','versionId':'11111111-1111-1111-1111-111111111111','commit':'a'*40,'files':{'backend.js':hashlib.sha256(file.read_bytes()).hexdigest()}}
  (self.release/'release.manifest.json').write_text(json.dumps({'format':1,'version':'1.0.1','modules':[row]}));manager.verify_bundle(self.release,'v1.0.1');file.write_text('modified')
  with self.assertRaisesRegex(RuntimeError,'hash'):manager.verify_bundle(self.release,'v1.0.1')
  file.unlink();file.symlink_to(self.root/'source')
  with self.assertRaisesRegex(RuntimeError,'fuera'):manager.verify_bundle(self.release,'v1.0.1')
class RuntimeHealthTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  (self.root/'web/backend').mkdir(parents=True);(self.root/'web/frontend').mkdir()
  self.rows=[{'name':'luxipanel-'+area,'pm2_env':{'status':'online','pm_cwd':str(self.root/'web'/area),'pm_exec_path':str(self.root/'web'/area/entry)}} for area,entry in [('backend','dist/server.js'),('frontend','dist/server/entry.mjs')]]
 def tearDown(self):self.temp.cleanup()
 def test_confirms_paths_and_both_http_services(self):
  with patch.object(manager.subprocess,'check_output',return_value=json.dumps(self.rows)),patch.object(manager.urllib.request,'urlopen') as http:
   http.return_value.__enter__.return_value.status=200
   self.assertTrue(manager.healthy(self.root));self.assertEqual(http.call_count,2)
 def test_rejects_online_processes_from_another_release(self):
  for key in ['pm_cwd','pm_exec_path']:
   with self.subTest(key=key):
    rows=json.loads(json.dumps(self.rows));rows[0]['pm2_env'][key]='/previous-release/'+key
    with patch.object(manager.subprocess,'check_output',return_value=json.dumps(rows)),patch.object(manager.urllib.request,'urlopen') as http:
     self.assertFalse(manager.healthy(self.root));http.assert_not_called()
 def test_rejects_missing_duplicate_and_unreadable_processes(self):
  for value in [self.rows[:1],self.rows+[self.rows[0]],{},[None]]:
   with self.subTest(value=value),patch.object(manager.subprocess,'check_output',return_value=json.dumps(value)):
    self.assertFalse(manager.healthy(self.root))
  with patch.object(manager.subprocess,'check_output',side_effect=subprocess.TimeoutExpired('pm2',15)):
   self.assertFalse(manager.healthy(self.root))
 def test_rejects_failed_http_even_with_correct_processes(self):
  with patch.object(manager.subprocess,'check_output',return_value=json.dumps(self.rows)),patch.object(manager.urllib.request,'urlopen') as http:
   http.return_value.__enter__.return_value.status=503
   self.assertFalse(manager.healthy(self.root))
if __name__=='__main__':unittest.main()
