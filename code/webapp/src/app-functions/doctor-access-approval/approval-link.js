const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function consumePhysicianApprovalLink(url, replaceUrl) {
  const marked = url.searchParams.get('physicianApproval') === '1';
  if (!marked) return { present: false, token: '' };

  const fragment = new URLSearchParams(url.hash.slice(1));
  const candidate = fragment.get('token') || '';
  url.searchParams.delete('physicianApproval');
  url.hash = '';
  replaceUrl(url.pathname + url.search + url.hash);
  return { present: true, token: tokenPattern.test(candidate) ? candidate : '' };
}

export function isApprovalPreview(value) {
  return value && typeof value.id === 'string' && value.status === 'pending'
    && typeof value.requestedAt === 'string' && Number.isFinite(Date.parse(value.requestedAt))
    && typeof value.email === 'string' && value.email.length > 0;
}

export function isApprovalResult(value) {
  return value && typeof value.id === 'string' && value.status === 'approved';
}
