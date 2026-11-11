import { writeLocalMail } from './local-mail.js';

export function materializePhysicianReviewNotification(config, repository, notification) {
  writeLocalMail(config, {
    to: notification.recipientEmail,
    subject: 'Lokaler Test: Antrag auf Arztprüfung eingegangen',
    text: [
      'Dies ist eine lokale Kontrollbenachrichtigung. Es wurde keine E-Mail versendet.',
      `Antragsreferenz: ${notification.applicationId}`,
      `Konto-E-Mail: ${notification.applicantEmail}`,
      `Eingegangen am: ${notification.createdAt}`,
      'Der Antrag verleiht keine Arztberechtigung und enthält keinen Freigabelink.',
    ].join('\n'),
  }, { idempotencyKey: `physician-review-${notification.applicationId}` });
  repository.markNotificationMaterialized(notification.id);
}
