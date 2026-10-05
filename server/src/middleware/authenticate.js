import jwt from 'jsonwebtoken';

/**
 * authenticate middleware
 * Reads the JWT from the httpOnly cookie, verifies it, and attaches
 * req.userId so every downstream handler knows who is making the request.
 *
 * Why cookie instead of Authorization header?
 * Cookies with httpOnly=true can't be read by JavaScript at all, so a
 * malicious script injected into the page can never steal the token.
 */
const authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // jwt.verify throws if the token is expired or tampered with
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // attach to request — used by every protected controller
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default authenticate;
