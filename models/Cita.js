import mongoose from 'mongoose';

const notaSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contenido: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const citaSchema = new mongoose.Schema({
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  especialidad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Especialidad',
    required: true
  },
  fecha: {
    type: Date,
    required: [true, 'La fecha es obligatoria']
  },
  horaInicio: {
    type: String,
    required: [true, 'La hora de inicio es obligatoria']
  },
  horaFin: {
    type: String,
    required: [true, 'La hora de fin es obligatoria']
  },
  estado: {
    type: String,
    enum: ['agendada', 'completada', 'cancelada', 'no_asistio'],
    default: 'agendada'
  },
  notas: [notaSchema],
  reasignadaPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  doctorOriginal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    default: null
  }
}, {
  timestamps: true
});

citaSchema.index({ doctor: 1, fecha: 1, horaInicio: 1, estado: 1 });

citaSchema.methods.esCancelable = function() {
  const ahora = new Date();
  const fechaCita = new Date(this.fecha);
  const [horas, minutos] = this.horaInicio.split(':').map(Number);
  fechaCita.setHours(horas, minutos, 0, 0);
  const diferencia = fechaCita.getTime() - ahora.getTime();
  const tresHorasMs = 3 * 60 * 60 * 1000;
  return diferencia > tresHorasMs;
};

const Cita = mongoose.model('Cita', citaSchema);
export default Cita;