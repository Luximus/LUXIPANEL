import importlib.util, json, os, subprocess, tempfile, unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location("verifier", Path(__file__).with_name("verify-repair.py")); verifier = importlib.util.module_from_spec(spec); spec.loader.exec_module(verifier)
class SandboxTests(unittest.TestCase):
 def test_host_files_environment_and_network_are_absent(self):
  with tempfile.TemporaryDirectory() as source, tempfile.TemporaryDirectory() as secret:
   host = Path(secret) / "host-secret"; host.write_text("private")
   os.environ["LXP_TEST_SECRET"] = "private"
   code = "const fs=require('fs'),net=require('net');if(process.env.LXP_TEST_SECRET || fs.existsSync(" + json.dumps(str(host)) + "))process.exit(2);const c=net.connect(5432,'127.0.0.1');c.on('connect',()=>process.exit(3));c.on('error',()=>console.log('isolated'));"
   result = verifier.sandbox(Path(source), ["node", "-e", code]); self.assertEqual(result.returncode, 0, result.stderr); self.assertIn("isolated", result.stdout)
   del os.environ["LXP_TEST_SECRET"]
 def test_module_without_real_checks_cannot_be_published(self):
  with tempfile.TemporaryDirectory() as source:
   root=Path(source);(root/'modules/example-module').mkdir(parents=True)
   result=verifier.verify(root,'backend-tests','example-module');self.assertNotEqual(result.returncode,0)
if __name__ == '__main__': unittest.main()
