import mongoose from 'mongoose';

const horarioSchema = new mongoose.Schema({
  dia: {
    type: Number,
    required: true
  },
  horaInicio: {
    type: String,
    required: true
  },
  horaFin: {
    type: String,
    required: true
  },
  intervaloMinutos: {
    type: Number,
    default: 30
  }
});

const doctorSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  especialidades: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Especialidad'
  }],
  horarios: [horarioSchema],
  fechasBloqueadas: [{
    fecha: { type: Date },
    motivo: { type: String }
  }],
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;