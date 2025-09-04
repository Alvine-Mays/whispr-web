// Petit serveur Express pour lancer le frontend avec `npm start`
// Réécritures: /dashboard/* -> dashboard.html ; /:username -> public-page.html

import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname; // dossier /frontend

const app = express();
app.disable('x-powered-by');
app.use(compression());

// Exposer l’ENV côté client sans build via /env.js
const ENV = {
  API_ORIGIN: process.env.API_ORIGIN ?? 'https://wishpr-api.onrender.com',
  BASE_URL: process.env.BASE_URL ?? `http://localhost:${process.env.PORT || 5173}`,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ?? null,
};
app.get('/env.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.end(`window.__ENV = ${JSON.stringify(ENV)};`);
});

// Proxy /api/* → target/api/* (toujours)
const targetBase = (ENV.API_ORIGIN || 'https://wishpr-api.onrender.com').replace(/\/$/, '');
app.use('/api', createProxyMiddleware({
  target: `${targetBase}/api`,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  logLevel: 'debug',
}));

// Cache léger pour assets
app.use((req, res, next) => {
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|ico|json)$/.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=600');
  }
  next();
});

// Fichiers statiques
app.use(express.static(root));

const send = (res, p) => res.sendFile(path.join(root, p));

// Routes dédiées
app.get('/dashboard/*', (req, res) => send(res, 'dashboard.html'));
app.get('/', (req, res) => send(res, 'index.html'));

// Catch-all: si l’URL ne correspond pas à un fichier, on sert la page publique
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  if (req.path.startsWith('/dashboard')) return send(res, 'dashboard.html');
  return send(res, 'public-page.html');
});

const port = process.env.PORT || 5173;
app.listen(port, () => {
  console.log(`Whispr frontend en écoute sur http://localhost:${port}`);
  console.log('ENV exposé:', ENV);
  console.log('Proxy cible:', `${targetBase}/api`);
});
