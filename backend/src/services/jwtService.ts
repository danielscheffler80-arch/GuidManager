// JWT Token Service
// Handhabt JWT Token Erstellung und Validierung für User Sessions

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '7d'; // 7 Tage

export interface JWTPayload {
  userId: number;
  battletag: string;
  battlenetId: string;
  sessionId: string;
}

export class JWTService {
  // Erstellt JWT Token für authentifizierten User
  static generateToken(payload: Omit<JWTPayload, 'sessionId'>): string {
    const sessionId = uuidv4();
    const tokenPayload: JWTPayload = {
      ...payload,
      sessionId,
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'guild-manager',
      audience: 'guild-manager-users',
    });
  }

  // Validiert und dekodiert JWT Token
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'guild-manager',
        audience: 'guild-manager-users',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  // Extrahiert Token aus Authorization Header
  static extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7); // Entfernt 'Bearer '
  }

  // Erstellt Refresh Token
  static generateRefreshToken(userId: number): string {
    return jwt.sign(
      { 
        userId, 
        type: 'refresh',
        version: 1 
      }, 
      JWT_SECRET, 
      { 
        expiresIn: '30d' // 30 Tage
      }
    );
  }

  // Validiert Refresh Token
  static verifyRefreshToken(token: string): { userId: number } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return { userId: decoded.userId };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}
