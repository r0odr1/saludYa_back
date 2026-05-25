import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/** Generar código */
const generarCodigo = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/** Enviar correo de verificacion de cuenta */
const enviarCodigoVerificacion = async (email, nombre, codigo) => {
  try {
    await resend.emails.send({
      from: 'SaludYa <onboarding@resend.dev>',
      to: email,
      subject: `${codigo} - Código de verificación SaludYa`,
      html: `
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
      `,
    });

    console.log(`Correo enviado a ${email}`);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const enviarCodigoReset = async (email, nombre, codigo) => {
  try {
    await resend.emails.send({
      from: 'SaludYa <onboarding@resend.dev>',
      to: email,
      subject: `${codigo} - Reset SaludYa`,
      html: `
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
      `,
    });

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export {
  enviarCodigoReset,
  enviarCodigoVerificacion,
  generarCodigo,
};