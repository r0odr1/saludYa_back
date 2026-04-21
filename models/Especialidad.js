import mongoose from 'mongoose';

const especialidadSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre de la especialidad es obligatorio'],
    unique: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  duracionMinutos: {
    type: Number,
    required: true,
    default: 30
  },
  color: {
    type: String,
    default: '#4F46E5'
  },
  activa: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Especialidad = mongoose.model('Especialidad', especialidadSchema);
export default Especialidad;