// Middleware de permissions hardcodées
// Remplace l'ancien système flexible basé sur la base de données

import type { Request, Response, NextFunction } from 'express';
import { hasPermission, hasModuleAccess } from '@shared/permissions';
import type { Permission, Module } from '@shared/permissions';

// Interface pour les requêtes authentifiées
interface AuthRequest extends Request {
  user: any;
}

// Middleware pour vérifier l'accès à un module
export function requireModuleAccess(module: Module) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    if (!hasModuleAccess(userRole, module)) {
      return res.status(403).json({ 
        message: `Accès refusé au module ${module}`,
        required: "Permission d'accès au module",
        userRole
      });
    }

    next();
  };
}

// Middleware pour vérifier une permission spécifique
export function requirePermission(module: Module, action: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    if (!hasPermission(userRole, module, action)) {
      return res.status(403).json({ 
        message: `Permission refusée: ${action} sur ${module}`,
        required: `${action} permission on ${module}`,
        userRole
      });
    }

    next();
  };
}

// Middleware combiné: accès module + permission
export function requireModulePermission(module: Module, action: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    // Vérifier l'accès au module ET la permission
    if (!hasModuleAccess(userRole, module) || !hasPermission(userRole, module, action)) {
      return res.status(403).json({ 
        message: `Accès refusé: ${action} sur module ${module}`,
        required: `${action} permission on ${module} module`,
        userRole
      });
    }

    next();
  };
}

// Helper: vérifie si l'utilisateur est admin
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const userRole = req.user?.role;
  
  if (!userRole) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  if (userRole !== 'admin') {
    return res.status(403).json({ 
      message: "Accès réservé aux administrateurs",
      required: "admin role",
      userRole
    });
  }

  next();
}

// Helper: vérifie si l'utilisateur est admin ou directeur
export function requireAdminOrDirecteur(req: AuthRequest, res: Response, next: NextFunction) {
  const userRole = req.user?.role;
  
  if (!userRole) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  if (!['admin', 'directeur'].includes(userRole)) {
    return res.status(403).json({ 
      message: "Accès réservé aux administrateurs et directeurs",
      required: "admin or directeur role",
      userRole
    });
  }

  next();
}