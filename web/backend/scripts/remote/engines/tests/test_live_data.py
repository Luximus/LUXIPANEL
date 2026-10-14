import concurrent.futures
import json
import os
from pathlib import Path
import select
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ENGINES = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINES))
import live_watch
import common
import worker
import run_entry


class WatcherTests(unittest.TestCase):
    def test_atomic_rename_and_delete_are_observed(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(live_watch, 'sources', return_value={'nginx/sites':[directory]}):
            watcher = live_watch.Watcher()
            try:
                watcher.rebuild()
                temporary = Path(directory)/'temporary'
                temporary.write_text('server {}')
                temporary.rename(Path(directory)/'site.conf')
                select.select([watcher.fd], [], [], 1)
                keys, _ = watcher.read()
                self.assertIn('nginx/sites',keys)
                (Path(directory)/'site.conf').unlink()
                select.select([watcher.fd], [], [], 1)
                self.assertIn('nginx/sites',watcher.read()[0])
            finally: os.close(watcher.fd)

    def test_move_out_of_watched_directory_is_observed(self):
        with tempfile.TemporaryDirectory() as directory:
            watched=Path(directory)/'sites'; watched.mkdir()
            source=watched/'site.conf'; source.write_text('server {}')
            with patch.object(live_watch,'sources',return_value={'nginx/sites':[str(watched)]}):
                watcher=live_watch.Watcher()
                try:
                    watcher.rebuild()
                    source.rename(Path(directory)/'disabled.conf')
                    select.select([watcher.fd],[],[],.25)
                    self.assertIn('nginx/sites',watcher.read()[0])
                finally: os.close(watcher.fd)

    def test_overflow_requests_full_enabled_reconciliation(self):
        watcher=live_watch.Watcher()
        try:
            event=struct.pack('iIII',-1,live_watch.OVERFLOW,0,0)
            with patch.object(live_watch.os,'read',return_value=event), patch.object(live_watch,'enabled_keys',return_value={'users/system'}):
                self.assertEqual(watcher.read(),({'users/system'},True))
        finally: os.close(watcher.fd)

    def test_disabled_collection_is_not_eligible(self):
        with patch.object(common,'load_json',return_value={'users/system':{'enabled':False}}), patch.object(common,'load_policy',return_value=[{'module':'users','collection':'system'},{'module':'nginx','collection':'sites'}]):
            self.assertEqual(live_watch.enabled_keys(),{'nginx/sites'})


class CollectorTests(unittest.TestCase):
    def test_failed_or_timed_out_collector_marks_view_stale_once(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ,{'LUXIPANEL_CONFIG_DIR':directory}), patch('live_view.mark_stale') as stale:
            with patch.object(run_entry.subprocess,'run',return_value=subprocess.CompletedProcess([],1)):
                self.assertEqual(run_entry.run('users','system',['unused']),1)
            with patch.object(run_entry.subprocess,'run',side_effect=subprocess.TimeoutExpired('unused',110)):
                self.assertEqual(run_entry.run('users','system',['unused']),124)
            self.assertEqual(stale.call_args_list,[(('users','system'),),(('users','system'),)])

    def test_strict_dispatcher_rejects_missing_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            result=subprocess.run(['bash',str(ENGINES/'dispatcher.sh'),'--entry','users','system'],env=dict(os.environ,LUXIPANEL_CONFIG_DIR=directory,LXP_REFRESH_STRICT='1'),capture_output=True,timeout=3)
            self.assertEqual(result.returncode,1)

    def test_refresh_failure_reports_false_without_repeating_the_write(self):
        with patch.object(worker.subprocess,'run',return_value=subprocess.CompletedProcess([],1)) as run:
            self.assertFalse(worker.trigger_refresh([['users','system']]))
            self.assertEqual(run.call_count,1)
            self.assertEqual(run.call_args.kwargs['env']['LXP_REFRESH_STRICT'],'1')

    def test_strict_collector_cannot_report_success_without_redis(self):
        with patch.dict(os.environ,{'LXP_REFRESH_STRICT':'1'}),patch.object(common,'load_conn',return_value=None):
            self.assertEqual(common.run_collector_main(['collector','users','system'],gather_fn=lambda:[]),1)

    def test_shared_slots_limit_two_collectors_and_serialize_the_same_collection(self):
        with tempfile.TemporaryDirectory() as directory:
            trace=Path(directory)/'trace.jsonl'
            code='''import os,time,json,fcntl,sys
def record(kind):
 with open(sys.argv[1],'a') as f:
  fcntl.flock(f,fcntl.LOCK_EX)
  f.write(json.dumps([time.monotonic(),kind,sys.argv[2],os.getpid()])+"\\n")
record('start'); time.sleep(.15); record('end')
'''
            env=dict(os.environ,LUXIPANEL_CONFIG_DIR=directory)
            def run(key):
                return subprocess.run([sys.executable,str(ENGINES/'run_entry.py'),'test',key,sys.executable,'-c',code,str(trace),key],env=env,timeout=10).returncode
            with concurrent.futures.ThreadPoolExecutor(4) as pool:
                self.assertEqual(list(pool.map(run,['same','same','two','three'])),[0,0,0,0])
            active=set(); peak=0
            for _,kind,key,pid in sorted(json.loads(line) for line in trace.read_text().splitlines()):
                if kind=='start':
                    self.assertNotIn(key,[item[0] for item in active]);active.add((key,pid));peak=max(peak,len(active))
                else: active.remove((key,pid))
            self.assertEqual(peak,2);self.assertFalse(active)

if __name__=='__main__': unittest.main()
