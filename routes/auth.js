import express from 'express';
import {
  registro,
  verificarCuenta,
  reenviarCodigo,
  login,
  solicitarReset,
  verificarReset,
  nuevaContrasena,
  perfil,
  actualizarPerfil,
  cambiarContrasena } from '../controllers/authController.js';
import { auth } from '../middleware/auth.js'

const router = express.Router();

/** Registro y verificacion */
router.post('/registro', registro);
router.post('/verificar-cuenta', verificarCuenta);
router.post('/reenviar-codigo', reenviarCodigo);

/** Login */
router.post('/login', login);

/** Reestablecimiento de contrasena */
router.post('/solicitar-reset', solicitarReset);
router.post('/verificar-reset', verificarReset);
router.post('/nueva-contrasena', nuevaContrasena);

/** PERFIL (requiere autenticación) */
router.get('/perfil', auth, perfil);
router.put('/perfil', auth, actualizarPerfil);
router.put('/cambiar-contrasena', auth, cambiarContrasena);

export default router;