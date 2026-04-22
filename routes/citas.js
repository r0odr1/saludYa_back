import { Router } from 'express';
import { obtenerDisponibilidad, agendarCita } from '../controllers/citaController.js';
import { auth, autorizar } from '../middleware/auth.js';

const router = Router();

/** Rutas publicas - requieren auth pero no rol especifico */
router.get('/disponibilidad/:doctorId/:fecha', auth, obtenerDisponibilidad);

/** Rutas de paciente */
router.post('/', auth, autorizar('paciente'), agendarCita);

/** Rutas de doctor */

export default router;