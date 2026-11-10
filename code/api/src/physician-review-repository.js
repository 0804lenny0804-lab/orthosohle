import { randomUUID } from 'node:crypto';

export function createPhysicianReviewRepository(database) {
  const findReview = database.prepare(`
    SELECT application.status, application.requested_at AS requestedAt,
      notification.materialized_at AS materializedAt
    FROM physician_review_application AS application
    LEFT JOIN physician_review_outbox AS notification ON notification.application_id = application.id
    WHERE application.account_user_id = ?
  `);
  const findNotification = database.prepare(`
    SELECT id, application_id AS applicationId, recipient_email AS recipientEmail,
      applicant_email AS applicantEmail, created_at AS createdAt, materialized_at AS materializedAt
    FROM physician_review_outbox
    WHERE application_id = ?
  `);
  const insertReview = database.prepare(`
    INSERT INTO physician_review_application (id, account_user_id, status, requested_at)
    VALUES (?, ?, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(account_user_id) DO NOTHING
  `);
  const insertNotification = database.prepare(`
    INSERT INTO physician_review_outbox (
      id, application_id, recipient_email, applicant_email, created_at, materialized_at
    ) VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL)
    ON CONFLICT(application_id) DO NOTHING
  `);
  const markMaterialized = database.prepare(`
    UPDATE physician_review_outbox
    SET materialized_at = COALESCE(materialized_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE id = ?
  `);

  const request = database.transaction((accountUserId, applicantEmail, recipientEmail) => {
    const insertedReview = insertReview.run(randomUUID(), accountUserId);
    const review = findReview.get(accountUserId);
    if (!review) throw new Error('Physician review request was not persisted.');
    // The application and exactly one notification intent commit together.
    insertNotification.run(randomUUID(), findApplicationId(accountUserId), recipientEmail, applicantEmail);
    const notification = findNotification.get(findApplicationId(accountUserId));
    if (!notification) throw new Error('Physician review notification intent was not persisted.');
    return { review, notification, created: insertedReview.changes === 1 };
  });

  function findApplicationId(accountUserId) {
    return database.prepare(`
      SELECT id FROM physician_review_application WHERE account_user_id = ?
    `).get(accountUserId)?.id;
  }

  return {
    findForAccount(accountUserId) {
      return findReview.get(accountUserId) ?? null;
    },
    requestForAccount(accountUserId, applicantEmail, recipientEmail) {
      return request(accountUserId, applicantEmail, recipientEmail);
    },
    markNotificationMaterialized(notificationId) {
      markMaterialized.run(notificationId);
    },
  };
}
