import { randomBytes } from 'node:crypto';
import path from 'node:path';

const isProduction = process.env['NODE_ENV'] === 'production';

function jwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (secret) return secret;
  if (isProduction) {
    console.error('JWT_SECRET must be set in production. See backend/.env.example.');
    process.exit(1);
  }
  // Fine for local development: logins just reset whenever the server restarts.
  console.warn('JWT_SECRET is not set; using a random secret (you will be logged out on restart).');
  return randomBytes(32).toString('hex');
}

export const config = {
  isProduction,
  port: Number(process.env['PORT'] ?? 4000),
  jwtSecret: jwtSecret(),
  dbPath: path.resolve(process.env['DB_PATH'] ?? 'data/cardmaker.db'),
  // The built Angular app, served by this server in production
  frontendDir: path.resolve(import.meta.dirname, '../../frontend/dist/card-maker/browser'),
};
