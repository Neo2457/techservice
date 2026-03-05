// src/config/db.ts
// Base de datos con sql.js — funciona en cualquier versión de Node sin compilar
// sql.js es SQLite compilado a WebAssembly: sin binarios nativos, sin errores de compilación

import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = path.resolve(process.env.DB_PATH || './database/techservice.db');
const dbDir = path.dirname(DB_PATH);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db: Database | null = null;

// Guarda la BD en disco
export function persistDB(): void {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Carga o crea la BD
export async function getDB(): Promise<Database> {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }
  _db.run('PRAGMA foreign_keys = ON');
  return _db;
}

// Helper: run (INSERT/UPDATE/DELETE/CREATE)
export function run(db: Database, sql: string, params: (string | number | null)[] = []): { lastInsertRowid: number; changes: number } {
  db.run(sql, params);
  const lastId = (db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] as number) ?? 0;
  const changes = (db.exec('SELECT changes()')[0]?.values[0]?.[0] as number) ?? 0;
  return { lastInsertRowid: lastId, changes };
}

// Helper: obtiene una fila
export function get<T = Record<string, unknown>>(db: Database, sql: string, params: (string | number | null)[] = []): T | undefined {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return undefined;
  const { columns, values } = result[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[0][i]; });
  return row as T;
}

// Helper: obtiene múltiples filas
export function all<T = Record<string, unknown>>(db: Database, sql: string, params: (string | number | null)[] = []): T[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

