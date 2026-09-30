import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import db from '../db.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await db.findUserByEmail(decoded.email);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Invalid token: User does not exist.',
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authorization token.',
      error: error.message,
    });
  }
}

export default { authenticateToken };
