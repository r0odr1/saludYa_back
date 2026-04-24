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

/** Editar Cita - Paciente */
/** PUT /api/citas/:id */
export const editarCita = async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id);

    if (!cita) {
      return res.status(404).json({ mensaje: 'Cita no encontrada' });
    }

    /** Solo el paciente dueño puede editar */
    if (cita.paciente.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ mensaje: 'No tiene permisos para editar esta cita.' });
    }

    /** Verificar restriccion de 3 horas */
    if (!cita.esCancelable()) {
      return res.status(400).json({ mensaje: 'No se puede modificar la cita. Faltan menos de 3 horas para su cita.' });
    }

    const { fecha, horaInicio, doctorId } = req.body;

    /** Si cambia horario, verificar disponibilidad */
    if (fecha || horaInicio) {
      const nuevaFecha = fecha || cita.fecha;
      const nuevaHora = horaInicio || cita.horaInicio;
      const doctorCheck = doctorId || cita.doctor;

      const conflicto = await Cita.findOne({
        _id: { $ne: cita._id }, doctor: doctorCheck,
        fecha: {
          $gte: new Date(new Date(nuevaFecha).setHours(0, 0, 0, 0)),
          $lte: new Date(new Date(nuevaFecha).setHours(23, 59, 59, 999))
        },
        horaInicio: nuevaHora,
        estado: 'agendada'
      });

      if (conflicto) return res.status(409).json({ mensaje: 'El nuevo horario no está disponible.' });

      /** Calcular nueva hora fin */
      const especialidad = await Especialidad.findById(cita.especialidad);
      const [hh, mm] = nuevaHora.split(':').map(Number);
      const minFin = hh * 60 + mm + (especialidad?.duracionMinutos || 30);
      const nuevaHoraFin = `${String(Math.floor(minFin / 60)).padStart(2, '0')}:${String(minFin % 60).padStart(2, '0')}`;

      cita.fecha = new Date(nuevaFecha);
      cita.horaInicio = nuevaHora;
      cita.horaFin = nuevaHoraFin;
    }

    if (doctorId) {
      cita.doctor = doctorId;
    }

    await cita.save();

    const citaActualizada = await Cita.findById(cita._id)
      .populate('paciente', 'nombre email')
      .populate({
        path: 'doctor',
        populate: { path: 'usuario', select: 'nombre email' } })
      .populate('especialidad');

    res.json({ mensaje: 'Cita actualizada', cita: citaActualizada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar cita', error: error.message });
  }
};

/** Cancelar Cita - Paciente */
/** DELETE /api/citas/:id */
export const cancelarCita = async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id);

    if (!cita) {
      return res.status(404).json({ mensaje: 'Cita no encontrada' });
    }

    if (cita.paciente.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ mensaje: 'No tiene permisos para cancelar esta cita.' });
    }

    if (!cita.esCancelable()) {
      return res.status(400).json({ mensaje: 'No se puede cancelar. Faltan menos de 3 horas para su cita.' });
    }

    cita.estado = 'cancelada';
    await cita.save();

    /** El horario queda libre automaticamente porque filtramos por estado = agendada */
    res.json({ mensaje: 'Cita cancelada. El horario queda disponible para otros pacientes.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cancelar cita', error: error.message });
  }
};

/** Funciones del Doctor */
/** GET /api/citas/doctor/agenda */
export const agendaDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ usuario: req.usuario._id });

    if (!doctor) {
      return res.status(404).json({ mensaje: 'Perfil de doctor no encontrado' });
    }

    const { fecha, estado } = req.query;
    const filtro = { doctor: doctor._id };

    if (fecha) {
      const fechaConsulta = new Date(fecha);
      filtro.fecha = {
        $gte: new Date(fechaConsulta.setHours(0, 0, 0, 0)),
        $lte: new Date(fechaConsulta.setHours(23, 59, 59, 999))
      };
    }

    if (estado) {
      filtro.estado = estado;
    }

    const citas = await Cita.find(filtro)
      .populate('paciente', 'nombre email telefono')
      .populate('especialidad')
      .populate({
        path: 'notas.doctor',
        select: 'nombre'
      })
      .sort({ fecha: 1, horaInicio: 1 });

    res.json({ citas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener agenda', error: error.message });
  }
};

/** PUT /api/citas/:id/reasignar */
export const reasignarCita = async (req, res) => {
  try {
    const { nuevoDoctorId } = req.body;

    const doctorActual = await Doctor.findOne({ usuario: req.usuario._id });

    if (!doctorActual) {
      return res.status(404).json({ mensaje: 'Perfil de doctor no encontrado' });
    }

    const cita = await Cita.findById(req.params.id);

    if (!cita) {
      return res.status(404).json({ mensaje: 'Cita no encontrada' });
    }

    /** Verificar que la cita pertenece al doctor actual */
    if (cita.doctor.toString() !== doctorActual._id.toString()) {
      return res.status(403).json({ mensaje: 'Esta cita no le pertenece.' });
    }

    /** Verificar que el nuevo doctor existe y esta disponible en ese horario */
    const nuevoDoctor = await Doctor.findById(nuevoDoctorId);

    if (!nuevoDoctor || !nuevoDoctor.activo) {
      return res.status(404).json({ mensaje: 'Doctor de destino no encontrado o inactivo.' });
    }

    /** Verificar disponibilidad del nuevo doctor */
    const conflicto = await Cita.findOne({
      doctor: nuevoDoctorId,
      fecha: cita.fecha,
      horaInicio: cita.horaInicio,
      estado: 'agendada'
    });

    if (conflicto) {
      return res.status(409).json({ mensaje: 'El doctor seleccionado no está disponible en ese horario.' });
    }

    cita.doctorOriginal = doctorActual._id;
    cita.reasignadaPor = req.usuario._id;
    cita.doctor = nuevoDoctorId;
    await cita.save();

    const citaActualizada = await Cita.findById(cita._id)
      .populate('paciente', 'nombre email')
      .populate({
        path: 'doctor',
        populate: { path: 'usuario', select: 'nombre email' }
      })
      .populate('especialidad');

    res.json({ mensaje: 'Cita reasignada exitosamente', cita: citaActualizada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al reasignar cita', error: error.message });
  }
};

/** POST /api/citas/:id/notas */
export const agregarNota = async (req, res) => {
  try {
    const { contenido } = req.body;
    const cita = await Cita.findById(req.params.id);

    if (!cita) {
      return res.status(404).json({ mensaje: 'Cita no encontrada' });
    }

    cita.notas.push({
      doctor: req.usuario._id,
      contenido,
      fecha: new Date()
    });

    await cita.save();

    const citaActualizada = await Cita.findById(cita._id)
      .populate('paciente', 'nombre email')
      .populate({
        path: 'notas.doctor',
        select: 'nombre'
      })
      .populate('especialidad');

    res.json({ mensaje: 'Nota agregada', cita: citaActualizada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar nota', error: error.message });
  }
};

/** PUT /api/citas/:id/completar */
export const completarCita = async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id);

    if (!cita) {
      return res.status(404).json({ mensaje: 'Cita no encontrada' });
    }

    cita.estado = 'completada';
    await cita.save();

    res.json({ mensaje: 'Cita marcada como completada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al completar cita', error: error.message });
  }
};

/** GET /api/citas/historial/:pacienteId */
export const historialPaciente = async (req, res) => {
  try {
    const citas = await Cita.find({
      paciente: req.params.pacienteId,
      estado: { $in: ['completada', 'agendada'] }
    })
      .populate('paciente', 'nombre email telefono')
      .populate({
        path: 'doctor',
        populate: { path: 'usuario', select: 'nombre email' }
      })
      .populate('especialidad')
      .populate({
        path: 'notas.doctor',
        select: 'nombre'
      })
      .sort({ fecha: -1 });

    res.json({ historial: citas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener historial', error: error.message });
  }
};

/** GET /api/citas/doctores-por-especialidad/:especialidadId */
export const doctoresPorEspecialidad = async (req, res) => {
  try {
    const doctores = await Doctor.find({
      especialidades: req.params.especialidadId,
      activo: true
    }).populate('usuario', 'nombre email');

    res.json({ doctores });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener doctores', error: error.message });
  }
};

/** Utilidades */
/** Funcion helper - generar slots de tiempo */
function generarSlots(horaInicio, horaFin, intervalo) {
  const slots = [];
  const [hI, mI] = horaInicio.split(':').map(Number);
  const [hF, mF] = horaFin.split(':').map(Number);

  let minActual = hI * 60 + mI;
  const minFin = hF * 60 + mF;

  while (minActual + intervalo <= minFin) {
    const inicio = `${String(Math.floor(minActual / 60)).padStart(2, '0')}:${String(minActual % 60).padStart(2, '0')}`;
    const finSlot = minActual + intervalo;
    const fin = `${String(Math.floor(finSlot / 60)).padStart(2, '0')}:${String(finSlot % 60).padStart(2, '0')}`;

    slots.push({ inicio, fin });
    minActual = finSlot;
  }

  return slots;
}