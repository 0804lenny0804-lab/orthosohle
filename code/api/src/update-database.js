import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from './sign-in/create-auth.js';
import { readConfig } from './config.js';
import { migratePatientProfiles } from './accounts/database-changes/patient-profile.js';
import { migrateMeasurementFeedback } from './measurements/database-changes/measurement-feedback.js';
import { migratePhysicianReview } from './patient-doctor-relationship/doctor-access-request/database-changes/request.js';
import { migrateTwoFactorSessions } from './sign-in/database-changes/two-factor-session.js';
import { migrateReviewerBootstrap } from './patient-doctor-relationship/local-reviewer-access/database-changes/reviewer.js';
import { migrateTotpStepUp } from './sign-in/database-changes/recent-totp-check.js';
import { migratePhysicianApproval } from './patient-doctor-relationship/doctor-access-approval/database-changes/approval.js';
import { migratePatientRelations } from './patient-doctor-relationship/patient-relations.js';
import { migrateTherapyPlans } from './treatment-plans/database-changes/therapy-plan.js';

const runtime = createAuth(readConfig(), { forMigration: true });
try {
  const { runMigrations } = await getMigrations(runtime.auth.options);
  await runMigrations();
  migratePatientProfiles(runtime.database);
  migrateMeasurementFeedback(runtime.database);
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
