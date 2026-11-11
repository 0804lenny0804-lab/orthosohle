import assert from 'node:assert/strict';
import test from 'node:test';
import { authRequest } from '../src/features/account/auth-api.js';

test('physician review configuration failure is shown as a configuration issue, not server outage', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json(
    { error: 'notification_recipient_not_configured' },
    { status: 503 },
  );

  await assert.rejects(authRequest('/api/physician-review', {}), error => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'notification_recipient_not_configured');
    assert.match(error.message, /Prüfstelle serverseitig noch nicht eingerichtet/);
    assert.match(error.message, /kein Antrag gespeichert/);
    return true;
  });
});
