import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router, type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.ts';
import { db } from './db.ts';
import { HttpError } from './errors.ts';

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

export interface AuthUser {
  id: number;
  username: string;
}

// Passwords are stored as "scrypt$<salt>$<hash>", never as the real password.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64');
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${hash.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function createToken(user: AuthUser): string {
  return jwt.sign({ sub: String(user.id), username: user.username }, config.jwtSecret, { expiresIn: '30d' });
}

function readCredentials(body: unknown): { username: string; password: string } {
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Username and password are required');
  }
  const name = username.trim();
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) {
    throw new HttpError(400, 'Username must be 3-24 letters, numbers, dots, dashes or underscores');
  }
  if (password.length < 8 || password.length > 200) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }
  return { username: name, password };
}

// Rejects the request with 401 unless it has a valid "Authorization: Bearer <token>" header.
export const requireAuth: RequestHandler = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  try {
    if (scheme !== 'Bearer' || !token) throw new Error('missing token');
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    res.locals['user'] = { id: Number(payload.sub), username: String(payload['username']) } satisfies AuthUser;
    next();
  } catch {
    next(new HttpError(401, 'Please log in again'));
  }
};

export const authRoutes = Router();

authRoutes.post('/register', async (req, res) => {
  const { username, password } = readCredentials(req.body);

  const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (existing) throw new HttpError(409, 'That username is already taken');

  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, await hashPassword(password));

  const user: AuthUser = { id: Number(result.lastInsertRowid), username };
  res.status(201).json({ token: createToken(user), username });
});

authRoutes.post('/login', async (req, res) => {
  const { username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'Username and password are required');
  }

  const row = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username.trim()) as { id: number; username: string; password_hash: string } | undefined;

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new HttpError(401, 'Wrong username or password');
  }

  res.json({ token: createToken(row), username: row.username });
});
