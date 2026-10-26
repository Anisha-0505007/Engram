import jwt from 'jsonwebtoken';

export const vaultCookie = 'engramVault';
export const vaultCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api', maxAge: 5 * 60_000 });
export function vaultUnlocked(req) {
  try {
    const value = jwt.verify(req.cookies[vaultCookie], process.env.JWT_SECRET, { algorithms: ['HS256'], audience: 'engram-vault' });
    // Bind the unlock to this exact login, so it cannot survive logout/login.
    return value.userId === req.userId && value.session === req.cookies.token;
  } catch { return false; }
}
export function itemAccess(req) {
  return vaultUnlocked(req) ? {} : { confidential: { $ne: true }, privacyPending: { $ne: true } };
}
