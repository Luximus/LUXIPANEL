import importlib.util, pathlib, unittest
spec = importlib.util.spec_from_file_location('validation', pathlib.Path(__file__).with_name('expo-validation.py'))
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)

class ValidationPolicy(unittest.TestCase):
    def test_namespaces_and_resources(self):
        args = validation.command(pathlib.Path('/tmp/lxp-mobile-00000000-0000-0000-0000-000000000000'), 'export', 'root')
        self.assertIn('--unshare-all', args)
        self.assertIn('--clearenv', args)
        self.assertIn('--property=MemoryMax=768M', args)
        self.assertIn('--property=TasksMax=128', args)
        self.assertIn('--property=NoNewPrivileges=yes', args)
        self.assertNotIn('/etc', args)
        self.assertNotIn('/var/www', args)
        self.assertEqual(args[-7:], ['/usr/bin/node', 'node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'dist'])

    def test_only_fixed_commands(self):
        with self.assertRaises(ValueError):
            validation.command(pathlib.Path('/tmp/example'), 'shell', 'root')

if __name__ == '__main__':
    unittest.main()
