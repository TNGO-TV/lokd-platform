"""Runs existing isolated scenarios with the exact owner-authorised dummy PDF.

No hosted calls or actual provider writes. Run from the LOKD repository root.
"""
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[3]
pdf = Path(__file__).with_name('LOKD-DUMMY-TERMS-2026-09-24-v1.pdf')
source = (repo / 'tests/quote-acceptance.test.mjs').read_text()
source = source.replace("'../app/", "'" + str(repo / 'app') + '/')
old = "contentBase64:btoa('%PDF-1.7\\nIsolated test bytes; not a legal contract.\\n%%EOF')"
assert source.count(old) == 1, 'Fixture changed: review adaptation before running'
source = source.replace(old, "contentBase64:fs.readFileSync(" + repr(str(pdf)) + ").toString('base64')")
source = source.replace("title:'Isolated synthetic terms fixture',version:'fixture-v1'", "title:'DUMMY - LOKD designated synthetic test terms',version:'LOKD-DUMMY-TERMS-2026-09-24-v1'")
with tempfile.TemporaryDirectory(prefix='lokd-dummy-quotes-') as temp:
    script = Path(temp) / 'quote-acceptance.mjs'
    script.write_text(source)
    subprocess.run(['node', '--experimental-loader=./tests/cloudflare-loader.mjs', str(script)], cwd=repo, check=True)
