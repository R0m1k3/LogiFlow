// Données du lot 5 (administration) : des sauvegardes en plus de celle de
// seed.ts, pour que la liste soit tronquée à dix et que la création d'une
// sauvegarde fasse le ménage des plus anciennes (backupService.cleanOldBackups).
// banc-sauvegarde-500 a un fichier (sauvegardes/backup_banc_500.sql), copié
// par compare.ts dans le dossier de sauvegardes de chaque serveur, comme celui
// de banc-sauvegarde-1.
type Query = (text: string, values?: unknown[]) => Promise<unknown>;

export async function seed(q: Query) {
  await q(`INSERT INTO database_backups (id, filename, description, size, created_at, created_by, tables_count, status, backup_type) VALUES
           ('banc-sauvegarde-500', 'backup_banc_500.sql', 'Manuel backup du banc', 64, CURRENT_DATE - 2 + time '14:00', 'admin_local', 26, 'completed', 'manual')`);
  // Neuf anciennes sauvegardes automatiques, sans fichier, un jour d'écart chacune
  for (let n = 1; n <= 9; n++) {
    await q(`INSERT INTO database_backups (id, filename, description, size, created_at, created_by, tables_count, status, backup_type)
             VALUES ($1, $2, 'Automatique backup du banc', $3, CURRENT_DATE - $4::int + time '02:00', 'system', 26, 'completed', 'automatic')`,
      [`banc-sauvegarde-${500 + n}`, `backup_banc_${500 + n}.sql`, 1024 * n, 2 + n]);
  }
}
