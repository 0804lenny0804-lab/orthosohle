import { createAuth } from './auth.js';
import { readConfig } from './config.js';
import { PhysicianApprovalRevocationError, createPhysicianApprovalRevocationRepository } from './physician-approval-revocation.js';

const [action, operator, targetEmail, ...extra] = process.argv.slice(2);
if (action !== 'revoke' || !operator || !targetEmail || extra.length) {
  throw new Error('Usage: node --env-file-if-exists=.env src/physician-approval-revoke.js revoke "Local operator name" "target@example.invalid"');
}

const runtime = createAuth(readConfig(), { forMigration: true });
try {
  const requiredTables = [
    'user', 'session', 'physician_review_application',
    'physician_review_approval_token', 'physician_review_approval_audit',
  ];
  const tableExists = runtime.database.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?
  `);
  const missing = requiredTables.filter(table => !tableExists.get(table));
  if (missing.length) {
    throw new Error(`Physician approval schema is missing (${missing.join(', ')}); run the explicit migration first: npm run migrate`);
  }
  const repository = createPhysicianApprovalRevocationRepository(runtime.database);
  const result = repository.revoke(operator, targetEmail);
  console.log(`Physician approval revoke: ${result.status}${result.changed ? '' : ' (unchanged)'}`);
} catch (error) {
  if (error instanceof PhysicianApprovalRevocationError) {
    console.error(`Physician approval revoke failed: ${error.code}`);
  } else {
    console.error('Physician approval revoke failed; no change was committed.');
  }
  process.exitCode = 1;
} finally {
  runtime.close();
}
