import { writeLocalMail } from './local-mail.js';

/** Writes one stable, private local message per approval issue for crash-safe retries. */
export function materializePhysicianApprovalNotification(config, service, notification) {
  if (!notification || !/^[0-9a-f-]{36}$/i.test(notification.issueId)
    || typeof notification.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(notification.token)) {
    throw new TypeError('A valid pending approval notification is required.');
  }
  const link = new URL('/', config.webOrigin);
  link.searchParams.set('physicianApproval', '1');
  link.hash = `token=${notification.token}`;
  writeLocalMail(config, {
    to: notification.recipientEmail,
    subject: 'Lokaler Test: Arztantrag wartet auf Freigabe',
    text: [
      'Dies ist eine lokale Kontrollbenachrichtigung. Es wurde keine E-Mail versendet.',
      `Antragsreferenz: ${notification.applicationId}`,
      `Freigabelink (bis ${notification.expiresAt} gültig, einmalig): ${link.href}`,
      'Der Link zeigt beim Öffnen noch keine Freigabe an. Die Freigabe erfordert eine bestätigte Aktion im angemeldeten Prüferkonto.',
    ].join('\n'),
  }, { idempotencyKey: `physician-approval-${notification.issueId}` });
  service.markMaterialized(notification.issueId);
}
