/**
 * tests/auth.test.js
 * Pruebas unitarias/integración de autenticación
 */

import { vi } from 'vitest';

// MOCK EMAILS (IMPORTANTE)
// Evita inicializar Resend y enviar correos reales
vi.mock('../utils/email.js', () => ({
  generarCodigo: () => '123456',
  enviarCodigoVerificacion: vi.fn().mockResolvedValue(true),
  enviarCodigoReset: vi.fn().mockResolvedValue(true),
}));

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach
} from 'vitest'

import request from 'supertest';

import {
  buildApp,
  connectTestDB,
  disconnectTestDB,
  clearCollections,
  crearUsuarioTest,
} from './setup.js';

import User from '../models/User.js';

const app = buildApp();

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

beforeEach(async () => {
  await clearCollections();
});

// HEALTH CHECK
describe('GET /api/health', () => {
  it('debe responder 200 y status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// REGISTRO
describe('POST /api/auth/registro', () => {
  it('debe registrar usuario nuevo', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Juan Pérez',
        email: 'juan@test.com',
        password: 'Test1234!',
        telefono: '3001234567',
      });

    expect(res.status).toBe(201);
    expect(res.body.requiereVerificacion).toBe(true);
    expect(res.body.email).toBe('juan@test.com');
  });

  it('debe crear usuario con rol paciente', async () => {
    await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Ana',
        email: 'ana@test.com',
        password: 'Test1234!',
      });

    const usuario = await User.findOne({
      email: 'ana@test.com',
    });

    expect(usuario).toBeDefined();
    expect(usuario.rol).toBe('paciente');
    expect(usuario.cuentaVerificada).toBe(false);
  });

  it('debe rechazar email ya registrado', async () => {
    await crearUsuarioTest({
      email: 'existe@test.com',
      cuentaVerificada: true,
    });

    const res = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Duplicado',
        email: 'existe@test.com',
        password: 'Test1234!',
      });

    expect(res.status).toBe(400);
    expect(res.body.mensaje).toContain('ya está registrado');
  });

  it('debe rechazar contraseña sin mayúscula', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Test',
        email: 'test@test.com',
        password: 'sinmayuscula123',
      });

    expect(res.status).toBe(400);
  });

  it('debe rechazar contraseña sin número', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Test',
        email: 'test2@test.com',
        password: 'SinNumeroAqui',
      });

    expect(res.status).toBe(400);
  });
});

// VERIFICAR CUENTA
describe('POST /api/auth/verificar-cuenta', () => {
  it('debe verificar cuenta con código correcto', async () => {
    await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Pedro',
        email: 'pedro@test.com',
        password: 'Test1234!',
      });

    const usuario = await User.findOne({
      email: 'pedro@test.com',
    });

    const res = await request(app)
      .post('/api/auth/verificar-cuenta')
      .send({
        email: 'pedro@test.com',
        codigo: usuario.codigoVerificacion,
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.cuentaVerificada).toBe(true);
  });

  it('debe rechazar código incorrecto', async () => {
    await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Test',
        email: 'bad@test.com',
        password: 'Test1234!',
      });

    const res = await request(app)
      .post('/api/auth/verificar-cuenta')
      .send({
        email: 'bad@test.com',
        codigo: '000000',
      });

    expect(res.status).toBe(400);
  });
});

// LOGIN
describe('POST /api/auth/login', () => {
  it('debe hacer login correctamente', async () => {
    await crearUsuarioTest({
      email: 'login@test.com',
      password: 'Test1234!',
      cuentaVerificada: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'Test1234!',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe('login@test.com');
  });

  it('debe rechazar contraseña incorrecta', async () => {
    await crearUsuarioTest({
      email: 'login2@test.com',
      cuentaVerificada: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login2@test.com',
        password: 'Incorrecta123!',
      });

    expect(res.status).toBe(401);
  });

  it('debe retornar 403 si no está verificado', async () => {
    await crearUsuarioTest({
      email: 'noverif@test.com',
      password: 'Test1234!',
      cuentaVerificada: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'noverif@test.com',
        password: 'Test1234!',
      });

    expect(res.status).toBe(403);
    expect(res.body.requiereVerificacion).toBe(true);
  });
});

// SOLICITAR RESET
describe('POST /api/auth/solicitar-reset', () => {
  it('debe responder 200 aunque email no exista', async () => {
    const res = await request(app)
      .post('/api/auth/solicitar-reset')
      .send({
        email: 'noexiste@test.com',
      });

    expect(res.status).toBe(200);
  });

  it('debe generar código reset', async () => {
    await crearUsuarioTest({
      email: 'reset@test.com',
      cuentaVerificada: true,
    });

    await request(app)
      .post('/api/auth/solicitar-reset')
      .send({
        email: 'reset@test.com',
      });

    const usuario = await User.findOne({
      email: 'reset@test.com',
    });

    expect(usuario.codigoReset).toBeDefined();
    expect(usuario.codigoResetExpira).toBeDefined();
  });
});

// PERFIL
describe('GET /api/auth/perfil', () => {
  it('debe devolver 401 sin token', async () => {
    const res = await request(app).get('/api/auth/perfil');

    expect(res.status).toBe(401);
  });

  it('debe devolver perfil con token válido', async () => {
    const usuario = await crearUsuarioTest({
      email: 'perfil@test.com',
    });

    const { generarToken } = await import('./setup.js');

    const token = generarToken(
      usuario._id,
      usuario.rol
    );

    const res = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe('perfil@test.com');
  });
});

// CAMBIAR CONTRASEÑA
describe('PUT /api/auth/cambiar-contrasena', () => {
  it('debe cambiar contraseña correctamente', async () => {
    const usuario = await crearUsuarioTest({
      email: 'cambio@test.com',
      password: 'Test1234!',
    });

    const { generarToken } = await import('./setup.js');

    const token = generarToken(
      usuario._id,
      usuario.rol
    );

    const res = await request(app)
      .put('/api/auth/cambiar-contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contrasenaActual: 'Test1234!',
        nuevaContrasena: 'Nueva5678!',
      });

    expect(res.status).toBe(200);
  });

  it('debe rechazar contraseña actual incorrecta', async () => {
    const usuario = await crearUsuarioTest({
      email: 'fail@test.com',
    });

    const { generarToken } = await import('./setup.js');

    const token = generarToken(
      usuario._id,
      usuario.rol
    );

    const res = await request(app)
      .put('/api/auth/cambiar-contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contrasenaActual: 'Incorrecta!',
        nuevaContrasena: 'Nueva5678!',
      });

    expect(res.status).toBe(400);
  });
});