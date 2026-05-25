import nodemailer from 'nodemailer';
import dns from 'dns';
import { lookup } from 'dns/promises';

// Forzar resolución DNS a IPv4 primero
dns.setDefaultResultOrder('ipv4first');

let cachedHost = null;

const obtenerHostIPv4 = async () => {
  if (cachedHost) return cachedHost;
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  try {
    const { address } = await lookup(host, { family: 4 });
    cachedHost = address;
    console.log(`SMTP usando IPv4: ${address}`);
    return address;
  } catch (e) {
    console.error('No se pudo resolver IPv4 de SMTP:', e.message);
    return host;
  }
};

const crearTransporter = async () => {
  if(!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email no configurado. Los codigos se mostraran en consola')
    return null;
  }

  const host = await obtenerHostIPv4();
  const port = parseInt(process.env.EMAIL_PORT || '587');

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Forzar IPv4 (Render no soporta IPv6 saliente)
    family: 4,
    tls: {
      rejectUnauthorized: false,
      servername: process.env.EMAIL_HOST || 'smtp.gmail.com'
    },
    // Timeouts para evitar bloqueos prolongados
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

/** Generar codigo de 6 digitos */
const generarCodigo = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Enviar correo de verificacion de cuenta */
const enviarCodigoVerificacion = async (email, nombre, codigo) => {
  const transporter = await crearTransporter();

  const html= `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0F5132; font-size: 28px; margin: 0;">🏥 SaludYa</h1>
        <p style="color: #6B7280; font-size: 14px;">Gestión de Citas de Fisioterapia</p>
      </div>

      <div style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px; text-align: center;">
        <h2 style="color: #2D2D2D; font-size: 20px; margin-bottom: 8px;">¡Hola, ${nombre}!</h2>
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 24px;">
          Gracias por registrarte. Usa el siguiente código para verificar tu cuenta:
        </p>

        <div style="background: #F3F4F6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0F5132;">${codigo}</span>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 20px;">
          Este código expira en <strong>15 minutos</strong>.<br>
          Si no solicitaste este código, ignora este correo.
        </p>
      </div>

      <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 24px;">
        © 2026 SaludYa · Todos los derechos reservados
      </p>
    </div>
  `;

  if(!transporter) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`CÓDIGO DE VERIFICACIÓN para ${email}`);
    console.log(`Código: ${codigo}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"SaludYa" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${codigo} - Código de verificación SaludYa`,
      html
    });
    console.log(`Correo de verificación enviado a ${email}`);
    return true;
  } catch (error) {
    console.error(`Error al enviar correo: ${error.message}`);
    return false;
  }
}

/** Enviar correo de restablecimiento de contrasena */
const enviarCodigoReset = async (email, nombre, codigo) => {
  const transporter = await crearTransporter();

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0F5132; font-size: 28px; margin: 0;">🏥 SaludYa</h1>
        <p style="color: #6B7280; font-size: 14px;">Gestión de Citas de Fisioterapia</p>
      </div>

      <div style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px; text-align: center;">
        <h2 style="color: #2D2D2D; font-size: 20px; margin-bottom: 8px;">Restablecer contraseña</h2>
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 24px;">
          Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña. Usa este código:
        </p>

        <div style="background: #FEF3C7; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #92400E;">${codigo}</span>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 20px;">
          Este código expira en <strong>15 minutos</strong>.<br>
          Si no solicitaste restablecer tu contraseña, ignora este correo.<br>
          Tu cuenta permanece segura.
        </p>
      </div>

      <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 24px;">
        © 2026 SaludYa · Todos los derechos reservados
      </p>
    </div>
  `;

  if (!transporter) {
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"SaludYa" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${codigo} - Restablecer contraseña SaludYa`,
      html
    });
    console.log(`Correo de restablecimiento enviado a ${email}`);
    return true;
  } catch (error) {
    console.error(`Error al enviar correo: ${error.message}`);
    return false;
  }
};

export { enviarCodigoReset, enviarCodigoVerificacion, generarCodigo };
