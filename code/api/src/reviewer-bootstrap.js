import { createAuth } from './auth.js';
import { readConfig } from './config.js';
import { createReviewerBootstrapRepository } from './reviewer-bootstrap-repository.js';

const [action, operator, ...extra] = process.argv.slice(2);
if (!['grant', 'revoke'].includes(action) || !operator || extra.length) {
  throw new Error('Usage: node --env-file-if-exists=.env src/reviewer-bootstrap.js grant|revoke "Local operator name"');
}
const config = readConfig();
if (!config.physicianReviewNotifyEmail) {
  throw new Error('Set PHYSICIAN_REVIEW_NOTIFY_EMAIL to the intended reviewer account before bootstrap.');
}
const runtime = createAuth(config, { forMigration: true });
try {
  const requiredTables = ['user', 'session', 'twoFactor', 'physician_reviewer_grant', 'physician_reviewer_audit'];
  const tableExists = runtime.database.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?
  `);
  const missing = requiredTables.filter(table => !tableExists.get(table));
  if (missing.length) {
    throw new Error(`Reviewer bootstrap schema is missing (${missing.join(', ')}); run the explicit migration first: npm run migrate`);
  }
  const repository = createReviewerBootstrapRepository(runtime.database, config.physicianReviewNotifyEmail);
  const result = action === 'grant' ? repository.grant(operator) : repository.revoke(operator);
  console.log(`Reviewer bootstrap ${action}: ${result.status}${result.changed ? '' : ' (unchanged)'}`);
} finally {
  runtime.close();
}
