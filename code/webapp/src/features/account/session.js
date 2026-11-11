import { reactive, readonly } from 'vue';
import { authRequest } from './auth-api.js';

const state = reactive({ status: 'loading', identityId: null, name: '', email: '', emailVerified: false,
  twoFactorEnabled: false, busy: false, error: '', notice: '' });

async function loadIdentity() {
  try {
    const identity = await authRequest('/api/me');
    if (typeof identity.id !== 'string' || !identity.id) {
      throw new Error('Der Kontoserver hat keinen gültigen Anmeldestatus geliefert.');
    }
    state.identityId = identity.id;
    state.name = typeof identity.name === 'string' ? identity.name : '';
    state.email = identity.email;
    state.emailVerified = identity.emailVerified === true;
    state.twoFactorEnabled = identity.twoFactorEnabled === true;
    state.status = 'authenticated';
  } catch (error) {
    state.identityId = null;
    state.name = '';
    state.email = '';
    state.emailVerified = false;
    state.twoFactorEnabled = false;
    state.status = error.status === 401 ? 'anonymous' : 'unavailable';
    if (error.status !== 401) throw error;
  }
}

async function perform(action) {
  if (state.busy) return;
  state.busy = true;
  state.error = '';
  state.notice = '';
  try {
    const result = await action();
    return result ?? true;
  } catch (error) {
    state.error = error.message;
    if (error.status === 401 && !['INVALID_CODE', 'INVALID_BACKUP_CODE'].includes(error.code)) {
      state.identityId = null;
      state.name = '';
      state.email = '';
      state.emailVerified = false;
      state.twoFactorEnabled = false;
      state.status = 'anonymous';
    }
    if (!error.status || error.status >= 500) state.status = 'unavailable';
    return false;
  } finally {
    state.busy = false;
  }
}

export const accountSession = {
  state: readonly(state),
  refresh: () => perform(loadIdentity),
  register: ({ name, email, password }) => perform(async () => {
    await authRequest('/api/auth/sign-up/email', { name, email, password });
    await loadIdentity();
    state.notice = 'Falls die Registrierung möglich war, liegt ein Bestätigungslink im lokalen Mailausgang. Bitte zuerst die E-Mail bestätigen und danach anmelden.';
  }),
  signIn: ({ email, password }) => perform(async () => {
    const result = await authRequest('/api/auth/sign-in/email', { email, password });
    if (result.twoFactorRedirect === true) return { requiresTwoFactor: true };
    await loadIdentity();
    if (state.status !== 'authenticated') {
      throw new Error('Anmeldung konnte nicht bestätigt werden. Bitte die Cookie-Einstellungen prüfen.');
    }
    return { requiresTwoFactor: false };
  }),
  verifySignInCode: (code) => perform(async () => {
    await authRequest('/api/auth/two-factor/verify-totp', { code });
    await loadIdentity();
    if (state.status !== 'authenticated') throw new Error('Die Anmeldung konnte nach der Codeprüfung nicht bestätigt werden.');
  }),
  verifySignInBackupCode: (code) => perform(async () => {
    await authRequest('/api/auth/two-factor/verify-backup-code', { code });
    await loadIdentity();
    if (state.status !== 'authenticated') throw new Error('Die Anmeldung konnte nach der Codeprüfung nicht bestätigt werden.');
  }),
  enableTwoFactor: (password) => perform(async () => {
    const result = await authRequest('/api/auth/two-factor/enable', { password, method: 'totp' });
    return result;
  }),
  verifyEnrollmentCode: (code) => perform(async () => {
    await authRequest('/api/auth/two-factor/verify-totp', { code });
    await loadIdentity();
    if (!state.twoFactorEnabled) throw new Error('Die Aktivierung konnte nicht bestätigt werden.');
  }),
  disableTwoFactor: (password) => perform(async () => {
    await authRequest('/api/auth/two-factor/disable', { password });
    await loadIdentity();
  }),
  saveProfile: (name) => perform(async () => {
    await authRequest('/api/auth/update-user', { name });
    await loadIdentity();
    state.notice = 'Dein Anzeigename wurde gespeichert.';
  }),
  resendVerification: ({ email }) => perform(async () => {
    await authRequest('/api/auth/send-verification-email', { email });
    state.notice = 'Falls das Konto noch nicht bestätigt ist, liegt ein neuer Link im lokalen Mailausgang. Es wurde keine E-Mail versendet.';
  }),
  requestReset: ({ email }) => perform(async () => {
    await authRequest('/api/auth/request-password-reset', { email });
    state.notice = 'Falls das Konto existiert, liegt ein Link zum Zurücksetzen im lokalen Mailausgang. Es wurde keine E-Mail versendet.';
  }),
  resetPassword: ({ token, newPassword }) => perform(async () => {
    await authRequest('/api/auth/reset-password', { token, newPassword });
    await loadIdentity();
    state.notice = 'Passwort geändert und bestehende Sitzungen beendet. Bitte neu anmelden.';
  }),
  signOut: () => perform(async () => {
    await authRequest('/api/auth/sign-out', {});
    state.identityId = null;
    state.status = 'anonymous';
    state.email = '';
    state.name = '';
    state.emailVerified = false;
    state.twoFactorEnabled = false;
    state.notice = 'Du wurdest abgemeldet.';
  }),
  clearFeedback() {
    state.error = '';
    state.notice = '';
  },
};
