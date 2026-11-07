export class AuthRequestError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
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
      const message = response.status >= 500 ? 'Der Kontoserver ist nicht erreichbar. Bitte später erneut versuchen.'
        : response.status === 429 ? 'Zu viele Versuche. Bitte kurz warten und erneut versuchen.'
        : response.status === 401 ? 'Die Anmeldung ist fehlgeschlagen. Bitte E-Mail und Passwort prüfen.'
        : 'Die Anfrage konnte nicht abgeschlossen werden. Bitte Angaben prüfen oder erneut anmelden.';
      throw new AuthRequestError(message, response.status);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AuthRequestError) throw error;
    throw new AuthRequestError('Der Kontoserver antwortet nicht. Verbindung und lokalen Server prüfen.');
  } finally {
    clearTimeout(timeout);
  }
}
