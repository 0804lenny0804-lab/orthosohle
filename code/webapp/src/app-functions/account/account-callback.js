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
