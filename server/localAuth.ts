import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, type UserWithGroups } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { backupService } from "./backupService";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  console.log('🔐 comparePasswords:', { supplied: 'HIDDEN', stored: stored?.substring(0, 20) + '...', hasFormat: stored?.includes('.') });
  
  // Simple password comparison for development (admin.salt format)
  if (stored === 'admin.salt' && supplied === 'admin') {
    console.log('🔐 Development auth: admin password accepted');
    return true;
  }
  
  // Vérifier le format du mot de passe stocké pour production
  if (!stored || !stored.includes('.')) {
    console.error('❌ Invalid password format:', { stored });
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) {
    console.error('❌ Missing hash or salt:', { hasHash: !!hashed, hasSalt: !!salt });
    return false;
  }
  
  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    const result = timingSafeEqual(hashedBuf, suppliedBuf);
    console.log('🔐 Password comparison result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error comparing passwords:', error);
    return false;
  }
}

async function createDefaultAdminUser() {
  try {
    const existingAdmin = await storage.getUserByUsername('admin');
    if (!existingAdmin) {
      const hashedPassword = await hashPassword('admin');
      await storage.createUser({
        id: 'admin_local',
        username: 'admin',
        email: 'admin@logiflow.com',
        firstName: 'Administrateur',
        lastName: 'Système',
        password: hashedPassword,
        role: 'admin',
        passwordChanged: false,
      });
      console.log('✅ Admin user created: admin / admin');
    } else {
      // Corriger le mot de passe admin si le format est incorrect
      if (!existingAdmin.password || !existingAdmin.password.includes('.')) {
        console.log('🔧 Fixing admin password format...');
        const hashedPassword = await hashPassword('admin');
        await storage.updateUser(existingAdmin.id, { 
          password: hashedPassword,
          passwordChanged: false 
        });
        console.log('✅ Admin password format fixed');
      }
    }
  } catch (error) {
    console.error('Error managing admin user:', error);
  }
}

export function setupLocalAuth(app: Express) {
  // Create admin user on startup
  createDefaultAdminUser();
  
  console.log('🔧 Using memory session store for development');

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    // Using default memory store (no database needed)
    cookie: {
      httpOnly: true,
      secure: false, // Keep false for development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          if (!user || !user.password) {
            return done(null, false, { message: 'Identifiant ou mot de passe incorrect' });
          }

          const isValidPassword = await comparePasswords(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: 'Identifiant ou mot de passe incorrect' });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserWithGroups(id);
      // Utilisateur supprimé depuis la connexion : false vide la session (401)
      // au lieu de l'erreur « Failed to deserialize user out of session » (500)
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });



  // Login route
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(400).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        res.json({ 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          role: user.role,
          passwordChanged: user.passwordChanged 
        });

        // Vérifier et effectuer une sauvegarde quotidienne si nécessaire, après
        // la réponse : la connexion n'attend plus le pg_dump
        setImmediate(() => {
          backupService.checkAndPerformDailyBackup(user.id)
            .then((backupResult) => {
              if (backupResult.backupPerformed) {
                console.log('💾 Sauvegarde quotidienne effectuée lors de la connexion de', user.username);
              }
            })
            .catch((error) => {
              // Ne pas faire échouer la connexion si la sauvegarde échoue
              console.error('⚠️ Erreur lors de la vérification de sauvegarde:', error);
            });
        });
      });
    })(req, res, next);
  });

  // Logout routes (both GET and POST for compatibility)
  const logoutHandler = (req: any, res: any, next: any) => {
    req.logout((err: any) => {
      if (err) return next(err);
      req.session.destroy((err: any) => {
        if (err) return next(err);
        res.clearCookie('connect.sid', { path: '/' });
        // Force redirect to login page for both GET and POST
        res.redirect('/auth');
      });
    });
  };
  
  app.post("/api/logout", logoutHandler);
  app.get("/api/logout", logoutHandler);

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    // req.user est déjà rechargé avec ses magasins par deserializeUser à chaque
    // requête : inutile de relire l'utilisateur en base
    const userWithGroups = req.user as UserWithGroups;
    
    res.json({ 
      id: userWithGroups.id, 
      username: userWithGroups.username, 
      email: userWithGroups.email, 
      firstName: userWithGroups.firstName, 
      lastName: userWithGroups.lastName, 
      role: userWithGroups.role,
      passwordChanged: userWithGroups.passwordChanged,
      userGroups: userWithGroups.userGroups || []
    });
  });

  // Check if default credentials should be shown
  app.get("/api/default-credentials-check", async (req, res) => {
    try {
      const adminUser = await storage.getUserByUsername('admin');
      const showDefault = adminUser && !adminUser.passwordChanged;
      res.json({ showDefault: !!showDefault });
    } catch (error) {
      res.json({ showDefault: true }); // Default to showing credentials if error
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", auth: "local" });
  });
}

export const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentification requise" });
  }
  next();
};