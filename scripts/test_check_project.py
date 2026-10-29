"""Small regression checks for the repository checker, using only the standard library."""
import contextlib
import io
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import check_project


class ProjectChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'project'
        shutil.copytree(
            check_project.ROOT, self.root,
            ignore=shutil.ignore_patterns('.git', '__pycache__', 'node_modules', 'dist'),
        )

    def check(self):
        with patch.object(check_project, 'ROOT', self.root):
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                return check_project.check()

    def test_current_structure_passes(self):
        self.assertEqual(self.check(), 0)

    def test_broken_code_documentation_link_fails(self):
        path = self.root / 'code/README.md'
        path.write_text(path.read_text() + '\n[Missing](missing.md)\n')
        self.assertEqual(self.check(), 1)

    def test_changed_historical_source_fails(self):
        path = self.root / 'code/orthopaul/package.json'
        path.write_bytes(path.read_bytes() + b'\n')
        self.assertEqual(self.check(), 1)


if __name__ == '__main__':
    unittest.main()
