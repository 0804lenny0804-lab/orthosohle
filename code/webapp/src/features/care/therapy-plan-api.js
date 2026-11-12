import { authRequest } from '../account/auth-api.js';

function validatePlan(plan) {
  return plan && typeof plan.id === 'string' && typeof plan.patientId === 'string'
    && typeof plan.relationshipId === 'string'
    && Number.isInteger(plan.version) && plan.version > 0
    && Number.isFinite(plan.limitKg) && plan.limitKg > 0
    && plan.unit === 'kg' && typeof plan.authoredBy === 'string'
    && typeof plan.authorName === 'string' && plan.authorName.trim().length > 0
    && typeof plan.createdAt === 'string' && Number.isFinite(Date.parse(plan.createdAt));
}

export function isValidTherapyLimit(value) {
  const scaledValue = value * 1000;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1_000_000
    && Math.abs(scaledValue - Math.round(scaledValue)) <= 1e-8;
}

export function parsePhysicianPlans(value) {
  if (!Array.isArray(value?.plans) || !value.plans.every(validatePlan)
    || !(value.currentVersion === null || (Number.isInteger(value.currentVersion) && value.currentVersion > 0))) {
    throw new Error('Der Server hat eine ungültige Planhistorie zurückgegeben.');
  }
  if (value.currentVersion !== null && !value.plans.some(plan => plan.version === value.currentVersion)) {
    throw new Error('Die aktuelle Beziehungsversion fehlt in der Planhistorie.');
  }
  return { plans: value.plans, currentVersion: value.currentVersion };
}

export function parsePatientPlan(value) {
  const plan = value?.plan;
  if (plan !== null && !validatePlan(plan)) throw new Error('Der Server hat einen ungültigen Therapieplan zurückgegeben.');
  if (value?.previousPlanStatus !== null && value?.previousPlanStatus !== 'continuation_undetermined') {
    throw new Error('Der Server hat einen ungültigen Status zur früheren Planversion zurückgegeben.');
  }
  const relationship = value?.relationship;
  if (relationship !== null && (!relationship || typeof relationship.relationshipId !== 'string'
    || typeof relationship.physicianUserId !== 'string' || typeof relationship.status !== 'string'
    || typeof relationship.physicianApprovalStatus !== 'string')) {
    throw new Error('Der Server hat eine ungültige Betreuungszuordnung zurückgegeben.');
  }
  if (value?.confirmedAt !== null && (typeof value?.confirmedAt !== 'string' || !Number.isFinite(Date.parse(value.confirmedAt)))) {
    throw new Error('Der Server hat einen ungültigen Bestätigungszeitpunkt zurückgegeben.');
  }
  if (!plan && value?.confirmedAt !== null) throw new Error('Der Server hat eine Bestätigung ohne aktuellen Plan zurückgegeben.');
  if (plan && relationship?.relationshipId !== plan.relationshipId) throw new Error('Der Therapieplan gehört nicht zur aktuellen Betreuungszuordnung.');
  return { plan, confirmedAt: value.confirmedAt, relationship, previousPlanStatus: value.previousPlanStatus };
}

export const therapyPlanApi = {
  listForPhysician(patientId) {
    return authRequest(`/api/care/physician/patients/${encodeURIComponent(patientId)}/therapy-plans`);
  },
  createForPhysician(patientId, limitKg, expectedVersion) {
    return authRequest(`/api/care/physician/patients/${encodeURIComponent(patientId)}/therapy-plans`, { limitKg, expectedVersion });
  },
  getForPatient() {
    return authRequest('/api/care/patient/therapy-plan');
  },
  confirmForPatient(versionId) {
    return authRequest('/api/care/patient/therapy-plan/confirm', { versionId });
  },
};
