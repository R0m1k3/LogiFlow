import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { databaseBackups, utilities, users } from "@shared/schema";
import type { DatabaseBackup, InsertDatabaseBackup } from "@shared/schema";

const execAsync = promisify(exec);

export class BackupService {
  private backupDir: string;
  private maxBackups = 10;
  private lastAutomaticBackupDate: string | null = null;

  constructor() {
    // Use /app/backups in production (with proper permissions), or use env variable
    const isProduction = process.env.NODE_ENV === 'production';
    this.backupDir = isProduction
      ? process.env.BACKUP_DIR || '/app/backups'
      : path.join(process.cwd(), 'backups');

    this.ensureBackupDirectory();
    this.scheduleAutomaticBackup();
  }

  private ensureBackupDirectory(): void {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
        console.log('📁 Backup directory created:', this.backupDir);
      }
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error);
      // Fallback to /tmp if current directory fails
      if (this.backupDir !== '/tmp/backups') {
        this.backupDir = '/tmp/backups';
        console.log('🔄 Falling back to /tmp/backups');
        try {
          if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log('📁 Fallback backup directory created:', this.backupDir);
          }
        } catch (fallbackError) {
          console.error('❌ Failed to create fallback directory:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  private getDatabaseConfig() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not found in environment variables');
    }

    // Parse PostgreSQL URL
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1), // Remove leading slash
      username: url.username,
      password: url.password,
    };
  }

  /**
   * Resolve a valid user ID for system-initiated backups.
   * Returns the first admin user ID, or the first user if no admin exists.
   * This avoids FK violations on database_backups.created_by -> users.id.
   */
  private async resolveSystemUserId(): Promise<string | null> {
    try {
      // Try to find an admin user first
      const [adminUser] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);
      if (adminUser) return adminUser.id;

      // Fallback: any existing user
      const [anyUser] = await db.select({ id: users.id })
        .from(users)
        .limit(1);
      return anyUser?.id ?? null;
    } catch (error) {
      console.error('❌ Failed to resolve system user ID for backup:', error);
      return null;
    }
  }

  async createBackup(type: 'manual' | 'automatic' = 'manual', createdBy: string = 'system'): Promise<DatabaseBackup> {
    try {
      const id = nanoid();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${type}_${timestamp}.sql`;
      const filepath = path.join(this.backupDir, filename);

      // Create database record first with "creating" status
      const [backupRecord] = await db.insert(databaseBackups).values({
        id,
        filename,
        description: `${type === 'manual' ? 'Manuel' : 'Automatique'} backup du ${new Date().toLocaleDateString('fr-FR')}`,
        size: 0,
        createdBy,
        tablesCount: 0,
        status: 'creating',
        backupType: type,
      }).returning();

      const dbConfig = this.getDatabaseConfig();

      // Set environment variable for password to avoid prompt
      const env = {
        ...process.env,
        PGPASSWORD: dbConfig.password,
      };

      // Create pg_dump command
      const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} --no-password --verbose --clean --if-exists --create > "${filepath}"`;

      console.log(`🔄 Starting ${type} backup...`);

      await execAsync(command, { env });

      // Get file stats and count tables
      const stats = fs.statSync(filepath);
      const sqlContent = fs.readFileSync(filepath, 'utf8');
      const tablesCount = (sqlContent.match(/CREATE TABLE/g) || []).length;

      // Update database record with completion details
      const [updatedBackup] = await db.update(databaseBackups)
        .set({
          size: stats.size,
          tablesCount,
          status: 'completed',
        })
        .where(eq(databaseBackups.id, id))
        .returning();

      console.log(`✅ ${type} backup created: ${filename} (${this.formatFileSize(stats.size)}, ${tablesCount} tables)`);

      // Clean old backups
      await this.cleanOldBackups();

      return updatedBackup;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBackupList(): Promise<DatabaseBackup[]> {
    try {
      const backups = await db.select()
        .from(databaseBackups)
        .orderBy(desc(databaseBackups.createdAt))
        .limit(this.maxBackups);

      return backups;
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    try {
      // Find backup record
      const [backup] = await db.select()
        .from(databaseBackups)
        .where(eq(databaseBackups.filename, filename))
        .limit(1);

      if (!backup) {
        throw new Error('Backup record not found');
      }

      // Delete physical file
      const filepath = path.join(this.backupDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Delete database record
      await db.delete(databaseBackups)
        .where(eq(databaseBackups.filename, filename));

      console.log(`🗑️ Backup deleted: ${filename}`);
    } catch (error) {
      console.error('❌ Failed to delete backup:', error);
      throw error;
    }
  }

  async downloadBackup(filename: string): Promise<string> {
    const filepath = path.join(this.backupDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file not found');
    }

    return filepath;
  }

  private async cleanOldBackups(): Promise<void> {
    try {
      const allBackups = await db.select()
        .from(databaseBackups)
        .orderBy(desc(databaseBackups.createdAt));

      if (allBackups.length > this.maxBackups) {
        const toDelete = allBackups.slice(this.maxBackups);

        for (const backup of toDelete) {
          await this.deleteBackup(backup.filename);
        }

        console.log(`🧹 Cleaned ${toDelete.length} old backup(s)`);
      }
    } catch (error) {
      console.error('❌ Failed to clean old backups:', error);
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Nouvelle méthode : Vérifier et effectuer une sauvegarde quotidienne si nécessaire
  async checkAndPerformDailyBackup(userId: string = 'system'): Promise<{ backupPerformed: boolean; message: string }> {
    try {
      // Vérifier si les backups automatiques sont activés
      const [config] = await db.select()
        .from(utilities)
        .limit(1);

      // Si les backups automatiques sont désactivés, ne rien faire
      if (config && config.automaticBackupsEnabled === false) {
        console.log('ℹ️ Sauvegardes automatiques désactivées - Aucune action effectuée');
        return {
          backupPerformed: false,
          message: 'Sauvegardes automatiques désactivées'
        };
      }

      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD

      // Vérifier s'il y a déjà une sauvegarde automatique aujourd'hui
      const existingBackupToday = await db.select()
        .from(databaseBackups)
        .where(eq(databaseBackups.backupType, 'automatic'))
        .orderBy(desc(databaseBackups.createdAt))
        .limit(1);

      const lastBackup = existingBackupToday[0];
      const lastBackupDate = lastBackup ? lastBackup.createdAt.toISOString().split('T')[0] : null;

      // Only perform backup if no automatic backup exists for today
      if (lastBackupDate !== today) {
        // Resolve a real user ID if called with default 'system'
        let resolvedUserId = userId;
        if (userId === 'system') {
          const systemId = await this.resolveSystemUserId();
          if (!systemId) {
            console.warn('⚠️ No user found in database — skipping daily backup');
            return { backupPerformed: false, message: 'Aucun utilisateur trouvé pour la sauvegarde' };
          }
          resolvedUserId = systemId;
        }
        console.log('🔄 Première connexion du jour - Création de la sauvegarde automatique...');
        await this.createBackup('automatic', resolvedUserId);
        console.log('✅ Sauvegarde quotidienne effectuée avec succès');
        return {
          backupPerformed: true,
          message: 'Sauvegarde quotidienne effectuée avec succès'
        };
      } else {
        console.log('ℹ️ Sauvegarde quotidienne déjà effectuée aujourd\'hui');
        return {
          backupPerformed: false,
          message: 'Sauvegarde quotidienne déjà effectuée aujourd\'hui'
        };
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de sauvegarde quotidienne:', error);
      return {
        backupPerformed: false,
        message: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }

  private scheduleAutomaticBackup(): void {
    // Check for automatic backup every hour
    const checkBackupNeeded = async () => {
      try {
        // Vérifier si les backups automatiques sont activés
        const [config] = await db.select()
          .from(utilities)
          .limit(1);

        // Si les backups automatiques sont désactivés, ne rien faire
        if (config && config.automaticBackupsEnabled === false) {
          return;
        }

        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Only run automatic backup if:
        // 1. It's after 2:00 AM
        // 2. We haven't done an automatic backup today yet
        if (now.getHours() >= 2 && this.lastAutomaticBackupDate !== today) {
          // Check if there's already an automatic backup today in the database
          const existingBackupToday = await db.select()
            .from(databaseBackups)
            .where(eq(databaseBackups.backupType, 'automatic'))
            .orderBy(desc(databaseBackups.createdAt))
            .limit(1);

          const lastBackup = existingBackupToday[0];
          const lastBackupDate = lastBackup ? lastBackup.createdAt.toISOString().split('T')[0] : null;

          // Only proceed if no automatic backup exists for today
          if (lastBackupDate !== today) {
            // Resolve a real user ID to satisfy FK constraint
            const systemUserId = await this.resolveSystemUserId();
            if (!systemUserId) {
              console.warn('⚠️ No user found in database — skipping automatic backup');
              return;
            }
            console.log('🔄 Starting automatic backup...');
            await this.createBackup('automatic', systemUserId);
            this.lastAutomaticBackupDate = today;
            console.log('✅ Automatic backup completed');
          }
        }
      } catch (error) {
        console.error('❌ Automatic backup check failed:', error);
      }
    };

    // Initial check
    checkBackupNeeded();

    // Check every hour (3600000 ms)
    setInterval(checkBackupNeeded, 3600000);

    console.log('⏰ Automatic backup scheduled for daily 2:00 AM+ (native timer)');
  }
}

// Singleton instance
export const backupService = new BackupService();