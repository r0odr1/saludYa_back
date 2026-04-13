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

/** Verificar cuenta, Valida el codigo de 6 digitos */
/** POST /api/auth/verificar-cuenta */
export const verificarCuenta = async (req, res) => {
  try {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      return res.status(400).json({ mensaje: 'Email y código son obligatorios.' });
    }

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    if (usuario.cuentaVerificada) {
      return res.status(400).json({ mensaje: 'Esta cuenta ya está verificada.' });
    }

    /** Verificar si el código expiró */
    if (!usuario.codigoVerificacionExpira || new Date() > usuario.codigoVerificacionExpira) {
      return res.status(400).json({
        mensaje: 'El código ha expirado. Solicita uno nuevo.',
        codigoExpirado: true
      });
    }

    /** Verificar código */
    if (!usuario.verificarCodigo(codigo)) {
      return res.status(400).json({ mensaje: 'Código incorrecto. Intenta de nuevo.' });
    }

    /** Activar cuenta */
    usuario.cuentaVerificada = true;
    usuario.codigoVerificacion = null;
    usuario.codigoVerificacionExpira = null;
    await usuario.save();

    /** Generar token para login automático */
    const token = generarToken(usuario._id);

    res.json({
      mensaje: 'Cuenta verificada exitosamente. ¡Bienvenido!',
      token,
      usuario
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar cuenta', error: error.message });
  }
};

/** Reenviar codigo de verificacion */
/** POST /api/auth/reenviar-codigo */
// ============================================================
export const reenviarCodigo = async (req, res) => {
  try {
    const { email } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    if (usuario.cuentaVerificada) {
      return res.status(400).json({ mensaje: 'Esta cuenta ya está verificada.' });
    }

    /** Generar nuevo código */
    const codigo = generarCodigo();
    usuario.codigoVerificacion = codigo;
    usuario.codigoVerificacionExpira = new Date(Date.now() + EXPIRACION_CODIGO * 60 * 1000);
    await usuario.save();

    await enviarCodigoVerificacion(email, usuario.nombre, codigo);

    res.json({
      mensaje: 'Nuevo código enviado a tu correo.',
      email
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al reenviar código', error: error.message });
  }
};

/** Login, Verifica credenciales y que la cuente este verificada */
/** POST /api/auth/login */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
    }

    const passwordCorrecta = await usuario.compararPassword(password);
    if (!passwordCorrecta) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ mensaje: 'Cuenta desactivada. Contacte al administrador.' });
    }

    /** Verificar si la cuenta está verificada */
    if (!usuario.cuentaVerificada) {
      /** Enviar nuevo código automáticamente */
      const codigo = generarCodigo();
      usuario.codigoVerificacion = codigo;
      usuario.codigoVerificacionExpira = new Date(Date.now() + EXPIRACION_CODIGO * 60 * 1000);
      await usuario.save();

      await enviarCodigoVerificacion(email, usuario.nombre, codigo);

      return res.status(403).json({
        mensaje: 'Tu cuenta no está verificada. Se envió un nuevo código a tu correo.',
        requiereVerificacion: true,
        email
      });
    }

    const token = generarToken(usuario._id);

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
  }
};

/** Solicitar reestablecimiento de contrasena */
/** POST /api/auth/solicitar-reset */
export const solicitarReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ mensaje: 'El correo es obligatorio.' });
    }

    const usuario = await User.findOne({ email });

    /** Por seguridad, siempre respondemos igual, no revelar si el correo existe */
    if (!usuario) {
      return res.json({
        mensaje: 'Si el correo está registrado, recibirás un código de restablecimiento.'
      });
    }

    /** Generar código de reset */
    const codigo = generarCodigo();
    usuario.codigoReset = codigo;
    usuario.codigoResetExpira = new Date(Date.now() + EXPIRACION_CODIGO * 60 * 1000);
    await usuario.save();

    await enviarCodigoReset(email, usuario.nombre, codigo);

    res.json({
      mensaje: 'Si el correo está registrado, recibirás un código de restablecimiento.',
      email
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al solicitar restablecimiento', error: error.message });
  }
};

/** Verificar codigo reset */
/** POST /api/auth/verificar-reset */
export const verificarReset = async (req, res) => {
  try {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      return res.status(400).json({ mensaje: 'Email y código son obligatorios.' });
    }

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ mensaje: 'Código inválido.' });
    }

    /** Verificar si expiró */
    if (!usuario.codigoResetExpira || new Date() > usuario.codigoResetExpira) {
      return res.status(400).json({
        mensaje: 'El código ha expirado. Solicita uno nuevo.',
        codigoExpirado: true
      });
    }

    /** Verificar código */
    if (!usuario.verificarCodigoReset(codigo)) {
      return res.status(400).json({ mensaje: 'Código incorrecto.' });
    }

    /** Generar un token temporal para el cambio de contraseña */
    const resetToken = jwt.sign(
      { id: usuario._id, tipo: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({
      mensaje: 'Código verificado. Ahora puedes establecer tu nueva contraseña.',
      resetToken
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar código', error: error.message });
  }
};

/** Nueva Contrasena, establece la contrasena despues del reset */
/** POST /api/auth/nueva-contrasena */
export const nuevaContrasena = async (req, res) => {
  try {
    const { resetToken, nuevaPassword } = req.body;

    if (!resetToken || !nuevaPassword) {
      return res.status(400).json({ mensaje: 'Token y nueva contraseña son obligatorios.' });
    }

    /** Validar contraseña */
    if (nuevaPassword.length < 8 || !/[A-Z]/.test(nuevaPassword) || !/[0-9]/.test(nuevaPassword)) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.'
      });
    }

    /** Verificar token de reset */
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ mensaje: 'Token inválido o expirado. Solicita un nuevo código.' });
    }

    if (decoded.tipo !== 'reset') {
      return res.status(400).json({ mensaje: 'Token inválido.' });
    }

    const usuario = await User.findById(decoded.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    /** Cambiar contraseña y limpiar códigos */
    usuario.password = nuevaPassword;
    usuario.codigoReset = null;
    usuario.codigoResetExpira = null;
    await usuario.save();

    res.json({
      mensaje: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.'
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar contraseña', error: error.message });
  }
};

/** Perfil */

/** GET /api/auth/perfil */
export const perfil = async (req, res) => {
  try {
    res.json({ usuario: req.usuario });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener perfil' });
  }
};

/** PUT /api/auth/perfil */
export const actualizarPerfil = async (req, res) => {
  try {
    const { nombre, telefono } = req.body;
    const usuario = await User.findByIdAndUpdate(
      req.usuario._id,
      { nombre, telefono },
      { new: true, runValidators: true }
    );
    res.json({ mensaje: 'Perfil actualizado', usuario });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar perfil', error: error.message });
  }
};

/** Cambiar contrasena, usuario autenticado */
/** PUT /api/auth/cambiar-contrasena */
export const cambiarContrasena = async (req, res) => {
  try {
    const { contrasenaActual, nuevaContrasena } = req.body;

    if (!contrasenaActual || !nuevaContrasena) {
      return res.status(400).json({ mensaje: 'Contraseña actual y nueva son obligatorias.' });
    }

    if (nuevaContrasena.length < 8 || !/[A-Z]/.test(nuevaContrasena) || !/[0-9]/.test(nuevaContrasena)) {
      return res.status(400).json({
        mensaje: 'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número.'
      });
    }

    const usuario = await User.findById(req.usuario._id);

    const passwordCorrecta = await usuario.compararPassword(contrasenaActual);
    if (!passwordCorrecta) {
      return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta.' });
    }

    usuario.password = nuevaContrasena;
    await usuario.save();

    res.json({ mensaje: 'Contraseña cambiada exitosamente.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar contraseña', error: error.message });
  }
};
