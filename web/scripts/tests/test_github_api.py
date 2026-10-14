import io
import json
import os
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.response import addinfourl


spec = spec_from_file_location("prepare_release", Path(__file__).parents[1] / "prepare-release.py")
prepare = module_from_spec(spec)
spec.loader.exec_module(prepare)
URL = "https://api.github.com/repos/Luxisoft/LUXIPANEL/actions/permissions/workflow"


class GithubApiTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"GH_TOKEN": ""})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_successful_workflow_permission_update_has_no_response_body(self):
        response = addinfourl(io.BytesIO(b""), {}, URL, code=204)
        settings = {"default_workflow_permissions": "read", "can_approve_pull_request_reviews": True}
        with patch.object(prepare.urllib.request, "urlopen", return_value=response) as request:
            self.assertIsNone(prepare.api("/actions/permissions/workflow", "PUT", settings))
        sent = request.call_args.args[0]
        self.assertEqual(sent.get_method(), "PUT")
        self.assertEqual(json.loads(sent.data), settings)

    def test_json_responses_still_return_their_data(self):
        response = addinfourl(io.BytesIO(b'{"default_workflow_permissions":"read"}'), {}, URL, code=200)
        with patch.object(prepare.urllib.request, "urlopen", return_value=response):
            self.assertEqual(prepare.api("/actions/permissions/workflow"), {"default_workflow_permissions": "read"})

    def test_empty_json_response_is_not_treated_as_a_successful_no_content_response(self):
        response = addinfourl(io.BytesIO(b""), {}, URL, code=200)
        with patch.object(prepare.urllib.request, "urlopen", return_value=response):
            with self.assertRaises(json.JSONDecodeError):
                prepare.api("/actions/permissions/workflow")

    def test_http_errors_are_preserved_for_callers(self):
        error = HTTPError(URL, 404, "Not Found", {}, io.BytesIO(b"{}"))
        with patch.object(prepare.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(HTTPError) as raised:
                prepare.api("/actions/permissions/workflow")
        self.assertEqual(raised.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
