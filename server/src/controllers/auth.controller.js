import User from '../models/user.model.js';
import LinkCode from '../models/linkCode.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hash the password before saving — bcrypt is one-way, so even if the DB
    // leaks, attackers can't reverse the hash to get the original password.
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ email, passwordHash });

    // Sign a JWT with the userId so we can identify the user on future requests.
    // The secret must stay in .env — anyone with the secret can forge tokens.
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // httpOnly: JS cannot read the cookie (blocks XSS token theft)
    // secure: only sent over HTTPS (enforced in production)
    // sameSite: browser won't send cookie on cross-site requests (blocks CSRF)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ message: 'Registered successfully', userId: user._id });
  } catch {
    res.status(400).json({ error: 'Registration failed. Email might already exist.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // bcrypt.compare hashes the attempt and compares — never compare plain passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Logged in successfully', userId: user._id });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
};

export const logout = (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

/**
 * me — returns the current user's public info.
 * req.userId is set by the authenticate middleware before this runs.
 * We NEVER read userId from the request body — only from the verified JWT.
 */
export const me = async (req, res) => {
  try {
    // .select('-passwordHash') strips the hash from the response — never expose it
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ userId: user._id, email: user.email, whatsappPhone: user.whatsappPhone });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * Generates a 6-digit one-time code and stores it in the LinkCode collection.
 * The front-end will display this code to the user, who must send it via WhatsApp.
 */
export const generateLinkCode = async (req, res) => {
  try {
    // 1. Delete any existing codes for this user to prevent spam
    await LinkCode.deleteMany({ userId: req.userId });

    // 2. Generate a random 6-digit string
    const code = crypto.randomInt(100000, 999999).toString();

    // 3. Save the code (it will automatically expire in 10 minutes due to the TTL index)
    await LinkCode.create({
      userId: req.userId,
      code,
    });

    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate link code' });
  }
};
