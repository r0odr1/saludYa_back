import Cita from '../models/Cita.js';
import Doctor from '../models/Doctor.js';
import Especialidad from '../models/Especialidad.js';

/** Disponibilidad */
/** GET /api/citas/disponibilidad/:doctorId/:fecha */
export const obtenerDisponibilidad = async (req, res) => {
  try {
    const { doctorId, fecha } = req.params;

    const doctor = await Doctor.findById(doctorId).populate('especialidades');

    if (!doctor) {
      return res.status(404).json({ mensaje: 'Doctor no encontrado' });
    }

    const fechaConsulta = new Date(fecha);
    const diaSemana = fechaConsulta.getDay();

    /** Verificar si la fecha esta bloqueada */
    const fechaBloqueada = doctor.fechasBloqueadas.find(fb => {
      const fbFecha = new Date(fb.fecha);
      return fbFecha.toDateString() === fechaConsulta.toDateString();
    });

    if (fechaBloqueada) {
      return res.json({
        disponible: false,
        mensaje: `Fecha bloqueada: ${fechaBloqueada.motivo}`,
        horarios: []
      });
    }

    /** Obtener horario del doctor para ese dia */
    const horarioDia = doctor.horarios.find(h => h.dia === diaSemana);
    if (!horarioDia) {
      return res.json({
        disponible: false,
        mensaje: 'El doctor no atiende este día',
        horarios: []
      });
    }

    /** Generar slots de tiempo */
    const slots = generarSlots(
      horarioDia.horaInicio,
      horarioDia.horaFin,
      horarioDia.intervaloMinutos || 30
    );

    /** Obtener citas existentes para esa fecha - solo agendadas */
    const citasExistentes = await Cita.find({
      doctor: doctorId,
      fecha: {
        $gte: new Date(new Date(fecha).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(fecha).setHours(23, 59, 59, 999))
      },
      estado: 'agendada'
    });

    const horariosOcupados = citasExistentes.map(c => c.horaInicio);

    /** Filtrar slots pasados si es hoy */
    const ahora = new Date();
    const esHoy = new Date().toDateString() === new Date(fecha).toDateString();

    const horariosDisponibles = slots
      .filter(slot => !horariosOcupados.includes(slot.inicio))
      .filter(slot => {
        if (!esHoy) return true;
        const [h, m] = slot.inicio.split(':').map(Number);
        const horaSlot = new Date();
        horaSlot.setHours(h, m, 0, 0);
        return horaSlot > ahora;
      })
      .map(slot => ({
        ...slot,
        disponible: true
      }));

    res.json({
      disponible: horariosDisponibles.length > 0,
      doctor: {
        id: doctor._id,
        especialidades: doctor.especialidades
      },
      fecha,
      horarios: horariosDisponibles
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener disponibilidad', error: error.message });
  }
};

/** Agendar Cita */
/** POST /api/citas */
export const agendarCita = async (req, res) => {
  try {
    const { doctorId, especialidadId, fecha, horaInicio } = req.body;
    const pacienteId = req.usuario._id;

    /** Verificar que el doctor existe */
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({ mensaje: 'Doctor no encontrado' });
    }

    /** Verificar que la especialidad existe */
    const especialidad = await Especialidad.findById(especialidadId);

    if (!especialidad) {
      return res.status(404).json({ mensaje: 'Especialidad no encontrada' });
    }

    /** Calcular hora fin */
    const [h, m] = horaInicio.split(':').map(Number);
    const minutosFin = h * 60 + m + (especialidad.duracionMinutos || 30);
    const horaFin = `${String(Math.floor(minutosFin / 60)).padStart(2, '0')}:${String(minutosFin % 60).padStart(2, '0')}`;

    /** Verificar que el horario no esté ocupado - si hay alguna concurrencia */
    const citaExistente = await Cita.findOne({
      doctor: doctorId,
      fecha: {
        $gte: new Date(new Date(fecha).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(fecha).setHours(23, 59, 59, 999))
      },
      horaInicio,
      estado: 'agendada'
    });

    if (citaExistente) {
      return res.status(409).json({ mensaje: 'Este horario ya fue tomado por otro paciente. Por favor seleccione otro.' });
    }

    /** Verificar que la fecha/hora no sea pasada */
    const fechaCita = new Date(fecha);
    const [hCita, mCita] = horaInicio.split(':').map(Number);
    fechaCita.setHours(hCita, mCita, 0, 0);

    if (fechaCita <= new Date()) {
      return res.status(400).json({ mensaje: 'No puede agendar en una fecha/hora pasada.' });
    }

    const cita = await Cita.create({
      paciente: pacienteId,
      doctor: doctorId,
      especialidad: especialidadId,
      fecha: new Date(fecha),
      horaInicio,
      horaFin,
      estado: 'agendada'
    });

    const citaPopulada = await Cita.findById(cita._id)
      .populate('paciente', 'nombre email telefono')
      .populate({
        path: 'doctor',
        populate: { path: 'usuario', select: 'nombre email' }
      })
      .populate('especialidad');

    res.status(201).json({
      mensaje: 'Cita agendada exitosamente',
      cita: citaPopulada
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agendar cita', error: error.message });
  }
};

/** Mis Citas - Paciente */
/** GET /api/citas/mis-citas */
export const misCitas = async (req, res) => {
  try {
    const citas = await Cita.find({ paciente: req.usuario._id })
      .populate({
        path: 'doctor',
        populate: {
          path: 'usuario',
          select: 'nombre email'
        }
      })
      .populate('especialidad')
      .sort({
        fecha: -1,
        horaInicio: 1
      });

      /** Agregar flag de cancelable a cada cita */
    const citasConFlag = citas.map(cita => {
      const citaObj = cita.toObject();
      citaObj.esCancelable = cita.esCancelable();
      return citaObj;
    });

    res.json({ citas: citasConFlag });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener citas', error: error.message });
  }
};