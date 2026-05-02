import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "El correo es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Formato de correo inválido"],
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [8, "La contraseña debe tener al menor 8 caracteres"],
    },
    telefono: {
      type: String,
      trim: true,
    },
    rol: {
      type: String,
      enum: ["paciente", "doctor", "admin"],
      default: "paciente",
    },
    activo: {
      type: Boolean,
      default: true,
    },

    /** Verificacion de la cuenta */
    cuentaVerificada: {
      type: Boolean,
      default: false
    },
    codigoVerificacion: {
      type: String,
      default: null
    },
    codigoVerificacionExpira: {
      type: Date,
      default: null
    },

    /** Restablecimiento de contrasena */
    codigoReset: {
      type: String,
      default: null
    },
    codigoResetExpira: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
  },
);

/** Hashear contraseña antes de guardar */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/** Comparar contraseña */
userSchema.methods.compararPassword = async function (passwordIngresada) {
  return await bcrypt.compare(passwordIngresada, this.password);
};

/** Verificar codigo de verificacion */
userSchema.methods.verificarCodigo = function(codigo) {
  if(!this.codigoVerificacion || !this.codigoVerificacionExpira) return false;
  if(new Date() > this.codigoVerificacionExpira) return false;
  return this.codigoVerificacion === codigo;
}

/** Verificar codigo reset */
userSchema.methods.verificarCodigoReset = function(codigo) {
  if(!this.codigoReset || !this.codigoResetExpira) return false;
  if(new Date() > this.codigoResetExpira) return false;
  return this.codigoReset === codigo;
}

/** No devolver contraseña en JSON */
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.codigoVerificacion;
  delete user.codigoVerificacionExpira;
  delete user.codigoReset;
  delete user.codigoResetExpira;
  return user;
};

export default mongoose.model("User", userSchema);
