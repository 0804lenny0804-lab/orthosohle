import { reactive, readonly } from 'vue';
import { authRequest } from './auth-api.js';

const state = reactive({ status: 'loading', identityId: null, email: '', emailVerified: false, busy: false, error: '', notice: '' });

async function loadIdentity() {
  try {
    const identity = await authRequest('/api/me');
    if (typeof identity.id !== 'string' || !identity.id) {
      throw new Error('Der Kontoserver hat keinen gültigen Anmeldestatus geliefert.');
    }
    state.identityId = identity.id;
    state.email = identity.email;
    state.emailVerified = identity.emailVerified === true;
    state.status = 'authenticated';
  } catch (error) {
    state.identityId = null;
    state.email = '';
    state.emailVerified = false;
    if (error.status !== 401) throw error;
    state.status = 'anonymous';
  }
}

async function perform(action) {
  if (state.busy) return;
  state.busy = true;
  state.error = '';
  state.notice = '';
  try {
    await action();
    return true;
  } catch (error) {
    state.error = error.message;
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
    state.notice = 'Falls die Registrierung möglich war, liegt ein Bestätigungslink im lokalen Test-Mailausgang. Bitte zuerst die E-Mail bestätigen und danach anmelden.';
  }),
  signIn: ({ email, password }) => perform(async () => {
    await authRequest('/api/auth/sign-in/email', { email, password });
    await loadIdentity();
    if (state.status !== 'authenticated') {
      throw new Error('Anmeldung konnte nicht bestätigt werden. Bitte die Cookie-Einstellungen prüfen.');
    }
  }),
  resendVerification: ({ email }) => perform(async () => {
    await authRequest('/api/auth/send-verification-email', { email });
    state.notice = 'Falls das Testkonto noch nicht bestätigt ist, liegt ein neuer Link im lokalen Test-Mailausgang. Es wurde keine E-Mail versendet.';
  }),
  requestReset: ({ email }) => perform(async () => {
    await authRequest('/api/auth/request-password-reset', { email });
    state.notice = 'Falls das Testkonto existiert, liegt ein Link zum Zurücksetzen im lokalen Test-Mailausgang. Es wurde keine E-Mail versendet.';
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
    state.emailVerified = false;
    state.notice = 'Du wurdest abgemeldet.';
  }),
};
