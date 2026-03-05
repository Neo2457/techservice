// src/index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDB } from './config/initDB';
import routes from './routes/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Iniciar BD primero, luego el servidor
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔════════════════════════════════════════╗');
    console.log('  ║   TechService Pro — Servidor activo    ║');
    console.log(`  ║   http://localhost:${PORT}               ║`);
    console.log('  ╚════════════════════════════════════════╝');
    console.log('');
  });
}).catch(err => {
  console.error('Error iniciando BD:', err);
  process.exit(1);
});

export default app;

