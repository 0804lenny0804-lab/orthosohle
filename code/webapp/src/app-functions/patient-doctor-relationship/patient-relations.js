export const DOCTOR_DIRECTORY_LIMIT = 25;

export function isApprovedVerifiedDoctor(doctor) {
  return doctor && typeof doctor.physicianId === 'string' && doctor.physicianId.length > 0
    && typeof doctor.displayName === 'string' && doctor.displayName.trim().length > 0
    && doctor.approved === true && doctor.emailVerified === true;
}

export function normalizeDoctorDirectory(result, expectedOffset = 0) {
  if (!Array.isArray(result?.doctors) || result.doctors.length > DOCTOR_DIRECTORY_LIMIT
    || !result.doctors.every(isApprovedVerifiedDoctor)
    || result.limit !== DOCTOR_DIRECTORY_LIMIT || result.offset !== expectedOffset
    || typeof result.hasMore !== 'boolean') {
    throw new Error('Der Server hat ein ungültiges Arztverzeichnis zurückgegeben.');
  }
  return { doctors: result.doctors, hasMore: result.hasMore };
}
