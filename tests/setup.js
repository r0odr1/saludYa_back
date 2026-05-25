/**
 * tests/setup.js
 * Helper compartido por todos los archivos de prueba.
 * Levanta la app Express sin iniciar el servidor HTTP,
 * conecta/desconecta la base de datos de test y
 * expone utilidades para generar tokens y datos de prueba.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import authRoutes from '../routes/auth.js';
import adminRoutes from '../routes/admin.js';
import citasRoutes from '../routes/citas.js';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Especialidad from '../models/Especialidad.js';
import Cita from '../models/Cita.js';

//** APP FACTORY - sin app.listen — supertest lo maneja */
export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/citas', citasRoutes);
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  return app;
}

/** DB Helpers */
export async function connectTestDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI no definida en .env.test');
  await mongoose.connect(uri);
}

export async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Doctor.deleteMany({}),
    Especialidad.deleteMany({}),
    Cita.deleteMany({})
  ]);
}

/** Token Helper */
export function generarToken(userId, rol) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '2h' });
}

/** Seed de prueba */
export async function crearUsuarioTest(overrides = {}) {
  const defaults = {
    nombre: 'Test User',
    email: `test_${Date.now()}@test.com`,
    password: 'Test1234!',
    rol: 'paciente',
    activo: true,
    cuentaVerificada: true
  };
  return await User.create({ ...defaults, ...overrides });
}

export async function crearEspecialidadTest(overrides = {}) {
  const defaults = {
    nombre: `Especialidad_${Date.now()}`,
    descripcion: 'Especialidad de prueba',
    duracionMinutos: 30,
    color: '#059669',
    activa: true
  };
  return await Especialidad.create({ ...defaults, ...overrides });
}

export async function crearDoctorTest(usuarioId, especialidadId) {
  return await Doctor.create({
    usuario: usuarioId,
    especialidades: especialidadId ? [especialidadId] : [],
    horarios: [
      { dia: 1, horaInicio: '08:00', horaFin: '17:00', intervaloMinutos: 30 },
      { dia: 2, horaInicio: '08:00', horaFin: '17:00', intervaloMinutos: 30 },
      { dia: 3, horaInicio: '08:00', horaFin: '17:00', intervaloMinutos: 30 },
      { dia: 4, horaInicio: '08:00', horaFin: '17:00', intervaloMinutos: 30 },
      { dia: 5, horaInicio: '08:00', horaFin: '17:00', intervaloMinutos: 30 }
    ],
    activo: true
  });
}
