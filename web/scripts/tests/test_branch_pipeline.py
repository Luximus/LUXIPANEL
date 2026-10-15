import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import os
from unittest.mock import patch
import urllib.error

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
        self.assertEqual(set(data['conditions']['ref_name']['exclude']), {'refs/heads/' + name for name in (*policy.PERMANENT, policy.BOOTSTRAP, policy.BASELINE)} | {'refs/heads/release/*','refs/heads/hotfix/*'})
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

    def test_developer_can_advance_without_invalidating_frozen_source(self):
        provenance = {'format':1,'kind':'release','sourceSha':SHA,'sourceAttempt':1}
        guard.validate_provenance(provenance, self.run_data(), 'release/1.1.0', '1.1.0')
        with self.assertRaisesRegex(ValueError, 'frozen source'):
            guard.validate_provenance(provenance, {**self.run_data(),'head_sha':'b'*40}, 'release/1.1.0', '1.1.0')

    def test_failed_frozen_source_checks_block_publication(self):
        with self.assertRaisesRegex(ValueError, 'not passed'):
            guard.validate_provenance({'format':1,'kind':'release','sourceSha':SHA}, {**self.run_data(),'conclusion':'failure'}, 'release/1.0.1', '1.0.1')

    def test_hotfix_checks_are_bound_to_trusted_main_and_exact_source(self):
        run = {**self.run_data(),'path':'.github/workflows/hotfix-checks.yml','head_branch':'main','display_title':'Hotfix checks hotfix/1.0.1 @ '+SHA}
        provenance = {'format':1,'kind':'hotfix','sourceSha':SHA}
        guard.validate_provenance(provenance, run, 'hotfix/1.0.1', '1.0.1')
        for change in [{'head_branch':'developer'}, {'display_title':'Hotfix checks hotfix/1.0.1 @ '+'b'*40}, {'head_repository':{'full_name':'someone/LUXIPANEL'}}]:
            with self.assertRaises(ValueError): guard.validate_provenance(provenance, {**run,**change}, 'hotfix/1.0.1', '1.0.1')

    def test_bootstrap_is_not_a_release(self):
        pull = {'base':{'ref':'main'},'head':{'repo':{'full_name':'Luxisoft/LUXIPANEL'},'ref':'lxp/release-next'},'user':{'login':'github-actions[bot]'},'labels':[{'name':'bootstrap'}]}
        with patch.object(guard.prepare, 'api') as api:
            guard.check(pull); api.assert_not_called()

    def test_older_frozen_versions_are_requested_by_id(self):
        row = {'id':'test-module','versionId':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','version':'1.0.0','commit':SHA,'manifest':{}}
        with patch.object(pipeline.relay, 'lp', return_value={'modules':[row]}) as api:
            self.assertEqual(pipeline.exact_candidates({'modules':[row]})['modules'],[row])
            self.assertIn('?versionIds='+row['versionId'],api.call_args.args[0])
        with patch.object(pipeline.relay, 'lp', return_value={'modules':[]}):
            with self.assertRaises(ValueError): pipeline.exact_candidates({'modules':[row]})


class BaselineTests(unittest.TestCase):
    def test_baseline_preserves_exact_module_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            def git(*args): return subprocess.check_output(['git', *args], cwd=directory, text=True).strip()
            git('init', '-b', 'modules'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test')
            root = Path(directory); (root / 'web/modules/test-module').mkdir(parents=True)
            (root / 'web/modules/test-module/source.ts').write_text('original')
            git('add', '.'); git('commit', '-m', 'module'); old = git('rev-parse', 'HEAD')
            (root / 'readme').write_text('baseline'); git('add', '.'); git('commit', '-m', 'baseline'); new = git('rev-parse', 'HEAD')
            pull = {'base': {'ref': 'modules', 'sha': old}, 'head': {'ref': 'automation/modules-baseline', 'sha': new, 'repo': {'full_name': 'Luxisoft/LUXIPANEL'}}, 'user': {'login': 'github-actions[bot]'}}
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
        rows = self.git('ls-remote', 'origin', 'refs/heads/' + branch).split()
        if not rows: raise urllib.error.HTTPError('test',404,'Missing ref',{},None)
        return rows[0]

    def test_accepted_clients_share_one_developer_branch(self):
        for files in [['web/backend/source.ts'],['mobile/src/a.ts'],['desktop/src/a.ts'],['web/a.ts','mobile/b.ts']]:
            policy.assert_scope('developer',files)
        self.assertEqual(policy.PERMANENT,('main','developer','modules'))

    def test_release_versions_are_stamped_without_executing_candidate_scripts(self):
        self.git('checkout', 'developer')
        (self.root / 'web/backend/source.ts').write_text('fixed\n'); self.save('fix: source')
        sha = self.git('rev-parse', 'HEAD'); self.git('push', 'origin', 'developer')
        run = {'id':42,'run_attempt':1, 'html_url':'https://github.com/Luxisoft/LUXIPANEL/actions/runs/42'}
        def api(route, *args): return {'tag_name':'v1.0.0'} if route == '/releases/latest' else []
        with patch.object(pipeline, 'ref', side_effect=self.ref), patch.object(pipeline.prepare, 'api', side_effect=api), patch.object(pipeline, 'artifact_manifest', return_value={'format':1,'modules':[]}), patch.object(pipeline, 'pull') as pull, patch.object(pipeline, 'dispatch') as dispatch:
            pipeline.prepare_snapshot(sha, run, {'modules':[]}, self.root)
            self.assertIn('Frozen source: `' + sha + '`', pull.call_args.args[3])
            dispatch.assert_called_once_with('release-checks.yml', 'release/1.0.1')
        self.assertEqual(self.git('rev-parse', 'v1.0.0'), self.base)
        for area in ('web/backend','web/frontend','desktop','mobile'):
            self.assertEqual(json.loads((self.root / area / 'package.json').read_text())['version'], '1.0.1')
        self.assertEqual(self.ref('developer'), sha)
        self.assertNotEqual(self.ref('release/1.0.1'), sha)

    def test_existing_candidate_is_frozen_while_developer_advances(self):
        self.git('checkout', 'developer')
        (self.root / 'mobile/new-feature.ts').write_text('pending feature'); self.save('feat: next feature')
        sha = self.git('rev-parse','HEAD'); self.git('push','origin','developer')
        with patch.object(pipeline.prepare,'api',return_value={'tag_name':'v1.0.0'}), patch.object(pipeline,'active_candidates',return_value=[{'html_url':'https://github.com/Luxisoft/LUXIPANEL/pull/99'}]), patch.object(pipeline,'artifact_manifest') as artifact:
            pipeline.prepare_snapshot(sha,{'id':42},None,self.root)
            artifact.assert_not_called()
        self.assertEqual(self.ref('developer'),sha)

    def test_normal_preparation_waits_while_hotfix_source_is_being_tested(self):
        self.git('checkout', 'developer')
        (self.root / 'mobile/new-feature.ts').write_text('pending feature'); self.save('feat: next feature')
        sha = self.git('rev-parse', 'HEAD'); self.git('push', 'origin', 'developer')
        self.git('push', 'origin', self.base + ':refs/heads/hotfix/1.0.1')
        with patch.object(pipeline, 'ref', side_effect=self.ref), patch.object(pipeline.prepare, 'api', return_value={'tag_name':'v1.0.0'}), patch.object(pipeline, 'active_candidates', return_value=[]), patch.object(pipeline, 'artifact_manifest') as artifact:
            pipeline.prepare_snapshot(sha, {'id':42}, None, self.root)
            artifact.assert_not_called()

    def test_unreviewed_dependency_changes_are_not_version_stamping(self):
        package = self.root / 'web/backend/package.json'
        package.write_text(json.dumps({'name':'web/backend','version':'1.0.1','dependencies':{'new-unchecked-dep':'1.0.0'}}))
        self.save('stamp')
        with self.assertRaisesRegex(ValueError,'untested dependencies'):
            guard.metadata_only(self.base,self.git('rev-parse','HEAD'),'1.0.1',self.git)

    def prepare_core_hotfix(self, conflict=False):
        self.git('checkout','developer')
        (self.root / 'mobile/pending-feature.ts').write_text('not released')
        if conflict: (self.root/'web/backend/source.ts').write_text('unreleased dependency\n')
        self.save('feat: unreleased feature')
        (self.root/'web/backend/source.ts').write_text('fixed\n'); self.save('fix: production bug')
        merged = self.git('rev-parse','HEAD'); self.git('push','origin','developer')
        directory = self.root.parent/'hotfix-source'
        self.git('worktree','add','--detach',str(directory),'v1.0.0')
        pr = {'merged':True,'base':{'repo':{'full_name':'Luxisoft/LUXIPANEL'},'ref':'developer'},'merge_commit_sha':merged}
        def api(route,*args):
            if route=='/releases/latest': return {'tag_name':'v1.0.0'}
            if route=='/pulls/42': return pr
            if route.startswith('/pulls?'): return []
            raise AssertionError(route)
        return directory,api

    def test_hotfix_replays_only_the_fix_and_freezes_its_own_successful_checks(self):
        directory,api = self.prepare_core_hotfix()
        try:
            with patch.object(pipeline,'ref',side_effect=self.ref), patch.object(pipeline.prepare,'api',side_effect=api), patch.object(pipeline,'dispatch_hotfix') as dispatch:
                pipeline.prepare_hotfix(directory,'42')
                source = self.ref('hotfix/1.0.1')
                dispatch.assert_called_once_with('hotfix/1.0.1',source)
                self.assertEqual(self.git('ls-tree',source,'mobile/pending-feature.ts'),'')
                self.assertEqual(self.git('show',source+':web/backend/source.ts'),'fixed')
            run={'id':43,'run_attempt':1,'conclusion':'success','path':'.github/workflows/hotfix-checks.yml','event':'workflow_dispatch','head_branch':'main','head_repository':{'full_name':'Luxisoft/LUXIPANEL'},'display_title':'Hotfix checks hotfix/1.0.1 @ '+source}
            with patch.object(pipeline,'ref',side_effect=self.ref), patch.object(pipeline.prepare,'api',side_effect=lambda route,*args:{'tag_name':'v1.0.0'} if route=='/releases/latest' else []), patch.object(pipeline,'artifact_manifest',return_value={'format':1,'modules':[]}), patch.object(pipeline,'pull'), patch.object(pipeline,'dispatch'):
                pipeline.prepare_snapshot(source,run,None,directory,'hotfix','hotfix/1.0.1',[42])
            head=self.ref('hotfix/1.0.1')
            manifest=json.loads(self.git('show',head+':release.manifest.json'))
            self.assertEqual(manifest['version'],'1.0.1');self.assertIn(42,manifest['contributions'])
            provenance=json.loads(self.git('show',head+':release.provenance.json'))
            guard.validate_provenance(provenance,run,'hotfix/1.0.1','1.0.1')
            guard.metadata_only(source,head,'1.0.1',self.git)
            self.assertEqual(self.git('ls-tree',head,'mobile/pending-feature.ts'),'')
        finally:self.git('worktree','remove','--force',str(directory))

    def test_conflicting_hotfix_does_not_suspend_or_publish_any_candidate(self):
        directory,api = self.prepare_core_hotfix(conflict=True)
        try:
            with patch.object(pipeline,'ref',side_effect=self.ref), patch.object(pipeline.prepare,'api',side_effect=api), patch.object(pipeline,'suspend_normal_candidates') as suspend, patch.object(pipeline,'dispatch_hotfix') as dispatch:
                with self.assertRaises(subprocess.CalledProcessError):pipeline.prepare_hotfix(directory,'42')
                suspend.assert_not_called();dispatch.assert_not_called()
            with self.assertRaises(urllib.error.HTTPError):self.ref('hotfix/1.0.1')
        finally:self.git('worktree','remove','--force',str(directory))


if __name__ == '__main__': unittest.main()
