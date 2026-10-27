export function disconnectDiagnostic(error, { registered, pairingCodeShown, connected }) {
  const value = error?.output?.statusCode;
  const code = Number.isInteger(value) && value >= 100 && value <= 599 ? value : 'unknown';
  const phase = connected ? 'after connection' : registered ? 'saved session'
    : pairingCodeShown ? 'pairing confirmation' : 'before pairing code';
  // Provider messages and payloads may contain private data. Only emit fixed categories.
  const conflict = error?.data?.tag === 'conflict' ? error.data.attrs?.type : undefined;
  const reason = conflict === 'device_removed' ? 'device removed'
    : conflict === 'replaced' ? 'another connection replaced this one'
    : code === 401 ? 'authentication rejected'
    : code === 403 ? 'linking refused'
    : code === 515 ? 'socket restart required' : 'connection closed';
  return { code, message: `WhatsApp diagnostic: phase=${phase}; code=${code}; reason=${reason}.` };
}

export function authenticationFailureAdvice(registered) {
  return registered
    ? 'WhatsApp rejected the saved session. Restart and type reset at the saved-session prompt to pair again.'
    : 'WhatsApp rejected initial pairing. Restart and type reset if offered. If a fresh attempt also fails, check whether official WhatsApp Web can link on this computer.';
}
