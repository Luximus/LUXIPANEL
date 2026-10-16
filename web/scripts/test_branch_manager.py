"""Branch installs use real Git fixtures; builds and PM2 remain simulated."""
import importlib.util,json,shutil,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('fixtures',Path(__file__).with_name('test_release_manager.py'));fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
manager=fixtures.manager;git=fixtures.git
class BranchTests(fixtures.ReleaseTests):
 def branch_fixture(self):
  git(self.root,'branch','developer',self.commit);git(self.root,'push',str(self.remote),'developer')
  directory=self.root/'.releases'/('branch-'+self.commit)
  shutil.copytree(self.release,directory)
  return directory
 def test_validates_branch_and_sha_without_touching_git(self):
  for branch,sha in [('developer;id',self.commit),('../main',self.commit),('developer','HEAD')]:
   with self.assertRaises(ValueError):manager.main(self.root,'',branch,sha)
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
 def test_pins_the_commit_and_rejects_an_advanced_branch(self):
  self.branch_fixture()
  with patch.object(manager,'activate') as activate:
   with self.assertRaisesRegex(RuntimeError,'cambió'):manager.main(self.root,'','developer',self.old)
   activate.assert_not_called()
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
 def test_branch_install_records_branch_and_preserves_modules_and_environment(self):
  release=self.branch_fixture()
  module=self.root/'backend/dist/modules/community/installed/example-module';module.mkdir(parents=True);(module/'backend.js').write_text('current approved module')
  with patch.object(manager,'activate') as activate:manager.main(self.root,'','developer',self.commit)
  activate.assert_called_once_with(release)
  self.assertEqual(git(self.root,'branch','--show-current'),'developer')
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.commit)
  self.assertEqual((release/'backend/dist/modules/community/installed/example-module/backend.js').read_text(),'current approved module')
  self.assertEqual((self.root/'backend/.env').read_text(),'LOCAL_VALUE=preserved\n')
  state=json.loads((self.root/'.releases/state.json').read_text())
  self.assertEqual(state['installed']['branch'],'developer');self.assertEqual(state['installed']['commit'],self.commit)
  self.assertNotIn('tag',state['installed'])
 def test_branch_failure_restores_old_runtime_and_source(self):
  release=self.branch_fixture()
  with patch.object(manager,'activate',side_effect=[RuntimeError('health failed'),None]):
   with self.assertRaisesRegex(RuntimeError,'health failed'):manager.main(self.root,'','developer',self.commit)
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
  self.assertEqual((self.root/'frontend/dist/asset').read_text(),'old')
  state=json.loads((self.root/'.releases/state.json').read_text());self.assertEqual(state['operation']['status'],'rolled_back');self.assertNotIn('installed',state)
 def test_local_edit_during_preparation_prevents_activation(self):
  self.branch_fixture()
  preserve=manager.preserve_installed_modules
  def change_source(previous,release):
   preserve(previous,release);(self.root/'source').write_text('new user edit')
  with patch.object(manager,'preserve_installed_modules',side_effect=change_source),patch.object(manager,'activate') as activate:
   with self.assertRaisesRegex(RuntimeError,'cambió durante'):manager.main(self.root,'','developer',self.commit)
   activate.assert_not_called()
  self.assertEqual((self.root/'source').read_text(),'new user edit')
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
 def test_checkout_failure_restores_original_branch(self):
  self.branch_fixture();run=manager.run
  def fail_merge(args,*rest,**kwargs):
   if 'merge' in args:raise RuntimeError('checkout failed')
   return run(args,*rest,**kwargs)
  with patch.object(manager,'run',side_effect=fail_merge),patch.object(manager,'activate'):
   with self.assertRaisesRegex(RuntimeError,'checkout failed'):manager.main(self.root,'','developer',self.commit)
  self.assertEqual(git(self.root,'branch','--show-current'),'main')
  self.assertEqual(git(self.root,'rev-parse','HEAD'),self.old)
  self.assertEqual((self.root/'frontend/dist/asset').read_text(),'old')
 def test_reinstall_keeps_current_modules(self):
  self.branch_fixture();module=self.root/'backend/dist/modules/community/installed/example-module';module.mkdir(parents=True);(module/'backend.js').write_text('approved')
  with patch.object(manager,'activate'):
   manager.main(self.root,'','developer',self.commit)
   manager.main(self.root,'','developer',self.commit)
  self.assertEqual((self.root/'backend/dist/modules/community/installed/example-module/backend.js').read_text(),'approved')
if __name__=='__main__':unittest.main()
