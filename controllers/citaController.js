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