import { Router, type Response } from 'express';
import type { AuthUser } from './auth.ts';
import { db } from './db.ts';
import { HttpError } from './errors.ts';

interface CardRow {
  id: number;
  name: string;
  data: string;
  image: string;
  created_at: string;
  updated_at: string;
}

const MAX_DATA_LENGTH = 12_000_000; // card settings, mostly the uploaded art
const MAX_IMAGE_LENGTH = 3_000_000; // rendered catalog preview

function currentUser(res: Response): AuthUser {
  return res.locals['user'] as AuthUser;
}

function parseId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid card id');
  return id;
}

// Checks the request body has the shape { data: {...card settings}, image: "data:image/..." }.
function readCardBody(body: unknown): { name: string; data: string; image: string } {
  const { data, image } = (body ?? {}) as Record<string, unknown>;

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new HttpError(400, 'Card data is missing');
  }
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    throw new HttpError(400, 'Card image is missing');
  }

  const json = JSON.stringify(data);
  if (json.length > MAX_DATA_LENGTH || image.length > MAX_IMAGE_LENGTH) {
    throw new HttpError(413, 'That card is too large. Try a smaller art image.');
  }

  const rawName = (data as Record<string, unknown>)['name'];
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 100) : 'Untitled';
  return { name, data: json, image };
}

function toCard(row: CardRow) {
  return { id: row.id, name: row.name, data: JSON.parse(row.data), image: row.image, updatedAt: row.updated_at };
}

export const cardRoutes = Router();

// List the logged-in user's cards (without the full settings, to keep the response small)
cardRoutes.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT id, name, image, updated_at FROM cards WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
    .all(currentUser(res).id) as Pick<CardRow, 'id' | 'name' | 'image' | 'updated_at'>[];
  res.json(rows.map(r => ({ id: r.id, name: r.name, image: r.image, updatedAt: r.updated_at })));
});

cardRoutes.get('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?')
    .get(parseId(req.params.id), currentUser(res).id) as CardRow | undefined;
  if (!row) throw new HttpError(404, 'Card not found');
  res.json(toCard(row));
});

cardRoutes.post('/', (req, res) => {
  const { name, data, image } = readCardBody(req.body);
  const result = db
    .prepare('INSERT INTO cards (user_id, name, data, image) VALUES (?, ?, ?, ?)')
    .run(currentUser(res).id, name, data, image);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

cardRoutes.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  const { name, data, image } = readCardBody(req.body);
  const result = db
    .prepare(`UPDATE cards SET name = ?, data = ?, image = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(name, data, image, id, currentUser(res).id);
  if (result.changes !== 1) throw new HttpError(404, 'Card not found');
  res.json({ id });
});

cardRoutes.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM cards WHERE id = ? AND user_id = ?')
    .run(parseId(req.params.id), currentUser(res).id);
  if (result.changes !== 1) throw new HttpError(404, 'Card not found');
  res.status(204).end();
});
