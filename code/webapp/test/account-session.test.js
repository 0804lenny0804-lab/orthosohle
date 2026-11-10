import assert from 'node:assert/strict';
import test from 'node:test';
import { accountSession } from '../src/features/account/session.js';

test('expired profile writes clear identity and failed refresh cannot keep authenticated status', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const identity = { id: 'synthetic-a', name: 'Synthetic A', email: 'a@example.invalid', emailVerified: true };
  globalThis.fetch = async () => Response.json(identity);
  await accountSession.refresh();
  assert.equal(accountSession.state.status, 'authenticated');
  globalThis.fetch = async () => Response.json({}, { status: 401 });
  assert.equal(await accountSession.saveProfile('Changed'), false);
  assert.equal(accountSession.state.status, 'anonymous');
  assert.equal(accountSession.state.identityId, null);
  assert.equal(accountSession.state.name, '');
  globalThis.fetch = async () => Response.json(identity);
  await accountSession.refresh();
  globalThis.fetch = async () => Response.json({}, { status: 403 });
  assert.equal(await accountSession.refresh(), false);
  assert.equal(accountSession.state.status, 'unavailable');
  assert.equal(accountSession.state.identityId, null);
});
