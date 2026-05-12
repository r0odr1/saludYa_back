/**
 * tests/auth.test.js
 * Pruebas unitarias del controlador de autenticación.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  buildApp, connectTestDB, disconnectTestDB,
  clearCollections, crearUsuarioTest
} from './setup.js';
import User from '../models/User.js';

const app = buildApp();

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
beforeEach(async () => { await clearCollections(); });

//** Health Check */
describe('GET /api/health', () => {
  it('debe responder 200 y status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});