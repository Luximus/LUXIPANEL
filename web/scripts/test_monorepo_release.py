import importlib.util,json,subprocess,tempfile,unittest,io,shutil
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('fixtures',Path(__file__).with_name('test_release_manager.py'));fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
manager=fixtures.manager
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).with_name('prepare-release.py'));prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
class MonorepoTests(fixtures.ReleaseTests):
 def test_nested_source_and_environment_switch_and_rollback(self):
  for source in [self.root,self.release]:
   (source/'web').mkdir()
   for area in ['backend','frontend']:(source/area).rename(source/'web'/area)
  with patch.object(manager,'activate',side_effect=[RuntimeError('health failed'),None]):
   with self.assertRaisesRegex(RuntimeError,'health failed'):manager.main(self.root,'v1.0.1')
  self.assertEqual((self.root/'web/frontend/dist/asset').read_text(),'old');self.assertFalse((self.root/'web/backend/.env').is_symlink())
  with patch.object(manager,'activate'):manager.main(self.root,'v1.0.1')
  self.assertEqual((self.root/'web/frontend/dist/asset').read_text(),'new');self.assertTrue((self.root/'web/backend/.env').is_symlink())
  self.assertEqual((self.root/'web/backend/.env').read_text(),'LOCAL_VALUE=preserved\n')
class SourceArchiveTests(unittest.TestCase):
 def test_extracts_only_canonical_web_module_and_removes_stale_files(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);repo=root/'repository';repo.mkdir();fixtures.git(repo,'init','-b','modules');fixtures.git(repo,'config','user.name','Test');fixtures.git(repo,'config','user.email','test@example.test')
   module=repo/'web/modules/example-module';module.mkdir(parents=True);(module/'module.manifest.json').write_text('{"id":"example-module"}');(module/'backend').mkdir();(module/'backend/index.ts').write_text('export default {};')
   fixtures.git(repo,'add','.');fixtures.git(repo,'commit','-m','module');commit=fixtures.git(repo,'rev-parse','HEAD');target=root/'target';(target/'modules/example-module').mkdir(parents=True);(target/'modules/example-module/old.ts').write_text('stale')
   with patch.object(prepare,'UPSTREAM',str(repo)):prepare.extract_module(target,{'id':'example-module','commit':commit},repo)
   self.assertTrue((target/'modules/example-module/backend/index.ts').exists());self.assertFalse((target/'modules/example-module/old.ts').exists());self.assertFalse((target/'web').exists())
 def test_rejects_linked_module_archive(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);repo=root/'repository';repo.mkdir();fixtures.git(repo,'init','-b','modules');fixtures.git(repo,'config','user.name','Test');fixtures.git(repo,'config','user.email','test@example.test')
   module=repo/'web/modules/example-module';module.mkdir(parents=True);(module/'escape').symlink_to('/etc/passwd');fixtures.git(repo,'add','.');fixtures.git(repo,'commit','-m','unsafe');commit=fixtures.git(repo,'rev-parse','HEAD')
   with patch.object(prepare,'UPSTREAM',str(repo)):
    with self.assertRaisesRegex(ValueError,'confined'):prepare.extract_module(root/'target',{'id':'example-module','commit':commit},repo)
if __name__=='__main__':unittest.main()
