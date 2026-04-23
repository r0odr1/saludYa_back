import { Router } from 'express';
import { obtenerDisponibilidad, agendarCita, misCitas, editarCita, cancelarCita, agendaDoctor, doctoresPorEspecialidad } from '../controllers/citaController.js';
import { listarEspecialidades, listarDoctores } from '../controllers/adminController.js';
import { auth, autorizar } from '../middleware/auth.js';

const router = Router();

/** --- Rutas publicas - requieren auth pero no rol especifico --- */
/** Especialidades - lectura para todos los autenticados */
router.get('/especialidades', auth, listarEspecialidades);

/** Listar todos los doctores - para reasignacion y consultas */
router.get('/doctores', auth, autorizar('doctor', 'admin'), listarDoctores);

/** Doctores por especialidad */
router.get('/doctores-por-especialidad/:especialidadId', auth, doctoresPorEspecialidad);

/** Disponibilidad */
router.get('/disponibilidad/:doctorId/:fecha', auth, obtenerDisponibilidad);

/** --- Rutas de paciente --- */
router.post('/', auth, autorizar('paciente'), agendarCita);
router.get('/mis-citas', auth, autorizar('paciente'), misCitas);
router.put('/:id', auth, autorizar('paciente'), editarCita);
router.delete('/:id', auth, autorizar('paciente'), cancelarCita);

/** --- Rutas de doctor --- */
router.get('/doctor/agenda', auth, autorizar('doctor'), agendaDoctor);

export default router;