import { Router } from 'express';
import {
  registrarDoctor, listarDoctores, actualizarDoctor,
  crearEspecialidad, listarEspecialidades, actualizarEspecialidad, eliminarEspecialidad,
  listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, cambiarRol,
  listarCitasAdmin, obtenerCitaAdmin, actualizarCitaAdmin, eliminarCitaAdmin,
  reportes
} from '../controllers/adminController.js';
import { auth, autorizar } from '../middleware/auth.js';

const router = Router();

/** Todas las rutas requieren auth + rol admin */
router.use(auth, autorizar('admin'));

/** Usuarios - gestión de cuentas y roles */
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', crearUsuario);
router.put('/usuarios/:id', actualizarUsuario);
router.put('/usuarios/:id/rol', cambiarRol);
router.delete('/usuarios/:id', eliminarUsuario);

/** Citas - gestión administrativa */
router.get('/citas', listarCitasAdmin);
router.get('/citas/:id', obtenerCitaAdmin);
router.put('/citas/:id', actualizarCitaAdmin);
router.delete('/citas/:id', eliminarCitaAdmin);

/** Doctores */
router.post('/doctores', registrarDoctor);
router.get('/doctores', listarDoctores);
router.put('/doctores/:id', actualizarDoctor);

/** Especialidades */
router.post('/especialidades', crearEspecialidad);
router.get('/especialidades', listarEspecialidades);
router.put('/especialidades/:id', actualizarEspecialidad);
router.delete('/especialidades/:id', eliminarEspecialidad);

/** Reportes */
router.get('/reportes', reportes);

export default router;
