import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

const execAsync = promisify(exec);

export interface BackupFile {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'automatic';
}

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

  async createBackup(type: 'manual' | 'automatic' = 'manual'): Promise<BackupFile> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${type}_${timestamp}.sql`;
      const filepath = path.join(this.backupDir, filename);

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

      // Get file stats
      const stats = fs.statSync(filepath);
      
      const backupFile: BackupFile = {
        id: timestamp,
        filename,
        size: stats.size,
        createdAt: new Date(),
        type,
      };

      console.log(`✅ ${type} backup created: ${filename} (${this.formatFileSize(stats.size)})`);

      // Clean old backups
      await this.cleanOldBackups();

      return backupFile;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBackupList(): Promise<BackupFile[]> {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles: BackupFile[] = [];

      for (const filename of files) {
        if (filename.endsWith('.sql')) {
          const filepath = path.join(this.backupDir, filename);
          const stats = fs.statSync(filepath);
          
          // Extract type and timestamp from filename
          const parts = filename.replace('.sql', '').split('_');
          const type = parts[1] as 'manual' | 'automatic';
          const timestamp = parts.slice(2).join('_');

          backupFiles.push({
            id: timestamp,
            filename,
            size: stats.size,
            createdAt: stats.birthtime,
            type,
          });
        }
      }

      // Sort by creation date (newest first)
      return backupFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    try {
      const filepath = path.join(this.backupDir, filename);
      
      if (!fs.existsSync(filepath)) {
        throw new Error('Backup file not found');
      }

      fs.unlinkSync(filepath);
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
      const backups = await this.getBackupList();
      
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        
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
    // Schedule backup every night at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🌙 Starting scheduled automatic backup...');
        await this.createBackup('automatic');
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    }, {
      timezone: 'Europe/Paris'
    });
    
    console.log('⏰ Automatic backup scheduled for 2:00 AM daily');
  }
}

// Singleton instance
export const backupService = new BackupService();