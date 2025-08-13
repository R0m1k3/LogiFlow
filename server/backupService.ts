import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { databaseBackups } from "@shared/schema";
import type { DatabaseBackup, InsertDatabaseBackup } from "@shared/schema";

const execAsync = promisify(exec);

export class BackupService {
  private backupDir: string;
  private maxBackups = 10;

  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
    this.scheduleAutomaticBackup();
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 Backup directory created:', this.backupDir);
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

  private scheduleAutomaticBackup(): void {
    // Use native setTimeout instead of node-cron for ESM compatibility
    const scheduleNextBackup = () => {
      const now = new Date();
      const next2AM = new Date(now);
      next2AM.setHours(2, 0, 0, 0);
      
      // If it's already past 2 AM today, schedule for tomorrow
      if (now.getHours() >= 2) {
        next2AM.setDate(next2AM.getDate() + 1);
      }
      
      const msUntilBackup = next2AM.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          console.log('🔄 Starting automatic backup...');
          await this.createBackup('automatic', 'system');
          console.log('✅ Automatic backup completed');
        } catch (error) {
          console.error('❌ Automatic backup failed:', error);
        }
        
        // Schedule the next backup (24 hours later)
        scheduleNextBackup();
      }, msUntilBackup);
    };
    
    scheduleNextBackup();
    console.log('⏰ Automatic backup scheduled for 2:00 AM daily (native timer)');
  }
}

// Singleton instance
export const backupService = new BackupService();