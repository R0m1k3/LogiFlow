import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import { pool } from './initDatabase.production';
import type { Express } from 'express';

// Import connect-pg-simple using ES6 import
import connectPgSimple from 'connect-pg-simple';
const PgSession = connectPgSimple(session);

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  password: string;
  role: string;
  passwordChanged: boolean;
}

declare global {
  namespace Express {
    interface User extends User {}
  }
}

// Import des fonctions de hachage (une seule fois)
import { hashPassword, comparePasswords } from './auth-utils.production';

export function setupLocalAuth(app: Express) {
  // Configure session with PostgreSQL store
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'LogiFlow_Super_Secret_Session_Key_2025_Production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local strategy
  passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  }, async (username, password, done) => {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      const user = result.rows[0];
      if (!user) {
        console.log('❌ Login failed: User not found:', username);
        return done(null, false, { message: 'Invalid username or password.' });
      }

      const isMatch = await comparePasswords(password, user.password);
      if (!isMatch) {
        console.log('❌ Login failed: Invalid password for user:', username);
        return done(null, false, { message: 'Invalid username or password.' });
      }

      // Migrer le mot de passe vers le nouveau format si nécessaire
      if (user.password.includes('.')) {
        console.log('🔧 Migrating password to production format for user:', username);
        try {
          const newHashedPassword = await hashPassword(password);
          await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [newHashedPassword, user.id]
          );
          console.log('✅ Password migrated to production format');
        } catch (error) {
          console.error('❌ Failed to migrate password:', error);
          // Continue with login even if migration fails
        }
      }

      console.log('✅ Login successful for user:', username);
      return done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImageUrl: user.profile_image_url,
        password: user.password,
        role: user.role,
        passwordChanged: user.password_changed
      });
    } catch (error) {
      console.error('❌ Authentication error:', error);
      return done(error);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      const user = result.rows[0];
      if (user) {
        done(null, {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          firstName: user.first_name,
          lastName: user.last_name,
          profileImageUrl: user.profile_image_url,
          password: user.password,
          role: user.role,
          passwordChanged: user.password_changed
        });
      } else {
        done(new Error('User not found'), null);
      }
    } catch (error) {
      done(error, null);
    }
  });

  // Authentication routes
  app.post('/api/login', passport.authenticate('local'), (req: any, res) => {
    if (req.user) {
      console.log('✅ User authenticated successfully:', req.user.username);
      res.json({
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          name: req.user.name,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          profileImageUrl: req.user.profileImageUrl,
          role: req.user.role,
          passwordChanged: req.user.passwordChanged
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Authentication failed' });
    }
  });

  app.get('/api/user', (req: any, res) => {
    if (req.isAuthenticated()) {
      res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        name: req.user.name,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        profileImageUrl: req.user.profileImageUrl,
        role: req.user.role,
        passwordChanged: req.user.passwordChanged
      });
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  app.post('/api/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ message: 'Session destroy failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      });
    });
  });

  // Check if default credentials should be shown
  app.get("/api/default-credentials-check", async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT password_changed FROM users WHERE username = $1',
        ['admin']
      );
      const adminUser = result.rows[0];
      const showDefault = adminUser && !adminUser.password_changed;
      res.json({ showDefault: !!showDefault });
    } catch (error) {
      console.error('Error checking default credentials:', error);
      res.json({ showDefault: true }); // Default to showing credentials if error
    }
  });

  console.log('✅ Local authentication configured');
}

export const requireAuth = (req: any, res: any, next: any) => {
  // 🔍 DEBUG PRODUCTION: Diagnostiquer l'authentification
  console.log('🔍 PRODUCTION AUTH DEBUG:', {
    url: req.url,
    method: req.method,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'NO_FUNCTION',
    hasUser: !!req.user,
    userId: req.user?.id,
    username: req.user?.username,
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionData: req.session ? Object.keys(req.session) : 'NO_SESSION',
    cookies: req.headers.cookie ? 'HAS_COOKIES' : 'NO_COOKIES'
  });
  
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('✅ PRODUCTION AUTH: User authenticated, proceeding');
    return next();
  }
  
  console.log('❌ PRODUCTION AUTH: Authentication failed, returning 401');
  res.status(401).json({ 
    message: 'Authentication required',
    debug: {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasUser: !!req.user,
      hasSession: !!req.session
    }
  });
};