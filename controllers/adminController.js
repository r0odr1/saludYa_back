import Cita from "../models/Cita.js";
import Doctor from "../models/Doctor.js";
import Especialidad from "../models/Especialidad.js";
import User from "../models/User.js";

/** Gestionar Doctores */
/** POST /api/admin/doctores - Registrar un doctor */
export const registrarDoctor = async (req, res) => {
  try {
    const { nombre, email, password, telefono, especialidades, horarios } =
      req.body;

    const usuario = await User.create({
      nombre,
      email,
      password,
      telefono,
      rol: "doctor",
      cuentaVerificada: true,
    });

    /** Crear perfil de doctor */
    const doctor = await Doctor.create({
      usuario: usuario._id,
      especialidades: especialidades || [],
      horarios: horarios || [],
      activo: true,
    });

    const doctorPopulado = await Doctor.findById(doctor._id)
      .populate("usuario", "-password")
      .populate("especialidades");

    res
      .status(201)
      .json({
        mensaje: "Doctor registrado exitosamente",
        doctor: doctorPopulado,
      });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al registrar doctor", error: error.message });
  }
};

/** GET /api/admin/doctores - Listar todos los doctores */
export const listarDoctores = async (req, res) => {
  try {
    const doctores = await Doctor.find()
      .populate("usuario", "-password")
      .populate("especialidades");

    res.json({ doctores });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al obtener doctores", error: error.message });
  }
};

/** PUT /api/admin/doctores/:id - Actualizar doctor */
export const actualizarDoctor = async (req, res) => {
  try {
    const { especialidades, horarios, activo } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { especialidades, horarios, activo },
      { new: true, runValidators: true },
    )
      .populate("usuario", "-password")
      .populate("especialidades");

    if (!doctor) {
      return res.status(404).json({ mensaje: "Doctor no encontrado" });
    }

    res.json({ mensaje: "Doctor actualizado", doctor });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al actualizar doctor", error: error.message });
  }
};

/** Gestionar Especialidades */
/** POST /api/admin/especialidades */
export const crearEspecialidad = async (req, res) => {
  try {
    const especialidad = await Especialidad.create(req.body);
    res.status(201).json({ mensaje: "Especialidad creada", especialidad });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al crear especialidad", error: error.message });
  }
};

/** GET /api/admin/especialidades */
export const listarEspecialidades = async (req, res) => {
  try {
    const especialidades = await Especialidad.find({ activa: true });
    res.json({ especialidades });
  } catch (error) {
    res
      .status(500)
      .json({
        mensaje: "Error al obtener especialidades",
        error: error.message,
      });
  }
};

/** PUT /api/admin/especialidades/:id */
export const actualizarEspecialidad = async (req, res) => {
  try {
    const especialidad = await Especialidad.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!especialidad) {
      return res.status(404).json({ mensaje: "Especialidad no encontrada" });
    }

    res.json({ mensaje: "Especialidad actualizada", especialidad });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al actualizar", error: error.message });
  }
};

/** DELETE /api/admin/especialidades/:id */
export const eliminarEspecialidad = async (req, res) => {
  try {
    const especialidad = await Especialidad.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true },
    );

    res.json({ mensaje: "Especialidad desactivada", especialidad });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al eliminar", error: error.message });
  }
};

/** Gestionar usuarios */
/** GET /api/admin/usuarios - Listar todos los usuarios */
export const listarUsuarios = async (req, res) => {
  try {
    const { rol, buscar } = req.query;
    const filtro = {};

    if (rol) filtro.rol = rol;
    if (buscar) {
      filtro.$or = [
        { nombre: { $regex: buscar, $options: "i" } },
        { email: { $regex: buscar, $options: "i" } },
      ];
    }

    const usuarios = await User.find(filtro)
      .select("-password")
      .sort({ createdAt: -1 });
    res.json({ usuarios });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al obtener usuarios", error: error.message });
  }
};

/** PUT /api/admin/usuarios/:id/rol - Cambiar rol de usuario */
export const cambiarRol = async (req, res) => {
  try {
    const { rol, especialidades, horarios } = req.body;

    if (!["paciente", "doctor", "admin"].includes(rol)) {
      return res.status(400).json({ mensaje: "Rol inválido." });
    }

    const usuario = await User.findById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    /** No permitir cambiar el rol del propio admin */
    if (usuario._id.toString() === req.usuario._id.toString()) {
      return res
        .status(400)
        .json({ mensaje: "No puedes cambiar tu propio rol." });
    }

    const rolAnterior = usuario.rol;
    usuario.rol = rol;
    await usuario.save();

    /** Si el nuevo rol es doctor, crear perfil de doctor */
    if (rol === "doctor") {
      const doctorExistente = await Doctor.findOne({ usuario: usuario._id });
      if (!doctorExistente) {
        await Doctor.create({
          usuario: usuario._id,
          especialidades: especialidades || [],
          horarios: horarios || [],
          activo: true,
        });
      }
    }

    /** Si dejó de ser doctor, desactivar perfil de doctor */
    if (rolAnterior === "doctor" && rol !== "doctor") {
      await Doctor.findOneAndUpdate(
        { usuario: usuario._id },
        { activo: false },
      );
    }

    const usuarioActualizado = await User.findById(usuario._id).select(
      "-password",
    );

    res.json({
      mensaje: `Rol cambiado de ${rolAnterior} a ${rol} exitosamente.`,
      usuario: usuarioActualizado,
    });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al cambiar rol", error: error.message });
  }
};

/** POST /api/admin/usuarios */
export const crearUsuario = async (req, res) => {
  try {
    const {
      nombre,
      email,
      password,
      telefono,
      rol = "paciente",
      especialidades,
      horarios,
    } = req.body;

    if (!nombre || !email || !password) {
      return res
        .status(400)
        .json({ mensaje: "Nombre, email y contraseña son obligatorios." });
    }

    if (!["paciente", "doctor", "admin"].includes(rol)) {
      return res.status(400).json({ mensaje: "Rol inválido." });
    }

    const existente = await User.findOne({ email });
    if (existente) {
      return res
        .status(400)
        .json({ mensaje: "Este correo ya está registrado." });
    }

    const usuario = await User.create({
      nombre,
      email,
      password,
      telefono,
      rol,
      activo: true,
      cuentaVerificada: true,
    });

    if (rol === "doctor") {
      await Doctor.create({
        usuario: usuario._id,
        especialidades: especialidades || [],
        horarios: horarios || [],
        activo: true,
      });
    }

    const usuarioCreado = await User.findById(usuario._id).select("-password");
    res
      .status(201)
      .json({ mensaje: "Usuario creado exitosamente", usuario: usuarioCreado });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al crear usuario", error: error.message });
  }
};

/** PUT /api/admin/usuarios/:id */
export const actualizarUsuario = async (req, res) => {
  try {
    const { nombre, telefono, activo } = req.body;

    const usuario = await User.findById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const updates = {};
    if (typeof nombre !== "undefined") updates.nombre = nombre;
    if (typeof telefono !== "undefined") updates.telefono = telefono;
    if (typeof activo !== "undefined") updates.activo = activo;

    const usuarioActualizado = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (typeof activo !== "undefined" && usuario.rol === "doctor") {
      await Doctor.findOneAndUpdate(
        { usuario: usuario._id },
        { activo: activo },
      );
    }

    res.json({ mensaje: "Usuario actualizado", usuario: usuarioActualizado });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al actualizar usuario", error: error.message });
  }
};

/** DELETE /api/admin/usuarios/:id */
export const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    if (usuario._id.toString() === req.usuario._id.toString()) {
      return res
        .status(400)
        .json({ mensaje: "No puedes eliminar tu propia cuenta." });
    }

    usuario.activo = false;
    await usuario.save();

    if (usuario.rol === "doctor") {
      await Doctor.findOneAndUpdate(
        { usuario: usuario._id },
        { activo: false },
      );
    }

    res.json({ mensaje: "Usuario desactivado exitosamente." });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al eliminar usuario", error: error.message });
  }
};

/** GET /api/admin/citas */
export const listarCitasAdmin = async (req, res) => {
  try {
    const { pacienteId, doctorId, estado, fecha } = req.query;
    const filtro = {};

    if (pacienteId) filtro.paciente = pacienteId;
    if (doctorId) filtro.doctor = doctorId;
    if (estado) filtro.estado = estado;
    if (fecha) {
      const consulta = new Date(fecha);
      filtro.fecha = {
        $gte: new Date(consulta.setHours(0, 0, 0, 0)),
        $lte: new Date(consulta.setHours(23, 59, 59, 999)),
      };
    }

    const citas = await Cita.find(filtro)
      .populate("paciente", "nombre email telefono")
      .populate({
        path: "doctor",
        populate: { path: "usuario", select: "nombre email" },
      })
      .populate("especialidad")
      .sort({ fecha: -1, horaInicio: 1 });

    res.json({ citas });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al listar citas", error: error.message });
  }
};

/** GET /api/admin/citas/:id */
export const obtenerCitaAdmin = async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id)
      .populate("paciente", "nombre email telefono")
      .populate({
        path: "doctor",
        populate: { path: "usuario", select: "nombre email" },
      })
      .populate("especialidad");

    if (!cita) {
      return res.status(404).json({ mensaje: "Cita no encontrada." });
    }

    res.json({ cita });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al obtener cita", error: error.message });
  }
};

/** PUT /api/admin/citas/:id */
export const actualizarCitaAdmin = async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id);
    if (!cita) {
      return res.status(404).json({ mensaje: "Cita no encontrada." });
    }

    const { fecha, horaInicio, doctorId, especialidadId, estado } = req.body;
    const nuevaFecha = fecha ? new Date(fecha) : cita.fecha;
    const nuevaHora = horaInicio || cita.horaInicio;
    const nuevoDoctor = doctorId || cita.doctor;
    const nuevaEspecialidad = especialidadId || cita.especialidad;

    const conflicto = await Cita.findOne({
      _id: { $ne: cita._id },
      doctor: nuevoDoctor,
      fecha: {
        $gte: new Date(new Date(nuevaFecha).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(nuevaFecha).setHours(23, 59, 59, 999)),
      },
      horaInicio: nuevaHora,
      estado: "agendada",
    });

    if (conflicto) {
      return res
        .status(409)
        .json({ mensaje: "El doctor no está disponible en ese horario." });
    }

    const especialidad = await Especialidad.findById(nuevaEspecialidad);
    if (!especialidad) {
      return res.status(404).json({ mensaje: "Especialidad no encontrada." });
    }

    const [hh, mm] = nuevaHora.split(":").map(Number);
    const minutosFin = hh * 60 + mm + (especialidad.duracionMinutos || 30);
    const nuevaHoraFin = `${String(Math.floor(minutosFin / 60)).padStart(2, "0")}:${String(minutosFin % 60).padStart(2, "0")}`;

    cita.fecha = nuevaFecha;
    cita.horaInicio = nuevaHora;
    cita.horaFin = nuevaHoraFin;
    cita.doctor = nuevoDoctor;
    cita.especialidad = nuevaEspecialidad;

    if (estado) {
      if (
        !["agendada", "completada", "cancelada", "no_asistio"].includes(estado)
      ) {
        return res.status(400).json({ mensaje: "Estado inválido." });
      }
      cita.estado = estado;
    }

    await cita.save();

    const citaActualizada = await Cita.findById(cita._id)
      .populate("paciente", "nombre email telefono")
      .populate({
        path: "doctor",
        populate: { path: "usuario", select: "nombre email" },
      })
      .populate("especialidad");

    res.json({ mensaje: "Cita actualizada", cita: citaActualizada });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al actualizar cita", error: error.message });
  }
};

/** DELETE /api/admin/citas/:id */
export const eliminarCitaAdmin = async (req, res) => {
  try {
    const cita = await Cita.findByIdAndDelete(req.params.id);
    if (!cita) {
      return res.status(404).json({ mensaje: "Cita no encontrada." });
    }

    res.json({ mensaje: "Cita eliminada por el administrador.", cita });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al eliminar cita", error: error.message });
  }
};

/** Reportes */
/** GET /api/admin/reportes */
export const reportes = async (req, res) => {
  try {
    const { mes, anio } = req.query;

    const inicio = new Date(
      anio || new Date().getFullYear(),
      (mes || new Date().getMonth()) - 1,
      1,
    );
    const fin = new Date(
      inicio.getFullYear(),
      inicio.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const [totales, porEspecialidad, porEstado] = await Promise.all([
      Cita.countDocuments({ fecha: { $gte: inicio, $lte: fin } }),
      Cita.aggregate([
        { $match: { fecha: { $gte: inicio, $lte: fin } } },
        { $group: { _id: "$especialidad", total: { $sum: 1 } } },
        {
          $lookup: {
            from: "especialidads",
            localField: "_id",
            foreignField: "_id",
            as: "esp",
          },
        },
        { $unwind: "$esp" },
        { $project: { especialidad: "$esp.nombre", total: 1 } },
        { $sort: { total: -1 } },
      ]),
      Cita.aggregate([
        { $match: { fecha: { $gte: inicio, $lte: fin } } },
        { $group: { _id: "$estado", total: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      periodo: { inicio, fin },
      totalCitas: totales,
      porEspecialidad,
      porEstado,
    });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al generar reportes", error: error.message });
  }
};
