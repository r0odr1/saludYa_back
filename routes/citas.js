import { Router } from 'express';
import { obtenerDisponibilidad, agendarCita, misCitas, editarCita } from '../controllers/citaController.js';
import { auth, autorizar } from '../middleware/auth.js';

const router = Router();

/** --- Rutas publicas - requieren auth pero no rol especifico --- */
/** Disponibilidad */
router.get('/disponibilidad/:doctorId/:fecha', auth, obtenerDisponibilidad);

/** --- Rutas de paciente --- */
router.post('/', auth, autorizar('paciente'), agendarCita);
router.get('/mis-citas', auth, autorizar('paciente'), misCitas);
router.put('/:id', auth, autorizar('paciente'), editarCita);

/** --- Rutas de doctor --- */

export default router;