import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.ts';
import { authRoutes, requireAuth } from './auth.ts';
import { cardRoutes } from './cards.ts';
import { errorHandler } from './errors.ts';

const app = express();

// Cards include their art as a base64 image, so allow larger request bodies.
app.use(express.json({ limit: '16mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/cards', requireAuth, cardRoutes);
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// In production this server also serves the built Angular app, so only one thing needs deploying.
// During development the Angular dev server (port 4200) is used instead.
if (existsSync(config.frontendDir)) {
  app.use(express.static(config.frontendDir));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(config.frontendDir, 'index.html')));
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`CardMaker API running on http://localhost:${config.port}`);
});
