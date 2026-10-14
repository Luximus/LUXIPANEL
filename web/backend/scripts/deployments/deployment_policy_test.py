import http.server
import threading
import unittest
from deployment_policy import healthy_components


class Handler(http.server.BaseHTTPRequestHandler):
    seen = []

    def do_GET(self):
        self.seen.append(self.path)
        self.send_response(200 if self.path == '/health' else 302 if self.path == '/redirect' else 404)
        if self.path == '/redirect':
            self.send_header('Location', '/health')
        self.end_headers()

    def log_message(self, *args):
        pass


class HealthPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def check(self, path='/health', **changes):
        part = {'name': 'api', 'surface': 'http', 'port': self.server.server_port, **changes}
        healthy_components([part], [{'name': 'api', 'surface': 'http', 'healthPath': path}], attempts=1)

    def test_successful_health(self):
        self.check()

    def test_missing_endpoint_is_not_a_healthy_application(self):
        with self.assertRaisesRegex(RuntimeError, 'runtime_health_failed'):
            self.check('/missing')

    def test_redirects_cannot_make_a_supervisor_request_elsewhere(self):
        Handler.seen.clear()
        with self.assertRaisesRegex(RuntimeError, 'runtime_health_failed'):
            self.check('/redirect')
        self.assertEqual(Handler.seen, ['/redirect'])

    def test_invalid_port_and_component(self):
        for port in [True, 0, 65536, '8080', '80@169.254.169.254']:
            with self.assertRaisesRegex(RuntimeError, 'invalid_result_port'):
                self.check(port=port)
        with self.assertRaisesRegex(RuntimeError, 'invalid_result_component'):
            self.check(name='other')

    def test_health_path_cannot_change_target(self):
        for path in ['http://169.254.169.254/', '//169.254.169.254/', '/\r\nHost:evil']:
            with self.assertRaises(RuntimeError):
                self.check(path)


if __name__ == '__main__':
    unittest.main()
