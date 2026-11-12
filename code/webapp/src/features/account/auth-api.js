export class AuthRequestError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function authRequest(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const messages = {
        notification_recipient_not_configured: 'Die Arztprüfung kann derzeit nicht beantragt werden, weil die zuständige Prüfstelle serverseitig noch nicht eingerichtet ist. Es wurde kein Antrag gespeichert.',
        notification_not_materialized: 'Der Antrag kann gespeichert sein, aber der Benachrichtigungseintrag konnte noch nicht lokal abgelegt werden. Bitte Status prüfen und erneut versuchen.',
        EMAIL_NOT_VERIFIED: 'Bitte zuerst die E-Mail bestätigen. Einen neuen Link kannst du unten anfordern.',
        PASSWORD_TOO_SHORT: 'Das Passwort muss mindestens 8 Zeichen enthalten.',
        PASSWORD_TOO_LONG: 'Das Passwort darf höchstens 128 Zeichen enthalten.',
        INVALID_EMAIL: 'Bitte eine gültige E-Mail-Adresse eingeben.',
        INVALID_NAME: 'Der Anzeigename muss 1 bis 100 Zeichen enthalten.',
        INVALID_TOKEN: 'Der Kontolink ist ungültig, abgelaufen oder bereits verwendet. Bitte einen neuen Link anfordern.',
        EMAIL_ALREADY_VERIFIED: 'Die E-Mail ist bereits bestätigt. Bitte anmelden oder den Status erneut prüfen.',
        INVALID_CODE: 'Der Authenticator-Code ist falsch oder abgelaufen. Bitte einen aktuellen Code eingeben.',
        INVALID_BACKUP_CODE: 'Der Wiederherstellungscode ist ungültig oder wurde bereits verwendet.',
        TWO_FACTOR_REQUIRED: 'Die Zwei-Faktor-Anmeldung wurde während des Anmeldeversuchs aktiviert. Bitte melde dich erneut an und gib danach deinen zweiten Faktor ein.',
      };
      const errorCode = details.code || details.error;
      const knownCode = Object.hasOwn(messages, errorCode) ? errorCode : '';
      const message = knownCode ? messages[knownCode]
        : response.status >= 500 ? 'Der Kontoserver ist nicht erreichbar. Bitte später erneut versuchen.'
        : response.status === 429 ? 'Zu viele Versuche. Bitte kurz warten und erneut versuchen.'
        : response.status === 401 ? 'Die Anmeldung ist fehlgeschlagen. Bitte E-Mail und Passwort prüfen.'
        : 'Die Anfrage konnte nicht abgeschlossen werden. Bitte Angaben prüfen oder erneut anmelden.';
      throw new AuthRequestError(message, response.status, knownCode);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AuthRequestError) throw error;
    throw new AuthRequestError('Der Kontoserver antwortet nicht. Verbindung und lokalen Server prüfen.');
  } finally {
    clearTimeout(timeout);
  }
}

// Consume callback data immediately; tokens stay in component memory, never browser storage.
export function consumeAccountCallback(url) {
  const fragment = new URLSearchParams(url.hash.split('?')[1] || '');
  const hasReset = fragment.has('reset');
  const rawToken = fragment.get('reset') || '';
  const resetToken = /^[A-Za-z0-9_-]{1,256}$/.test(rawToken) ? rawToken : '';
  const linkError = url.searchParams.get('verification') === 'invalid'
    || url.searchParams.has('error') || (hasReset && !resetToken);
  url.searchParams.delete('verification');
  url.searchParams.delete('error');
  if (hasReset) url.hash = 'account';
  return { resetToken, linkError };
}
