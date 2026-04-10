import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generarCodigo, enviarCodigoVerificacion, enviarCodigoReset } from '../utils/email.js'

const EXPIRACION_CODIGO = 15; // minutos

const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_SECRET_IN || "2h",
  });
};

/** POST /api/auth/registro */
export const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    /** Validar que la contraseña tenga mayusculas y un numero */
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res
        .status(400)
        .json({
          mensaje:
            "La contraseña debe tener al menos una mayúscula y un número",
        });
    }

    /** Verificar si ya existe */
    const existente = await User.findOne({ email });

    if (existente) {
      /** Si existe pero no esta verificada, permite reenviar codigo */
      if(!existente.cuentaVerificada) {
        const codigo = generarCodigo();
        existente.codigoVerificacion = codigo;
        existente.codigoVerificacionExpira = new Date(Date.now() + EXPIRACION_CODIGO * 60 * 1000);
        await existente.save();

        await enviarCodigoVerificacion(email, existente.nombre, codigo);

        return res.status(200).json({
          mensaje: 'Ya existe una cuenta con este correo sin verificar. Se envió un nuevo código.',
          requiereVerificacion: true,
          email
        });
      }
      return res.status(400).json({ mensaje: "Este correo ya está registrado." });
    }

    /** Generar codigo de verificacion */
    const codigo = generarCodigo();

    /** Crear usuario No verificado */
    const usuario = await User.create({
      nombre,
      email,
      password,
      telefono,
      rol: 'paciente',
      cuentaVerificada: false,
      codigoVerificacion: codigo,
      codigoVerificacionExpira: new Date(Date.now() + EXPIRACION_CODIGO * 60 * 1000)
    });

    /** Enviar correo con codigo */
    await enviarCodigoVerificacion(email, nombre, codigo);

    res.status(201).json({
      mensjae: "Registro exitoso. Se envió un código de verificación a tu correo.",
      requiereVerificacion: true,
      email,
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error en el registro", error: error.message });
  }
};
