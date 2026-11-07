import { reactive, readonly } from 'vue';
import { authRequest } from './auth-api.js';

const state = reactive({ status: 'loading', identityId: null, busy: false, error: '', notice: '' });

async function loadIdentity() {
  try {
    const identity = await authRequest('/api/me');
    if (typeof identity.id !== 'string' || !identity.id) {
      throw new Error('Der Kontoserver hat keinen gültigen Anmeldestatus geliefert.');
    }
    state.identityId = identity.id;
    state.status = 'authenticated';
  } catch (error) {
    state.identityId = null;
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
  } catch (error) {
    state.error = error.message;
    if (!error.status || error.status >= 500) state.status = 'unavailable';
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
    state.notice = 'Lokales Testkonto erstellt. Du kannst dich jetzt anmelden.';
  }),
  signIn: ({ email, password }) => perform(async () => {
    await authRequest('/api/auth/sign-in/email', { email, password });
    await loadIdentity();
    if (state.status !== 'authenticated') {
      throw new Error('Anmeldung konnte nicht bestätigt werden. Bitte die Cookie-Einstellungen prüfen.');
    }
  }),
  signOut: () => perform(async () => {
    await authRequest('/api/auth/sign-out', {});
    state.identityId = null;
    state.status = 'anonymous';
    state.notice = 'Du wurdest abgemeldet.';
  }),
};
