import { hashPassword } from '../src/utils/crypto';
import fs from 'fs';
import path from 'path';

async function setAllPasswords() {
  const newHash = await hashPassword('password');
  const sql = `-- Reset all user passwords to 'password'
UPDATE users SET password = '${newHash}';
`;

  const outPath = path.join(__dirname, '../drizzle/reset_all_passwords.sql');
  fs.writeFileSync(outPath, sql);
  console.log(`Generated reset_all_passwords.sql with hash for 'password'`);
}

setAllPasswords().catch(console.error);
