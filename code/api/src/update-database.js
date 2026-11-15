import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from './sign-in/create-auth.js';
import { readConfig } from './config.js';
import { migratePatientProfiles } from './accounts/patient-profile-database-change.js';
import { migratePhysicianReview } from './doctor-access/request/physician-review-database-change.js';
import { migrateTwoFactorSessions } from './sign-in/two-factor-session-database-change.js';
import { migrateReviewerBootstrap } from './doctor-access/reviewer/reviewer-bootstrap-database-change.js';
import { migrateTotpStepUp } from './sign-in/recent-totp-check-database-change.js';
import { migratePhysicianApproval } from './doctor-access/approval/physician-approval-database-change.js';
import { migratePatientRelations } from './patient-doctor-relationship/patient-relations.js';
import { migrateTherapyPlans } from './treatment-plans/therapy-plan-database-change.js';

const runtime = createAuth(readConfig(), { forMigration: true });
try {
  const { runMigrations } = await getMigrations(runtime.auth.options);
  await runMigrations();
  migratePatientProfiles(runtime.database);
  migratePhysicianReview(runtime.database);
  migrateTwoFactorSessions(runtime.database);
  migrateReviewerBootstrap(runtime.database);
  migrateTotpStepUp(runtime.database);
  migratePhysicianApproval(runtime.database);
  migratePatientRelations(runtime.database);
  migrateTherapyPlans(runtime.database);
  console.log('Local authentication, TOTP, patient profile, and physician review schemas migrated.');
} finally {
  runtime.close();
}
