import { careApi } from './care-api.js';

export function acceptInvitationRequest(invitation, api = careApi) {
  if (invitation?.status !== 'open' || typeof invitation.id !== 'string') {
    return Promise.resolve(null);
  }
  return api.acceptInvitation(invitation.id);
}

export function declineInvitationRequest(invitation, api = careApi) {
  if (invitation?.status !== 'open' || typeof invitation.id !== 'string') {
    return Promise.resolve(null);
  }
  return api.declineInvitation(invitation.id);
}

export function isCreatedInvitation(value) {
  return value && typeof value.id === 'string' && value.status === 'open'
    && typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt));
}
