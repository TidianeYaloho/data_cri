import { execSync } from 'child_process';
import path from 'path';

console.log('--- Migration : Fermeture de compte investisseur ---');

try {
  const sqlPath = path.resolve('migrations/schema_fermeture_compte.sql');
  console.log(`Application du fichier SQL : ${sqlPath}`);

  const dockerContainer = process.env.POSTGRES_CONTAINER || 'cri_projets-database-1';
  const dbUser = process.env.POSTGRES_USER || 'cri_user';
  const dbName = process.env.POSTGRES_DB || 'cri_projets';

  const isWin = process.platform === 'win32';
  const command = isWin
    ? `Get-Content "${sqlPath}" | docker exec -i ${dockerContainer} psql -U ${dbUser} -d ${dbName}`
    : `cat "${sqlPath}" | docker exec -i ${dockerContainer} psql -U ${dbUser} -d ${dbName}`;

  const output = execSync(command, {
    shell: isWin ? 'powershell.exe' : '/bin/sh',
    encoding: 'utf-8',
  });

  console.log('Output:\n' + output);
  console.log('✅ Migration appliquée avec succès.');
} catch (error) {
  console.error('❌ Erreur lors de l\'exécution de la migration :', error.message);
  console.log('👉 Vous pouvez appliquer manuellement le fichier migrations/schema_fermeture_compte.sql via psql.');
  process.exitCode = 1;
}
