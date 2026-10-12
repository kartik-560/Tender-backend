import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import db from '../db.js';

export async function register(req, res, next) {
  const correlationId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      console.warn(`⚠️ [Register:${correlationId}] Validation failed: missing required fields`);
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`📡 [Register:${correlationId}] Starting registration for: ${normalizedEmail}`);

    const existingUser = await db.findUserByEmail(normalizedEmail);
    if (existingUser) {
      console.warn(`⚠️ [Register:${correlationId}] Conflict: user already exists for ${normalizedEmail}`);
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log(`💾 [Register:${correlationId}] Persisting user to database...`);
    const newUser = await db.createUser({
      name,
      email: normalizedEmail,
      passwordHash,
      role: role || 'Bid Manager',
    });

    console.log(`✅ [Register:${correlationId}] User persisted successfully in database. ID: ${newUser.id}`);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error(`❌ [Register:${correlationId}] Unhandled registration error:`, error.message);
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const user = await db.findUserByEmail(email);

    let isMatch = false;
    if (user) {
      if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, user.passwordHash);
      } else {
        isMatch = password === user.passwordHash;
      }
    }

    if (!user || !isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.json({
      success: true,
      message: 'Authentication successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

export default { register, login };
