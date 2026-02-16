// Auth Middleware
// Validiert JWT Tokens für geschützte Routen

import { Request, Response, NextFunction } from 'express';
import { JWTService, JWTPayload } from '../services/jwtService';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = JWTService.extractTokenFromHeader(authHeader || '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }
    
    // Validiere Token
    const payload = JWTService.verifyToken(token);
    
    // Füge User-Info zum Request hinzu
    req.user = payload;
    
    next();
  } catch (error) {
    const e = error as any;
    if (e.message === 'Token has expired') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Optional: Rolle-basierte Autorisierung
export const requireRole = (_roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Für zukünftige Rolle-basierte Autorisierung
    // Aktuell nur prüfen ob User authentifiziert ist
    if (!req.user) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};
