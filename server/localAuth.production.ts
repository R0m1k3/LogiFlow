import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express } from "express";
import session from "express-session";
import { storage } from "./storage.js";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { backupService } from "./backupService.js";

const scryptAsync = promisify(scrypt);

console.log('🐳 PRODUCTION: Local auth configured with PostgreSQL sessions');

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  console.log('🔐 Production password comparison', { suppliedLength: supplied.length, storedFormat: stored?.substring(0, 10) + '...' });
  
  // Try different password formats for backward compatibility
  
  // 1. Try new format: hash.salt
  if (stored && stored.includes('.')) {
    const [hashed, salt] = stored.split(".");
    if (hashed && salt) {
      try {
        const hashedBuf = Buffer.from(hashed, "hex");
        const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
        const result = timingSafeEqual(hashedBuf, suppliedBuf);
        if (result) {
          console.log('✅ Password matched with hash.salt format');
          return true;
        }
      } catch (error) {
        console.log('⚠️ hash.salt format failed, trying other formats');
      }
    }
  }
  
  // 2. Try bcrypt format (common in existing systems)
  if (stored && stored.startsWith('$2')) {
    try {
      const bcrypt = await import('bcrypt');
      const result = await bcrypt.compare(supplied, stored);
      if (result) {
        console.log('✅ Password matched with bcrypt format');
        return true;
      }
    } catch (error) {
      console.log('⚠️ bcrypt comparison failed');
    }
  }
  
  // 3. Try plain text (for development/migration)
  if (stored === supplied) {
    console.log('✅ Password matched with plain text format');
    return true;
  }
  
  // 4. Try simple hash format (legacy)
  try {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(supplied).digest('hex');
    if (stored === hash) {
      console.log('✅ Password matched with SHA256 format');
      return true;
    }
  } catch (error) {
    console.log('⚠️ SHA256 comparison failed');
  }
  
  console.log('❌ No password format matched');
  return false;
}

async function createDefaultAdminUser() {
  try {
    // Check for force reset flag
    const forceReset = process.env.FORCE_ADMIN_RESET === 'true';
    if (forceReset) {
      console.log('🔄 FORCE_ADMIN_RESET detected, deleting existing admin user...');
      const existingAdmin = await storage.getUserByUsername('admin');
      if (existingAdmin) {
        await storage.deleteUser(existingAdmin.id);
        console.log('✅ Existing admin user deleted');
      }
    }
    
    const existingAdmin = await storage.getUserByUsername('admin');
    if (!existingAdmin) {
      const hashedPassword = await hashPassword('admin');
      await storage.createUser({
        id: 'admin_prod',
        username: 'admin',
        email: 'admin@logiflow.com',
        firstName: 'Administrateur',
        lastName: 'Production',
        password: hashedPassword,
        role: 'admin',
        passwordChanged: false,
      });
      console.log('✅ Production admin user created: admin/admin');
    } else {
      console.log('✅ Production admin user found:', { 
        id: existingAdmin.id, 
        username: existingAdmin.username,
        passwordFormat: existingAdmin.password ? 'present' : 'missing'
      });
      
      // Ne plus forcer la réinitialisation du mot de passe admin
      // L'admin peut maintenant changer son mot de passe et il sera conservé
      console.log('✅ Admin user exists, preserving current password');
      
      // Seulement réinitialiser si explicitement demandé via FORCE_ADMIN_RESET
      if (process.env.FORCE_ADMIN_RESET === 'true') {
        console.log('🔄 FORCE_ADMIN_RESET env var set, resetting admin password...');
        try {
          const newHashedPassword = await hashPassword('admin');
          await storage.updateUser(existingAdmin.id, { 
            password: newHashedPassword,
            passwordChanged: false 
          });
          console.log('✅ Admin password manually reset to: admin/admin');
        } catch (error) {
          console.error('❌ Failed to reset admin password:', (error as Error).message);
        }
      }
    }
  } catch (error) {
    console.error('Error managing admin user:', error);
  }
}

export function setupLocalAuth(app: Express) {
  // Create admin user on startup
  createDefaultAdminUser();
  
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: 'session',
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'production-fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true with HTTPS proxy
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
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
            return done(null, false, { message: 'Invalid credentials' });
          }

          const isValidPassword = await comparePasswords(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: 'Invalid credentials' });
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
      done(null, user);
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
      
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Vérifier et effectuer une sauvegarde quotidienne si nécessaire
        try {
          const backupResult = await backupService.checkAndPerformDailyBackup(user.id);
          if (backupResult.backupPerformed) {
            console.log('💾 Sauvegarde quotidienne effectuée lors de la connexion de', user.username);
          }
        } catch (error) {
          console.error('⚠️ Erreur lors de la vérification de sauvegarde:', error);
          // Ne pas faire échouer la connexion si la sauvegarde échoue
        }
        
        res.json({ 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          role: user.role,
          passwordChanged: user.passwordChanged 
        });
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req: any, res: any, next: any) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user
  app.get("/api/user", (req: any, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      console.log("🔍 PRODUCTION /api/user - req.user:", {
        id: req.user.id,
        role: req.user.role,
        hasUserGroups: !!req.user.userGroups,
        userGroupsLength: req.user.userGroups?.length,
        userGroups: req.user.userGroups?.map((ug: any) => ({
          groupId: ug.groupId || ug.group?.id,
          groupName: ug.group?.name
        }))
      });
      
      res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        passwordChanged: req.user.passwordChanged,
        userGroups: req.user.userGroups || [] // ✅ AJOUT DES USER GROUPS !
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Check default credentials endpoint
  app.get("/api/default-credentials-check", (req, res) => {
    res.json({ hasDefaultCredentials: true });
  });
}

export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}