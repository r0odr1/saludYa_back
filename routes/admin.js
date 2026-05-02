import { Router } from 'express';
import {
  registrarDoctor, listarDoctores, actualizarDoctor,
  crearEspecialidad, listarEspecialidades, actualizarEspecialidad, eliminarEspecialidad,
  listarUsuarios, cambiarRol,
  reportes
} from '../controllers/adminController.js';
import { auth, autorizar } from '../middleware/auth.js';

const router = Router();

/** Todas las rutas requieren auth + rol admin */
router.use(auth, autorizar('admin'));

/** Usuarios - gestión de roles */
router.get('/usuarios', listarUsuarios);
router.put('/usuarios/:id/rol', cambiarRol);

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
