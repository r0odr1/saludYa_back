import express from 'express';
import { registro } from '../controllers/authController.js';

const router = express.Router();

router.post('/registro', registro);

export default router;