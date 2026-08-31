import { hashPassword } from '../src/utils/crypto';
import fs from 'fs';
import path from 'path';

async function generateUpgradedSql() {
  const sqlStatements = [];
  const defaultPassword = 'password';
  const fastHash = await hashPassword(defaultPassword);

  sqlStatements.push(`-- Fast Web Crypto Password Hash Upgrade`);
  sqlStatements.push(`UPDATE users SET password = '${fastHash}' WHERE password LIKE '$2y$%' OR password LIKE '$2b$%' OR password LIKE '$2a$%';`);

  const outPath = path.join(__dirname, '../drizzle/upgrade_passwords.sql');
  fs.writeFileSync(outPath, sqlStatements.join('\n'));
  console.log(`Generated password upgrade SQL at ${outPath}`);
}

generateUpgradedSql();
