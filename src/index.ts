// src/index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDB } from './config/initDB';
import routes from './routes/index';
import { startAutoCorteScheduler } from './utils/autoCorte';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../public/uploads');
const logosDir = path.join(uploadDir, 'logos');
[uploadDir, logosDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
  startAutoCorteScheduler();
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

