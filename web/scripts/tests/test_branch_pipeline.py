import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import os
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + '.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

policy = load('branch-policy')
pipeline = load('combined-release')
scope = load('check-branch-scope')
guard = load('release-snapshot-guard')
verifier = load('verify-repair')
SHA = 'a' * 40


class PolicyTests(unittest.TestCase):
    def test_classifies_clients_and_shared_tooling(self):
        for client in ('web', 'desktop', 'mobile'):
            self.assertEqual(policy.target_for([client + '/src/file.ts']), client)
        for files in [['web/scripts/build.py'], ['desktop/a', 'mobile/a'], ['.github/workflows/ci.yml']]:
            self.assertEqual(policy.target_for(files), 'developer')

    def test_modules_are_separate_and_one_at_a_time(self):
        self.assertEqual(policy.target_for(['web/modules/example-module/src/a.ts']), 'modules')
        for files in [['web/modules/one-module/a', 'web/backend/a'], ['web/modules/one-module/a', 'web/modules/two-module/a']]:
            with self.assertRaises(ValueError): policy.target_for(files)
        with self.assertRaises(ValueError): policy.assert_scope('developer', ['web/modules/example-module/a'])

    def test_scope_rejects_wrong_client(self):
        with self.assertRaises(ValueError): policy.assert_scope('web', ['desktop/a'])
        policy.assert_scope('developer', ['web/a', 'desktop/b'])

    def test_owner_review_is_retained_only_for_release(self):
        main = policy.protection('main')
        self.assertEqual(main['required_pull_request_reviews']['required_approving_review_count'], 1)
        self.assertTrue(main['required_pull_request_reviews']['require_code_owner_reviews'])
        for branch in ('web', 'desktop', 'mobile', 'modules'):
            self.assertEqual(policy.protection(branch)['required_pull_request_reviews']['required_approving_review_count'], 0)
        for branch in policy.PERMANENT:
            self.assertFalse(policy.protection(branch)['allow_force_pushes'])
            self.assertFalse(policy.protection(branch)['allow_deletions'])

    def test_only_fixed_names_exempt_from_creation_restriction(self):
        data = policy.creation_ruleset()
        self.assertEqual(data['rules'], [{'type': 'creation'}])
        self.assertEqual(set(data['conditions']['ref_name']['exclude']), {'refs/heads/' + name for name in (*policy.PERMANENT, policy.TEMPORARY)})
        self.assertEqual(data['bypass_actors'], [])


class SnapshotTests(unittest.TestCase):
    def run_data(self):
        return {'conclusion': 'success', 'path': '.github/workflows/developer-checks.yml', 'event': 'workflow_dispatch', 'head_repository': {'full_name': 'Luxisoft/LUXIPANEL'}, 'head_branch': 'developer', 'head_sha': SHA}

    def test_rejects_failed_stale_or_fork_checks(self):
        with patch.object(pipeline, 'ref', return_value=SHA), patch.object(pipeline.prepare, 'api', return_value={'workflow_runs': [{**self.run_data(), 'id': 1}]}):
            self.assertEqual(pipeline.valid_run(self.run_data(), 'developer-checks.yml', ['developer']), SHA)
            for key, value in [('conclusion', 'failure'), ('event', 'pull_request'), ('head_sha', 'b'*40), ('head_repository', {'full_name': 'someone/LUXIPANEL'})]:
                with self.assertRaises(ValueError): pipeline.valid_run({**self.run_data(), key: value}, 'developer-checks.yml', ['developer'])

    def test_later_failed_check_prevents_automatic_promotion(self):
        with patch.object(pipeline, 'ref', return_value=SHA), patch.object(pipeline.prepare, 'api', return_value={'workflow_runs': [{**self.run_data(), 'id': 1}, {**self.run_data(), 'id': 2, 'conclusion': 'failure'}]}):
            with self.assertRaisesRegex(ValueError, 'Latest checks'): pipeline.valid_run(self.run_data(), 'developer-checks.yml', ['developer'])

    def test_freezes_tested_module_list_without_late_additions(self):
        module = {'id': 'test-module', 'commit': SHA, 'version': '1.0.0', 'versionId': 'id'}
        lock = {'modules': [module]}
        result = pipeline.snapshot_candidates(lock, {'modules': [module, {**module, 'id': 'later-module'}]})
        self.assertEqual(result['modules'], [module])
        with self.assertRaises(ValueError): pipeline.snapshot_candidates(lock, {'modules': []})
        with self.assertRaises(ValueError): pipeline.snapshot_candidates(lock, {'modules': [{**module, 'commit': 'b'*40}]})

    def test_unapproved_module_directory_blocks_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'web/modules/unapproved').mkdir(parents=True)
            with self.assertRaises(ValueError): pipeline.assert_module_sources(root, {'modules': []})

    def test_stale_developer_blocks_release(self):
        pull = {'labels': [{'name': 'release'}], 'body': 'Developer tested: `' + SHA + '`'}
        with patch.object(guard.prepare, 'api', return_value={'object': {'sha': 'b'*40}}):
            with self.assertRaisesRegex(ValueError, 'Developer changed'): guard.check(pull)

    def test_latest_failed_rerun_blocks_release(self):
        data = self.run_data()
        with patch.object(guard.prepare, 'api', side_effect=[{'object': {'sha': SHA}}, {'workflow_runs': [{**data, 'id': 1}, {**data, 'id': 2, 'conclusion': 'failure'}]}]):
            with self.assertRaisesRegex(ValueError, 'integration CI'): guard.check({'labels': [{'name': 'release'}], 'body': 'Developer tested: `' + SHA + '`'})

    def test_bootstrap_is_not_a_release(self):
        with patch.object(guard.prepare, 'api') as api:
            guard.check({'labels': [{'name': 'bootstrap'}]}); api.assert_not_called()


class BaselineTests(unittest.TestCase):
    def test_baseline_preserves_exact_module_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            def git(*args): return subprocess.check_output(['git', *args], cwd=directory, text=True).strip()
            git('init', '-b', 'modules'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test')
            root = Path(directory); (root / 'web/modules/test-module').mkdir(parents=True)
            (root / 'web/modules/test-module/source.ts').write_text('original')
            git('add', '.'); git('commit', '-m', 'module'); old = git('rev-parse', 'HEAD')
            (root / 'readme').write_text('baseline'); git('add', '.'); git('commit', '-m', 'baseline'); new = git('rev-parse', 'HEAD')
            pull = {'base': {'ref': 'modules', 'sha': old}, 'head': {'ref': 'lxp/release-next', 'sha': new, 'repo': {'full_name': 'Luxisoft/LUXIPANEL'}}, 'user': {'login': 'github-actions[bot]'}}
            import os
            previous = os.getcwd()
            try:
                os.chdir(directory); scope.validate(pull, ['readme'])
                (root / 'web/modules/test-module/source.ts').write_text('tampered'); git('add', '.'); git('commit', '-m', 'tamper')
                pull['head']['sha'] = git('rev-parse', 'HEAD')
                with self.assertRaisesRegex(ValueError, 'module sources'): scope.validate(pull, ['readme'])
            finally: os.chdir(previous)

    def test_human_cannot_spoof_internal_pr(self):
        pull = {'base': {'ref': 'web'}, 'head': {'ref': 'developer', 'repo': {'full_name': 'Luxisoft/LUXIPANEL'}}, 'user': {'login': 'someone'}}
        with self.assertRaises(ValueError): scope.validate(pull, ['web/source.ts'])


class RepairRecipesTests(unittest.TestCase):
    def test_native_recipes_never_publish_or_sign(self):
        for name in ('desktop-types', 'desktop-tests', 'desktop-build', 'mobile-types', 'mobile-tests'):
            command = verifier.RECIPES[name]
            self.assertNotIn('submit', command); self.assertNotIn('dist', command); self.assertNotIn('eas', command)
        self.assertIn('--noEmit', verifier.RECIPES['mobile-types'])

    def test_monorepo_check_runs_under_correct_client(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'web/backend').mkdir(parents=True)
            (root / 'web/backend/package.json').write_text('{}'); (root / 'web/backend/node_modules').mkdir()
            with patch.object(verifier, 'sandbox', return_value=subprocess.CompletedProcess([], 0, '', '')) as sandbox:
                verifier.verify(root, 'backend-types')
                self.assertEqual(sandbox.call_args.args[1][:3], ['pnpm', '--dir', 'web/backend'])


class RealGitPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'repo'; self.root.mkdir()
        self.remote = Path(self.temp.name) / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(self.remote)], check=True, capture_output=True)
        self.git('init', '-b', 'main'); self.git('config', 'user.email', 'test@example.invalid'); self.git('config', 'user.name', 'Test')
        for area in ('web/backend', 'web/frontend', 'desktop', 'mobile'):
            (self.root / area).mkdir(parents=True)
            (self.root / area / 'package.json').write_text(json.dumps({'name': area, 'version': '1.0.0'}))
        (self.root / 'mobile/app.json').write_text('{"expo":{"version":"1.0.0"}}')
        (self.root / 'release.manifest.json').write_text('{"format":1,"version":"1.0.0","contributions":[],"modules":[]}')
        (self.root / 'modules.lock.json').write_text('{"format":1,"modules":[]}')
        (self.root / 'web/backend/source.ts').write_text('initial\n')
        self.save('base'); self.base = self.git('rev-parse', 'HEAD')
        self.git('tag', 'v1.0.0'); self.git('remote', 'add', 'origin', str(self.remote))
        self.git('branch', 'developer'); self.git('branch', 'web')
        self.git('push', 'origin', '--all'); self.git('push', 'origin', '--tags')
        self.previous = os.getcwd(); os.chdir(self.root)

    def tearDown(self):
        os.chdir(self.previous); self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True, stderr=subprocess.DEVNULL).strip()

    def save(self, subject):
        self.git('add', '.'); self.git('commit', '-m', subject)

    def ref(self, branch):
        return self.git('ls-remote', 'origin', 'refs/heads/' + branch).split()[0]

    def test_post_merge_client_is_promoted_with_history_and_dispatch(self):
        self.git('checkout', 'web')
        (self.root / 'web/backend/source.ts').write_text('fixed\n'); self.save('fix: source')
        sha = self.git('rev-parse', 'HEAD'); self.git('push', 'origin', 'web')
        self.git('checkout', 'main')
        event = self.root.parent / 'event.json'; event.write_text('{"workflow_run":{"id":42}}')
        run = {'id':42, 'head_sha':sha, 'head_branch':'web', 'head_repository':{'full_name':'Luxisoft/LUXIPANEL'}, 'path':'.github/workflows/client-checks.yml', 'event':'push', 'conclusion':'success'}
        def api(route, *args):
            return {'workflow_runs':[run]} if '/actions/workflows/' in route else run
        with patch.dict(os.environ, {'GITHUB_EVENT_PATH':str(event), 'GITHUB_REF':'refs/heads/main'}), patch.object(pipeline, 'ref', side_effect=self.ref), patch.object(pipeline.prepare, 'api', side_effect=api), patch.object(pipeline.relay, 'lp', return_value={'modules':[]}), patch.object(pipeline, 'dispatch') as dispatch:
            pipeline.main()
            dispatch.assert_called_once_with('developer-checks.yml', 'developer')
        self.assertEqual(self.ref('developer'), sha)
        self.assertEqual((self.root / 'web/backend/source.ts').read_text(), 'initial\n')

    def test_release_versions_are_stamped_without_executing_candidate_scripts(self):
        self.git('checkout', 'developer')
        (self.root / 'web/backend/source.ts').write_text('fixed\n'); self.save('fix: source')
        sha = self.git('rev-parse', 'HEAD'); self.git('push', 'origin', 'developer')
        run = {'id':42, 'html_url':'https://github.com/Luxisoft/LUXIPANEL/actions/runs/42'}
        with patch.object(pipeline, 'ref', side_effect=self.ref), patch.object(pipeline.prepare, 'api', return_value=[]), patch.object(pipeline, 'artifact_manifest', return_value={'format':1,'modules':[]}), patch.object(pipeline, 'pull') as pull, patch.object(pipeline, 'dispatch') as dispatch:
            pipeline.prepare_snapshot(sha, run, {'modules':[]}, self.root)
            self.assertIn('Developer tested: `' + sha + '`', pull.call_args.args[3])
            dispatch.assert_called_once_with('release-checks.yml', 'lxp/release-next')
        self.assertEqual(self.git('rev-parse', 'v1.0.0'), self.base)
        for area in ('web/backend','web/frontend','desktop','mobile'):
            self.assertEqual(json.loads((self.root / area / 'package.json').read_text())['version'], '1.0.1')
        self.assertEqual(self.ref('developer'), sha)
        self.assertNotEqual(self.ref('lxp/release-next'), sha)


if __name__ == '__main__': unittest.main()
