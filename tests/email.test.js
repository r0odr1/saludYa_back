import { vi, describe, it, expect, beforeEach } from 'vitest';

const { sendMock } = vi.hoisted(() => {
  return {
    sendMock: vi.fn(),
  };
});

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

import {
  generarCodigo,
  enviarCodigoVerificacion,
  enviarCodigoReset
} from '../utils/email.js';

describe('email.js', () => {
  beforeEach(() => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    vi.clearAllMocks();

    sendMock.mockResolvedValue({});
  });

  describe('generarCodigo()', () => {
    it('debe generar un código de 6 dígitos', () => {
      const codigo = generarCodigo();

      expect(codigo).toMatch(/^\d{6}$/);
    });

    it('debe generar códigos diferentes', () => {
      const codigos = new Set();

      for (let i = 0; i < 50; i++) {
        codigos.add(generarCodigo());
      }

      expect(codigos.size).toBeGreaterThan(40);
    });

    it('códigos entre 100000 y 999999', () => {
      for (let i = 0; i < 20; i++) {
        const c = parseInt(generarCodigo());

        expect(c).toBeGreaterThanOrEqual(100000);
        expect(c).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('enviarCodigoVerificacion()', () => {
    it('retorna true sin credenciales (fallback)', async () => {
      const r = await enviarCodigoVerificacion(
        'test@t.com',
        'Juan',
        '123456'
      );

      expect(r).toBe(true);
    });

    it('funciona con caracteres especiales', async () => {
      const r = await enviarCodigoVerificacion(
        'a@a.com',
        'José',
        '111111'
      );

      expect(r).toBe(true);
    });

    it('debe retornar false si ocurre un error enviando verificación', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      sendMock.mockRejectedValueOnce(new Error('SMTP Error'));

      const r = await enviarCodigoVerificacion(
        'error@test.com',
        'Juan',
        '123456'
      );

      expect(r).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('enviarCodigoReset()', () => {
    it('retorna true sin credenciales', async () => {
      const r = await enviarCodigoReset(
        'test@t.com',
        'Juan',
        '123456'
      );

      expect(r).toBe(true);
    });

    it('funciona con datos largos', async () => {
      const r = await enviarCodigoReset(
        'largo@d.com',
        'Nombre Largo',
        '999999'
      );

      expect(r).toBe(true);
    });

    it('debe retornar false si ocurre un error enviando reset', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      sendMock.mockRejectedValueOnce(new Error('SMTP Error'));

      const r = await enviarCodigoReset(
        'error@test.com',
        'Juan',
        '123456'
      );

      expect(r).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});