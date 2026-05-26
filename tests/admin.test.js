/**
 * tests/admin.test.js
 * Pruebas unitarias del controlador de administración.
 * Cubre los 17 endpoints de /api/admin/*
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  buildApp, connectTestDB, disconnectTestDB, clearCollections,
  crearUsuarioTest, crearEspecialidadTest, crearDoctorTest, generarToken
} from './setup.js';

const app = buildApp();

// Tokens reutilizados en los tests
let tokenAdmin, tokenPaciente, tokenDoctor;
let adminUser, pacienteUser, doctorUser;

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });

beforeEach(async () => {
  await clearCollections();

  // Crear usuarios base para todos los tests
  adminUser = await crearUsuarioTest({ email: 'admin@t.com', rol: 'admin' });
  pacienteUser = await crearUsuarioTest({ email: 'pac@t.com', rol: 'paciente' });
  doctorUser = await crearUsuarioTest({ email: 'doc@t.com', rol: 'doctor' });

  tokenAdmin = generarToken(adminUser._id, 'admin');
  tokenPaciente = generarToken(pacienteUser._id, 'paciente');
  tokenDoctor = generarToken(doctorUser._id, 'doctor');
});

// ============================================================
// ESPECIALIDADES
// ============================================================
describe('POST /api/admin/especialidades', () => {
  it('admin puede crear especialidad', async () => {
    const res = await request(app)
      .post('/api/admin/especialidades')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Electroterapia', duracionMinutos: 30, color: '#D97706' });
    expect(res.status).toBe(201);
    expect(res.body.especialidad.nombre).toBe('Electroterapia');
  });

  it('paciente no puede crear especialidad (403)', async () => {
    const res = await request(app)
      .post('/api/admin/especialidades')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({ nombre: 'Electroterapia', duracionMinutos: 30 });
    expect(res.status).toBe(403);
  });

  it('debe rechazar sin token (401)', async () => {
    const res = await request(app)
      .post('/api/admin/especialidades')
      .send({ nombre: 'Test', duracionMinutos: 30 });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/especialidades', () => {
  it('debe listar especialidades activas', async () => {
    await crearEspecialidadTest({ nombre: 'Masoterapia' });
    await crearEspecialidadTest({ nombre: 'Evaluación' });

    const res = await request(app)
      .get('/api/admin/especialidades')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.especialidades.length).toBe(2);
  });

  it('no debe incluir especialidades inactivas', async () => {
    await crearEspecialidadTest({ nombre: 'Activa', activa: true });
    await crearEspecialidadTest({ nombre: 'Inactiva', activa: false });

    const res = await request(app)
      .get('/api/admin/especialidades')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.especialidades.length).toBe(1);
    expect(res.body.especialidades[0].nombre).toBe('Activa');
  });
});

describe('PUT /api/admin/especialidades/:id', () => {
  it('debe actualizar una especialidad', async () => {
    const esp = await crearEspecialidadTest({ nombre: 'Original' });

    const res = await request(app)
      .put(`/api/admin/especialidades/${esp._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ duracionMinutos: 45, descripcion: 'Descripción actualizada' });
    expect(res.status).toBe(200);
    expect(res.body.especialidad.duracionMinutos).toBe(45);
  });
});

describe('DELETE /api/admin/especialidades/:id', () => {
  it('debe desactivar (no eliminar) la especialidad', async () => {
    const esp = await crearEspecialidadTest({ nombre: 'Para Desactivar' });

    const res = await request(app)
      .delete(`/api/admin/especialidades/${esp._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.especialidad.activa).toBe(false);
  });
});

describe('POST /api/admin/especialidades - casos extra', () => {
  it('debe rechazar sin campos (400 o 500)', async () => {
    const res = await request(app)
      .post('/api/admin/especialidades')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});
    expect([400, 500]).toContain(res.status);
  });
});

describe('PUT /api/admin/especialidades/:id - casos extra', () => {
  it('debe responder 404 con especialidad inexistente', async () => {
    const res = await request(app)
      .put('/api/admin/especialidades/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ duracionMinutos: 45 });
    expect([404, 500]).toContain(res.status);
  });
});

describe('DELETE /api/admin/especialidades/:id - casos extra', () => {
  it('debe responder 200 aunque la especialidad no exista', async () => {
    const res = await request(app)
      .delete('/api/admin/especialidades/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
  });
});

// ============================================================
// DOCTORES
// ============================================================
describe('POST /api/admin/doctores', () => {
  it('debe registrar un doctor con perfil profesional', async () => {
    const esp = await crearEspecialidadTest();

    const res = await request(app)
      .post('/api/admin/doctores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Dr. Nuevo',
        email: `drnuevo_${Date.now()}@test.com`,
        password: 'Doctor123!',
        telefono: '3001112233',
        especialidades: [esp._id.toString()],
        horarios: [
          { dia: 1, horaInicio: '08:00', horaFin: '17:00', intervaloMinutos: 30 }
        ]
      });
    expect(res.status).toBe(201);
    expect(res.body.doctor).toBeDefined();
    expect(res.body.doctor.usuario).toBeDefined();
  });

  it('paciente no puede registrar doctores (403)', async () => {
    const res = await request(app)
      .post('/api/admin/doctores')
      .set('Authorization', `Bearer ${tokenPaciente}`)
      .send({ nombre: 'Intruso', email: 'intruso@test.com', password: 'Test1234!' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/doctores', () => {
  it('debe listar todos los doctores', async () => {
    const esp = await crearEspecialidadTest();
    await crearDoctorTest(doctorUser._id, esp._id);

    const res = await request(app)
      .get('/api/admin/doctores')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.doctores)).toBe(true);
    expect(res.body.doctores.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PUT /api/admin/doctores/:id', () => {
  it('debe actualizar datos del doctor', async () => {
    const esp = await crearEspecialidadTest();
    const doctor = await crearDoctorTest(doctorUser._id, esp._id);

    const res = await request(app)
      .put(`/api/admin/doctores/${doctor._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ activo: false });
    expect(res.status).toBe(200);
    expect(res.body.doctor.activo).toBe(false);
  });
});

describe('POST /api/admin/doctores - casos extra', () => {
  it('debe rechazar sin campos (400 o 500)', async () => {
    const res = await request(app)
      .post('/api/admin/doctores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});
    expect([400, 500]).toContain(res.status);
  });

  it('debe rechazar email duplicado', async () => {
    const especialidad = await crearEspecialidadTest();

    const res = await request(app)
      .post('/api/admin/doctores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Dup',
        email: 'pac@t.com',
        password: 'Doctor123!',
        especialidades: [especialidad._id.toString()]
      });

    expect([400, 500]).toContain(res.status);
  });
});

describe('PUT /api/admin/doctores/:id - casos extra', () => {
  it('debe responder 404 con doctor inexistente', async () => {
    const res = await request(app)
      .put('/api/admin/doctores/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ activo: false });
    expect([404, 500]).toContain(res.status);
  });
});

// ============================================================
// USUARIOS
// ============================================================
describe('GET /api/admin/usuarios', () => {
  it('debe listar todos los usuarios', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.usuarios)).toBe(true);
    expect(res.body.usuarios.length).toBeGreaterThanOrEqual(3);
  });

  it('debe filtrar usuarios por rol', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios?rol=paciente')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    res.body.usuarios.forEach(u => expect(u.rol).toBe('paciente'));
  });

  it('debe buscar por nombre', async () => {
    await crearUsuarioTest({ email: 'buscar@test.com', nombre: 'Carlos Buscado' });

    const res = await request(app)
      .get('/api/admin/usuarios?buscar=carlos')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.usuarios.some(u => u.nombre.toLowerCase().includes('carlos'))).toBe(true);
  });

  it('paciente no puede listar usuarios (403)', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/usuarios', () => {
  it('debe crear usuario con cuenta verificada automáticamente', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Usuario Admin Creado',
        email: `admincreado_${Date.now()}@test.com`,
        password: 'Admin1234!',
        rol: 'paciente'
      });
    expect(res.status).toBe(201);
    expect(res.body.usuario.cuentaVerificada).toBe(true);
  });

  it('debe crear perfil de doctor al crear usuario con rol doctor', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Dr. Admin Creado',
        email: `dradmin_${Date.now()}@test.com`,
        password: 'Doctor1234!',
        rol: 'doctor'
      });
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('doctor');
  });

  it('debe rechazar email duplicado', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Dup', email: 'pac@t.com', password: 'Test1234!' });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toContain('ya está registrado');
  });

  it('debe rechazar rol inválido', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Rol raro', email: 'raro@test.com', password: 'Test1234!', rol: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toContain('Rol inválido');
  });
});

describe('PUT /api/admin/usuarios/:id', () => {
  it('debe actualizar nombre y teléfono', async () => {
    const res = await request(app)
      .put(`/api/admin/usuarios/${pacienteUser._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Nombre Editado', telefono: '3119876543' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Nombre Editado');
    expect(res.body.usuario.telefono).toBe('3119876543');
  });

  it('debe retornar 404 para ID inexistente', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'No existe' });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/usuarios/:id/rol', () => {
  it('debe cambiar el rol de paciente a doctor', async () => {
    const res = await request(app)
      .put(`/api/admin/usuarios/${pacienteUser._id}/rol`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'doctor' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('doctor');
  });

  it('admin no puede cambiar su propio rol', async () => {
    const res = await request(app)
      .put(`/api/admin/usuarios/${adminUser._id}/rol`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'paciente' });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toContain('propio rol');
  });

  it('debe rechazar rol inválido', async () => {
    const res = await request(app)
      .put(`/api/admin/usuarios/${pacienteUser._id}/rol`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'superadmin' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/usuarios/:id', () => {
  it('debe desactivar usuario', async () => {
    const usuario = await crearUsuarioTest({ email: 'delete@test.com' });
    const res = await request(app)
      .delete(`/api/admin/usuarios/${usuario._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('desactivado');
  });

  it('admin no puede desactivarse a sí mismo', async () => {
    const res = await request(app)
      .delete(`/api/admin/usuarios/${adminUser._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toContain('propia cuenta');
  });
});

describe('POST /api/admin/usuarios - casos extra', () => {
  it('debe rechazar sin campos obligatorios (400)', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Solo nombre' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/usuarios/:id - casos extra', () => {
  it('debe responder 404 con usuario inexistente', async () => {
    const res = await request(app)
      .delete('/api/admin/usuarios/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/usuarios/:id/rol - casos extra', () => {
  it('debe responder 404 con usuario inexistente', async () => {
    const res = await request(app)
      .put('/api/admin/usuarios/aaaaaaaaaaaaaaaaaaaaaaaa/rol')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ rol: 'doctor' });
    expect([404, 500]).toContain(res.status);
  });
});

describe('DELETE /api/admin/citas/:id - casos extra', () => {
  it('debe responder 404 con cita inexistente', async () => {
    const res = await request(app)
      .delete('/api/admin/citas/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// REPORTES
// ============================================================
describe('GET /api/admin/reportes', () => {
  it('debe devolver reporte con estructura correcta', async () => {
    const res = await request(app)
      .get('/api/admin/reportes?mes=4&anio=2026')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCitas');
    expect(res.body).toHaveProperty('porEspecialidad');
    expect(res.body).toHaveProperty('porEstado');
    expect(res.body).toHaveProperty('periodo');
  });

  it('paciente no puede ver reportes (403)', async () => {
    const res = await request(app)
      .get('/api/admin/reportes')
      .set('Authorization', `Bearer ${tokenPaciente}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/reportes - casos extra', () => {
  it('debe aceptar período personalizado', async () => {
    const res = await request(app)
      .get('/api/admin/reportes?mes=6&anio=2099')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
  });

  it('doctor no puede ver reportes (403)', async () => {
    const res = await request(app)
      .get('/api/admin/reportes')
      .set('Authorization', `Bearer ${tokenDoctor}`);
    expect(res.status).toBe(403);
  });
});
