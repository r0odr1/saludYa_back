/**
 * tests/setup.js
 * Helper compartido por todos los archivos de prueba.
 * Levanta la app Express sin iniciar el servidor HTTP,
 * conecta/desconecta la base de datos de test y
 * expone utilidades para generar tokens y datos de prueba.
 */

import { vi } from "vitest";

vi.mock("../utils/email.js", () => ({
  generarCodigo: () => "123456",

  enviarCodigoVerificacion: vi.fn().mockResolvedValue(true),

  enviarCodigoReset: vi.fn().mockResolvedValue(true),
}));

import cors from "cors";
import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Cita from "../models/Cita.js";
import Doctor from "../models/Doctor.js";
import Especialidad from "../models/Especialidad.js";
import User from "../models/User.js";
import adminRoutes from "../routes/admin.js";
import authRoutes from "../routes/auth.js";
import citasRoutes from "../routes/citas.js";

//** APP FACTORY - sin app.listen — supertest lo maneja */
export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/citas", citasRoutes);
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  return app;
}

/** DB Helpers */
export async function connectTestDB() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("connectTestDB sólo debe ejecutarse en NODE_ENV=test");
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en .env.test");
  await mongoose.connect(uri);
  // Aseguramos que la base de datos de test esté limpia al iniciar
  try {
    await mongoose.connection.dropDatabase();
  } catch (err) {
    // Si falla, no interrumpimos la conexión, pero dejamos el error para debugging
    // Vitest/reportes mostrarán fallos posteriores si es crítico
    // eslint-disable-next-line no-console
    console.warn(
      "No se pudo limpiar la BD de test en connectTestDB:",
      err.message,
    );
  }
}

// Asegurar BD limpia al iniciar (evita duplicados si la DB persiste entre ejecuciones)
export async function ensureCleanTestDB() {
  if (process.env.NODE_ENV !== "test") return;
  if (mongoose.connection.readyState !== 1) return;
  await mongoose.connection.dropDatabase();
}

export async function disconnectTestDB() {
  if (process.env.NODE_ENV !== "test") {
    await mongoose.disconnect();
    return;
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Doctor.deleteMany({}),
    Especialidad.deleteMany({}),
    Cita.deleteMany({}),
  ]);
}

/** Token Helper */
export function generarToken(userId, rol) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "2h" });
}

/** Seed de prueba */
export async function crearUsuarioTest(overrides = {}) {
  const defaults = {
    nombre: "Test User",
    email: `test_${Date.now()}@test.com`,
    password: "Test1234!",
    rol: "paciente",
    activo: true,
    cuentaVerificada: true,
  };
  return await User.create({ ...defaults, ...overrides });
}

export async function crearEspecialidadTest(overrides = {}) {
  const defaults = {
    nombre: `Especialidad_${Date.now()}`,
    descripcion: "Especialidad de prueba",
    duracionMinutos: 30,
    color: "#059669",
    activa: true,
  };
  return await Especialidad.create({ ...defaults, ...overrides });
}

export async function crearDoctorTest(usuarioId, especialidadId) {
  return await Doctor.create({
    usuario: usuarioId,
    especialidades: especialidadId ? [especialidadId] : [],
    horarios: [
      { dia: 1, horaInicio: "08:00", horaFin: "17:00", intervaloMinutos: 30 },
      { dia: 2, horaInicio: "08:00", horaFin: "17:00", intervaloMinutos: 30 },
      { dia: 3, horaInicio: "08:00", horaFin: "17:00", intervaloMinutos: 30 },
      { dia: 4, horaInicio: "08:00", horaFin: "17:00", intervaloMinutos: 30 },
      { dia: 5, horaInicio: "08:00", horaFin: "17:00", intervaloMinutos: 30 },
    ],
    activo: true,
  });
}
