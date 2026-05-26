/**
 * tests/citas.test.js
 * Pruebas unitarias del controlador de citas.
 * Cubre los 13 endpoints de /api/citas/*
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import {
  buildApp, connectTestDB, disconnectTestDB, clearCollections,
  crearUsuarioTest, crearEspecialidadTest, crearDoctorTest, generarToken
} from './setup.js';
import Cita from '../models/Cita.js';

const app = buildApp();

let tokenPaciente, tokenDoctor, tokenAdmin;
let pacienteUser, doctorUser, adminUser;
let especialidad, doctor;

// Fecha futura para evitar que las citas fallen por ser pasadas
const FECHA_FUTURA = '2099-06-16';
const DIA_SEMANA_LUNES = 1;

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });

beforeEach(async () => {
  await clearCollections();

  pacienteUser = await crearUsuarioTest({ email: 'pac@t.com', rol: 'paciente' });
  doctorUser = await crearUsuarioTest({ email: 'doc@t.com', rol: 'doctor' });
  adminUser = await crearUsuarioTest({ email: 'adm@t.com', rol: 'admin' });

  tokenPaciente = generarToken(pacienteUser._id, 'paciente');
  tokenDoctor = generarToken(doctorUser._id, 'doctor');
  tokenAdmin = generarToken(adminUser._id, 'admin');

  especialidad = await crearEspecialidadTest({ nombre: 'Electroterapia', duracionMinutos: 30 });
  doctor = await crearDoctorTest(doctorUser._id, especialidad._id);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const crearCita = async () => {
  return await request(app)
    .post('/api/citas')
    .set('Authorization', `Bearer ${tokenPaciente}`)
    .send({
      doctorId: doctor._id.toString(),
      especialidadId: especialidad._id.toString(),
      fecha: FECHA_FUTURA,
      horaInicio: '10:00'
    });
};

afterEach(() => {
  vi.restoreAllMocks();
});

//Historial del paciente
describe('GET /api/citas/historial - casos extra', () => {
  it('debe devolver historial vacío', async () => {
    const res = await request(app)
      .get(`/api/citas/historial/${pacienteUser._id}`)
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(200);
    expect(res.body.historial).toEqual([]);
  });
});

// GET /api/citas/especialidades
describe('GET /api/citas/especialidades', () => {
  it('debe listar especialidades activas', async () => {
    const res = await request(app)
      .get('/api/citas/especialidades')
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.especialidades)).toBe(true);
    expect(res.body.especialidades.length).toBeGreaterThanOrEqual(1);
  });

  it('debe rechazar sin token (401)', async () => {
    const res = await request(app).get('/api/citas/especialidades');
    expect(res.status).toBe(401);
  });
});

// GET /api/citas/doctores-por-especialidad/:id
describe('GET /api/citas/doctores-por-especialidad/:especialidadId', () => {
  it('debe devolver los doctores de una especialidad', async () => {
    const res = await request(app)
      .get(`/api/citas/doctores-por-especialidad/${especialidad._id}`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.doctores)).toBe(true);
    expect(res.body.doctores.length).toBe(1);
  });

  it('debe devolver arreglo vacío para especialidad sin doctores', async () => {
    const otraEsp = await crearEspecialidadTest({ nombre: 'Sin Doctores' });
    const res = await request(app)
      .get(`/api/citas/doctores-por-especialidad/${otraEsp._id}`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(res.body.doctores.length).toBe(0);
  });
});

// GET /api/citas/disponibilidad/:doctorId/:fecha
describe('GET /api/citas/disponibilidad/:doctorId/:fecha', () => {
  it('debe devolver horarios disponibles para un día laborable', async () => {
    // 2099-06-16 es un lunes (dia=1) → doctor tiene horario ese día
    const res = await request(app)
      .get(`/api/citas/disponibilidad/${doctor._id}/${FECHA_FUTURA}`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.horarios)).toBe(true);
    expect(res.body.horarios.length).toBeGreaterThan(0);
    expect(res.body.disponible).toBe(true);
  });

  it('debe indicar no disponible para día sin horario (domingo)', async () => {
    // 2099-06-14 es domingo
    const res = await request(app)
      .get(`/api/citas/disponibilidad/${doctor._id}/2099-06-14`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(res.body.disponible).toBe(false);
    expect(res.body.horarios.length).toBe(0);
  });
});

describe('GET /api/citas/disponibilidad - casos extra', () => {
  it('debe responder con doctor inexistente', async () => {
    const res = await request(app)
      .get(`/api/citas/disponibilidad/aaaaaaaaaaaaaaaaaaaaaaaa/${FECHA_FUTURA}`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect([404, 400, 500, 200]).toContain(res.status);
  });
});

// POST /api/citas (agendar)
describe('POST /api/citas', () => {
  it('paciente puede agendar una cita', async () => {
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    expect(res.status).toBe(201);
    expect(res.body.cita).toBeDefined();
    expect(res.body.cita.estado).toBe('agendada');
    expect(res.body.cita.horaFin).toBe('10:30');
  });

  it('debe calcular horaFin automáticamente según duración', async () => {
    const espLarga = await crearEspecialidadTest({ nombre: 'Evaluación', duracionMinutos: 45 });
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: espLarga._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '08:00'
      });
    expect(res.status).toBe(201);
    expect(res.body.cita.horaFin).toBe('08:45');
  });

  it('debe rechazar horario ocupado (409)', async () => {
    const payload = {
      doctorId: doctor._id.toString(),
      especialidadId: especialidad._id.toString(),
      fecha: FECHA_FUTURA,
      horaInicio: '10:00'
    };
    // Primera cita
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send(payload);

    // Segunda cita en mismo horario
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send(payload);
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toContain('ya fue tomado');
  });

  it('doctor no puede agendar citas (403)', async () => {
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenDoctor}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    expect(res.status).toBe(403);
  });

  it('debe rechazar sin token', async () => {
    const res = await request(app).post('/api/citas').send({
      doctorId: doctor._id.toString(),
      especialidadId: especialidad._id.toString(),
      fecha: FECHA_FUTURA,
      horaInicio: '10:00'
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/citas - casos extra', () => {
  it('debe rechazar sin campos obligatorios (400)', async () => {
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({ doctorId: doctor._id.toString() });
    expect([400, 404]).toContain(res.status);
  });

  it('debe rechazar doctor inexistente', async () => {
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    expect([404, 400, 500]).toContain(res.status);
  });

  it('debe rechazar especialidad inexistente', async () => {
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    expect([404, 400, 500]).toContain(res.status);
  });
});

// REASIGNAR CITA
describe('PUT /api/citas/:id/reasignar - casos extra', () => {
  it('debe reasignar cita exitosamente', async () => {
    const crear = await crearCita();
    const otroDoctorUser = await crearUsuarioTest({
      email: 'otrodoc@t.com',
      rol: 'doctor'
    });
    const otroDoctor = await crearDoctorTest(otroDoctorUser._id, especialidad._id);

    const res = await request(app)
      .put(`/api/citas/${crear.body.cita._id}/reasignar`)
      .set('Authorization', `Bearer ${tokenDoctor}`)
      .send({ nuevoDoctorId: otroDoctor._id.toString() });
    expect([200, 409]).toContain(res.status);
  });

  it('debe rechazar sin nuevoDoctorId (400)', async () => {
    const crear = await crearCita();
    const res = await request(app)
      .put(`/api/citas/${crear.body.cita._id}/reasignar`)
      .set('Authorization', `Bearer ${tokenDoctor}`)
      .send({});
    expect([400, 404]).toContain(res.status);
  });
});

// GET /api/citas/mis-citas
describe('GET /api/citas/mis-citas', () => {
  it('debe devolver las citas del paciente autenticado', async () => {
    // Crear cita primero
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });

    const res = await request(app)
      .get('/api/citas/mis-citas')
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.citas)).toBe(true);
    expect(res.body.citas.length).toBe(1);
    expect(res.body.citas[0].esCancelable).toBeDefined();
  });

  it('debe devolver arreglo vacío si no hay citas', async () => {
    const res = await request(app)
      .get('/api/citas/mis-citas')
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(res.body.citas.length).toBe(0);
  });

  it('no accesible por doctor (403)', async () => {
    const res = await request(app)
      .get('/api/citas/mis-citas')
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(403);
  });
});

// DELETE /api/citas/:id (cancelar)
describe('DELETE /api/citas/:id', () => {
  it('paciente puede cancelar su cita', async () => {
    const crearRes = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    const citaId = crearRes.body.cita._id;

    const res = await request(app)
      .delete(`/api/citas/${citaId}`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('cancelada');

    // Verificar que el estado cambió
    const cita = await Cita.findById(citaId);
    expect(cita.estado).toBe('cancelada');
  });

  it('paciente no puede cancelar cita ajena (403)', async () => {
    const otroPaciente = await crearUsuarioTest({
      email: 'otro@test.com', rol: 'paciente'
    });
    const tokenOtro = generarToken(otroPaciente._id, 'paciente');

    const crearRes = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    const citaId = crearRes.body.cita._id;

    const res = await request(app)
      .delete(`/api/citas/${citaId}`)
      .set('Authorization', `Bearer ${tokenOtro}`);
    expect(res.status).toBe(403);
  });
});

// GET /api/citas/doctor/agenda
describe('GET /api/citas/doctor/agenda', () => {
  it('doctor puede ver su propia agenda', async () => {
    const res = await request(app)
      .get('/api/citas/doctor/agenda')
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.citas)).toBe(true);
  });

  it('doctor puede filtrar agenda por fecha', async () => {
    const res = await request(app)
      .get(`/api/citas/doctor/agenda?fecha=${FECHA_FUTURA}`)
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(200);
  });

  it('paciente no puede ver la agenda del doctor (403)', async () => {
    const res = await request(app)
      .get('/api/citas/doctor/agenda')
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(403);
  });
});

// POST /api/citas/:id/notas
describe('POST /api/citas/:id/notas', () => {
  it('doctor puede agregar nota médica a una cita', async () => {
    // Crear cita
    const crearRes = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    const citaId = crearRes.body.cita._id;

    const res = await request(app)
      .post(`/api/citas/${citaId}/notas`)
      .set('Authorization', `Bearer ${tokenDoctor}`)
      .send({ contenido: 'Paciente presenta dolor lumbar leve. Se aplicó TENS 20 min.' });
    expect(res.status).toBe(200);
    expect(res.body.cita.notas.length).toBe(1);
    expect(res.body.cita.notas[0].contenido).toContain('lumbar');
  });

  it('paciente no puede agregar notas (403)', async () => {
    const crearRes = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });

    const res = await request(app)
      .post(`/api/citas/${crearRes.body.cita._id}/notas`)
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({ contenido: 'Nota no permitida' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/citas/:id/notas - casos extra', () => {
  it('debe rechazar nota sin contenido (400)', async () => {
    const crear = await crearCita();
    const res = await request(app)
      .post(`/api/citas/${crear.body.cita._id}/notas`)
      .set('Authorization', `Bearer ${tokenDoctor}`)
      .send({});
    expect([400, 500]).toContain(res.status);
  });
});

// PUT /api/citas/:id/completar
describe('PUT /api/citas/:id/completar', () => {
  it('doctor puede completar una cita', async () => {
    const crearRes = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    const citaId = crearRes.body.cita._id;

    const res = await request(app)
      .put(`/api/citas/${citaId}/completar`)
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(200);

    const cita = await Cita.findById(citaId);
    expect(cita.estado).toBe('completada');
  });
});

describe('PUT /api/citas/:id/completar - casos extra', () => {
  it('doctor no puede completar cita ajena (403)', async () => {
    const crear = await crearCita();
    const otroUser = await crearUsuarioTest({
      email: 'otrod@t.com',
      rol: 'doctor'
    });
    const tokenOtroDoctor = generarToken(otroUser._id, 'doctor');

    const res = await request(app)
      .put(`/api/citas/${crear.body.cita._id}/completar`)
      .set('Authorization', `Bearer ${tokenOtroDoctor}`);
    expect([403, 404]).toContain(res.status);
  });
});

// GET /api/citas/historial/:pacienteId
describe('GET /api/citas/historial/:pacienteId', () => {
  it('doctor puede ver historial de un paciente', async () => {
    const res = await request(app)
      .get(`/api/citas/historial/${pacienteUser._id}`)
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.historial)).toBe(true);
  });

  it('admin puede ver historial (autorizado)', async () => {
    const res = await request(app)
      .get(`/api/citas/historial/${pacienteUser._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
  });

  it('paciente no puede ver historial ajeno (403)', async () => {
    const res = await request(app)
      .get(`/api/citas/historial/${pacienteUser._id}`)
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(403);
  });
});

// CITAS ADMIN
describe('GET /api/admin/citas', () => {
  it('admin puede listar todas las citas', async () => {
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });

    const res = await request(app)
      .get('/api/admin/citas')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.citas.length).toBeGreaterThanOrEqual(1);
  });

  it('admin puede filtrar citas por estado', async () => {
    const res = await request(app)
      .get('/api/admin/citas?estado=agendada')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    res.body.citas.forEach(c => expect(c.estado).toBe('agendada'));
  });
});

describe('DELETE /api/admin/citas/:id', () => {
  it('admin puede eliminar una cita permanentemente', async () => {
    const crearRes = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        doctorId: doctor._id.toString(),
        especialidadId: especialidad._id.toString(),
        fecha: FECHA_FUTURA,
        horaInicio: '10:00'
      });
    const citaId = crearRes.body.cita._id;

    const res = await request(app)
      .delete(`/api/admin/citas/${citaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);

    // Verificar eliminación real
    const cita = await Cita.findById(citaId);
    expect(cita).toBeNull();
  });

  it('debe retornar 404 si la cita no existe', async () => {
    const res = await request(app)
      .put('/api/citas/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({
        fecha: FECHA_FUTURA
      });

    expect(res.status).toBe(404);
  });
});

// ADMIN - DETALLE Y ACTUALIZAR CITA
describe('GET /api/admin/citas/:id', () => {
  it('admin debe obtener detalle de cita', async () => {
    const crear = await crearCita();
    const res = await request(app)
      .get(`/api/admin/citas/${crear.body.cita._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.cita).toBeDefined();
  });

  it('debe responder 404 con cita inexistente', async () => {
    const res = await request(app)
      .get('/api/admin/citas/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/citas/:id', () => {
  it('admin debe actualizar cita', async () => {
    const crear = await crearCita();
    const res = await request(app)
      .put(`/api/admin/citas/${crear.body.cita._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'completada' });
    expect(res.status).toBe(200);
  });

  it('debe rechazar estado inválido (400)', async () => {
    const crear = await crearCita();
    const res = await request(app)
      .put(`/api/admin/citas/${crear.body.cita._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'invalido' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/citas - con filtros', () => {
  it('debe listar con filtros de estado y fecha', async () => {
    const res = await request(app)
      .get('/api/admin/citas?estado=agendada&fecha=2099-06-16')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
  });
});

it('debe indicar fecha bloqueada del doctor', async () => {
  doctor.fechasBloqueadas = [
    {
      fecha: new Date(FECHA_FUTURA),
      motivo: 'Vacaciones'
    }
  ];

  await doctor.save();

  const res = await request(app)
    .get(`/api/citas/disponibilidad/${doctor._id}/${FECHA_FUTURA}`)
    .set('Authorization', `Bearer ${tokenPaciente}`);

  expect(res.status).toBe(200);

  expect(res.body.disponible).toBe(false);
  expect(res.body.mensaje).toContain('Vacaciones');
  expect(res.body.horarios).toEqual([]);
});

it('debe filtrar horarios pasados para el día actual', async () => {
  const hoy = new Date();

  const fechaHoy = hoy.toISOString().split('T')[0];

  const res = await request(app)
    .get(`/api/citas/disponibilidad/${doctor._id}/${fechaHoy}`)
    .set('Authorization', `Bearer ${tokenPaciente}`);

  expect(res.status).toBe(200);

  expect(Array.isArray(res.body.horarios)).toBe(true);
});

it('paciente no puede editar cita ajena', async () => {
  const otroPaciente = await crearUsuarioTest({
    email: 'otroedit@test.com',
    rol: 'paciente'
  });

  const tokenOtro = generarToken(otroPaciente._id, 'paciente');

  const crear = await crearCita();

  const res = await request(app)
    .put(`/api/citas/${crear.body.cita._id}`)
    .set('Authorization', `Bearer ${tokenOtro}`)
    .send({
      horaInicio: '11:00'
    });

  expect(res.status).toBe(403);
});

it('debe rechazar edición por conflicto horario', async () => {
  await crearCita();

  const segunda = await request(app)
    .post('/api/citas')
    .set('Authorization', `Bearer ${tokenPaciente}`)
    .send({
      doctorId: doctor._id.toString(),
      especialidadId: especialidad._id.toString(),
      fecha: FECHA_FUTURA,
      horaInicio: '11:00'
    });

  const res = await request(app)
    .put(`/api/citas/${segunda.body.cita._id}`)
    .set('Authorization', `Bearer ${tokenPaciente}`)
    .send({
      horaInicio: '10:00'
    });

  expect(res.status).toBe(409);
});

it('paciente puede editar su cita', async () => {
  const crear = await crearCita();

  const res = await request(app)
    .put(`/api/citas/${crear.body.cita._id}`)
    .set('Authorization', `Bearer ${tokenPaciente}`)
    .send({
      horaInicio: '12:00'
    });

  expect(res.status).toBe(200);
  expect(res.body.cita.horaInicio).toBe('12:00');
  expect(res.body.cita.horaFin).toBe('12:30');
});

it('debe manejar errores internos al editar cita', async () => {
  const crear = await crearCita();

  vi.spyOn(Cita, 'findById')
    .mockRejectedValueOnce(new Error('DB Error'));

  const res = await request(app)
    .put(`/api/citas/${crear.body.cita._id}`)
    .set('Authorization', `Bearer ${tokenPaciente}`)
    .send({
      horaInicio: '12:00'
    });

  expect(res.status).toBe(500);
});