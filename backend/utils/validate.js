"use strict";

const { z } = require("zod");

const PERSPECTIVAS = ["financiera", "clientes", "procesos", "aprendizaje"];
const ROLES = ["Administrador", "Gerente", "Responsable"];
const DIRECCIONES = ["mayor", "menor", "rango"];
const MEDICION_ESTADOS = ["borrador", "pendiente", "aprobado", "rechazado"];

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join("; ");
    const err = new Error(msg || "Datos inválidos.");
    err.status = 400;
    throw err;
  }
  return result.data;
}

const loginSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

const registerSchema = z.object({
  nombre: z.string().min(1, "nombre es requerido."),
  apellido: z.string().optional().default(""),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  rol: z.enum(ROLES).optional().default("Responsable"),
  area: z.string().optional().default(""),
});

const objetivoSchema = z.object({
  nombre: z.string().min(1),
  perspectiva: z.enum(PERSPECTIVAS),
  descripcion: z.string().optional().default(""),
  responsable: z.string().optional().default(""),
  trabajador_id: z.string().nullable().optional(),
  prioridad: z.enum(["Alta", "Media", "Baja"]).optional().default("Media"),
  peso: z.coerce.number().min(0).max(100).optional().default(100),
  estado: z.enum(["Activo", "En revisión", "Inactivo"]).optional().default("Activo"),
});

const kpiSchema = z.object({
  nombre: z.string().min(1),
  perspectiva: z.enum(PERSPECTIVAS),
  objetivo_id: z.string().min(1),
  unidad: z.string().optional().default("%"),
  formula: z.string().optional().default(""),
  descripcion: z.string().optional().default(""),
  linea_base: z.coerce.number().nullable().optional(),
  meta: z.coerce.number().nullable().optional(),
  resultado_actual: z.coerce.number().nullable().optional(),
  direccion: z.enum(DIRECCIONES).optional().default("mayor"),
  rango_inferior: z.coerce.number().nullable().optional(),
  rango_superior: z.coerce.number().nullable().optional(),
  frecuencia: z.string().optional().default("Mensual"),
  responsable: z.string().optional().default(""),
  trabajador_id: z.string().nullable().optional(),
  area: z.string().optional().default(""),
  peso: z.coerce.number().optional().default(1),
  umbral_alerta: z.coerce.number().optional().default(80),
  umbral_critico: z.coerce.number().optional().default(60),
  estado: z.string().optional().default("Activo"),
});

const medicionSchema = z.object({
  kpi_id: z.string().min(1),
  periodo: z.string().min(1),
  fecha: z.string().min(1),
  valor: z.coerce.number(),
  responsable: z.string().optional().default(""),
  notas: z.string().optional().default(""),
  estado: z.enum(MEDICION_ESTADOS).optional().default("pendiente"),
});

module.exports = {
  z,
  parse,
  loginSchema,
  registerSchema,
  objetivoSchema,
  kpiSchema,
  medicionSchema,
  PERSPECTIVAS,
  ROLES,
  DIRECCIONES,
  MEDICION_ESTADOS,
};
