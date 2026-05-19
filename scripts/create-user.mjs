import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scrum.db');
const MAX_USERNAME_LENGTH = 8;
const isAdmin = process.argv.includes('--admin');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let password = '';
    const onData = (ch) => {
      if (ch === '\u0003') {
        console.log('\nAborted.');
        process.exit(1);
      }
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        console.log('');
        resolve(password);
        return;
      }
      if (ch === '\u007F' || ch === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      password += ch;
      process.stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const username = await ask('Username (lowercase, max 8 chars): ');
  if (!username) throw new Error('Username is required.');
  if (username !== username.toLowerCase()) throw new Error('Username must be lowercase only.');
  if (username.length > MAX_USERNAME_LENGTH) {
    throw new Error(`Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`);
  }
  if (!/^[a-z][a-z0-9]*$/.test(username)) {
    throw new Error('Username must start with a letter and contain only lowercase letters and numbers.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) throw new Error(`Username "${username}" already exists.`);

  const password = await askPassword('Password: ');
  if (!password || password.length < 4) throw new Error('Password must be at least 4 characters.');

  const confirmPassword = await askPassword('Confirm password: ');
  if (password !== confirmPassword) throw new Error('Passwords do not match.');

  const id = uuidv4();
  const role = isAdmin ? 'admin' : 'member';
  const hash = bcrypt.hashSync(password, 10);

  db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)')
    .run(id, username, hash, role);

  console.log('\nUser created successfully.');
  console.log(`  Username: ${username}`);
  console.log(`  Role:     ${role}`);
  console.log(`  ID:       ${id}`);
  db.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
