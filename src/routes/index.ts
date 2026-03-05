// src/routes/index.ts
// Enrutador principal — agrega todos los módulos

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

// Auth
import { login, getProfile, updateProfile, changePassword } from '../controllers/authController';

// Clientes
import { getClientes, getClienteById, createCliente, updateCliente, deleteCliente } from '../controllers/clientesController';

// Servicios
import { getServicios, getServicioById, createServicio, updateServicio, deleteServicio, getReporte, getDashboard } from '../controllers/serviciosController';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/login', login);
router.get('/auth/profile',          authMiddleware, getProfile);
router.put('/auth/profile',          authMiddleware, updateProfile);
router.put('/auth/change-password',  authMiddleware, changePassword);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, getDashboard);

// ── Clientes ──────────────────────────────────────────────────
router.get('/clientes',       authMiddleware, getClientes);
router.get('/clientes/:id',   authMiddleware, getClienteById);
router.post('/clientes',      authMiddleware, createCliente);
router.put('/clientes/:id',   authMiddleware, updateCliente);
router.delete('/clientes/:id',authMiddleware, deleteCliente);

// ── Servicios ─────────────────────────────────────────────────
router.get('/servicios/reporte',  authMiddleware, getReporte);
router.get('/servicios/dashboard',authMiddleware, getDashboard);
router.get('/servicios',          authMiddleware, getServicios);
router.get('/servicios/:id',      authMiddleware, getServicioById);
router.post('/servicios',         authMiddleware, createServicio);
router.put('/servicios/:id',      authMiddleware, updateServicio);
router.delete('/servicios/:id',   authMiddleware, deleteServicio);

export default router;
