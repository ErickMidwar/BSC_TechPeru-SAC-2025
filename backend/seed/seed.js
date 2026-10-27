"use strict";

/**
 * Seed script — populates the database with initial demo data.
 * Run: node seed/seed.js  (from inside the backend/ folder)
 * Safe to re-run: checks if data already exists before inserting.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const bcrypt = require("bcryptjs");
const db = require("../config/database");

// ── helpers ──────────────────────────────────────────────────────────────────
function uid(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 9999);
}

function run(msg, fn) {
  try {
    fn();
    console.log("  ✓", msg);
  } catch (e) {
    console.error("  ✗", msg, "→", e.message);
  }
}

// ── check if already seeded ───────────────────────────────────────────────────
function seed() {
const alreadySeeded = db.prepare("SELECT COUNT(*) as c FROM users").get().c > 0;
if (alreadySeeded) {
  console.log("La base de datos ya contiene datos. Seed omitido.");
  return { skipped: true };
}

console.log("\n🌱  Iniciando seed de datos para BSC TechPeru SAC...\n");

// ── 1. USERS ─────────────────────────────────────────────────────────────────
const insertUser = db.prepare(`
  INSERT INTO users (id, nombre, apellido, email, password, rol, area, activo)
  VALUES (@id, @nombre, @apellido, @email, @password, @rol, @area, @activo)
`);

const seedUsers = [
  { id: "u1", nombre: "Ana",    apellido: "Pérez",   email: "admin@techperu.com",       password: "admin123",   rol: "Administrador", area: "Gerencia General" },
  { id: "u2", nombre: "Carlos", apellido: "Ruiz",    email: "carlos.ruiz@techperu.com",  password: "BSC2026!",   rol: "Gerente",       area: "Gerencia Comercial" },
  { id: "u3", nombre: "María",  apellido: "Torres",  email: "maria.torres@techperu.com", password: "BSC2026!",   rol: "Responsable",   area: "Operaciones" },
  { id: "u4", nombre: "Luis",   apellido: "Quispe",  email: "luis.quispe@techperu.com",  password: "BSC2026!",   rol: "Responsable",   area: "Finanzas" },
  { id: "u5", nombre: "Rosa",   apellido: "Medina",  email: "rosa.medina@techperu.com",  password: "BSC2026!",   rol: "Gerente",       area: "Gestión de Personas" },
];

run("Usuarios del sistema", () => {
  const insertMany = db.transaction((rows) => {
    for (const u of rows) {
      insertUser.run({ ...u, password: bcrypt.hashSync(u.password, 10), activo: 1 });
    }
  });
  insertMany(seedUsers);
});

// ── 2. TRABAJADORES ──────────────────────────────────────────────────────────
const insertTrabajador = db.prepare(`
  INSERT INTO trabajadores (id, dni, nombre, apellido, cargo, area, email, telefono, activo)
  VALUES (@id, @dni, @nombre, @apellido, @cargo, @area, @email, @telefono, @activo)
`);

const seedTrabajadores = [
  { id: "t1",  dni: "10011001", nombre: "Ana",      apellido: "Pérez",     cargo: "Gerente General",            area: "Gerencia General",    email: "ana.perez@techperu.com",      telefono: "987000001" },
  { id: "t2",  dni: "10022002", nombre: "Carlos",   apellido: "Ruiz",      cargo: "Gerente Comercial",           area: "Comercial",           email: "carlos.ruiz@techperu.com",    telefono: "987000002" },
  { id: "t3",  dni: "10033003", nombre: "María",    apellido: "Torres",    cargo: "Jefa de Operaciones",         area: "Operaciones",         email: "maria.torres@techperu.com",   telefono: "987000003" },
  { id: "t4",  dni: "10044004", nombre: "Luis",     apellido: "Quispe",    cargo: "Analista Financiero",         area: "Finanzas",            email: "luis.quispe@techperu.com",    telefono: "987000004" },
  { id: "t5",  dni: "10055005", nombre: "Rosa",     apellido: "Medina",    cargo: "Gerente de Personas",         area: "Gestión de Personas", email: "rosa.medina@techperu.com",    telefono: "987000005" },
  { id: "t6",  dni: "10066006", nombre: "Jorge",    apellido: "Chávez",    cargo: "Especialista TI",             area: "TI",                  email: "jorge.chavez@techperu.com",   telefono: "987000006" },
  { id: "t7",  dni: "10077007", nombre: "Patricia", apellido: "Flores",    cargo: "Analista de Calidad",         area: "Operaciones",         email: "patricia.flores@techperu.com",telefono: "987000007" },
  { id: "t8",  dni: "10088008", nombre: "Roberto",  apellido: "Sánchez",   cargo: "Supervisor de Despacho",      area: "Logística",           email: "roberto.sanchez@techperu.com",telefono: "987000008" },
  { id: "t9",  dni: "10099009", nombre: "Diana",    apellido: "Huamán",    cargo: "Coordinadora Comercial",      area: "Comercial",           email: "diana.huaman@techperu.com",   telefono: "987000009" },
  { id: "t10", dni: "10101010", nombre: "Marco",    apellido: "Villanueva",cargo: "Analista de Innovación",      area: "TI",                  email: "marco.villa@techperu.com",    telefono: "987000010" },
  { id: "t11", dni: "10111011", nombre: "Sofía",    apellido: "Castillo",  cargo: "Asistente de RRHH",           area: "Gestión de Personas", email: "sofia.castillo@techperu.com", telefono: "987000011" },
  { id: "t12", dni: "10121012", nombre: "Eduardo",  apellido: "Paredes",   cargo: "Contador Senior",             area: "Finanzas",            email: "eduardo.paredes@techperu.com",telefono: "987000012" },
];

run("Trabajadores", () => {
  const insertMany = db.transaction((rows) => {
    for (const t of rows) insertTrabajador.run({ ...t, activo: 1 });
  });
  insertMany(seedTrabajadores);
});

// ── 3. OBJETIVOS ─────────────────────────────────────────────────────────────
const insertObjetivo = db.prepare(`
  INSERT INTO objetivos (id, nombre, perspectiva, descripcion, responsable, trabajador_id, prioridad, peso, estado)
  VALUES (@id, @nombre, @perspectiva, @descripcion, @responsable, @trabajador_id, @prioridad, @peso, @estado)
`);

const seedObjetivos = [
  { id:"OBJ-01", nombre:"Incrementar la rentabilidad",            perspectiva:"financiera", descripcion:"Mejorar el retorno del capital y la generación de valor.",            responsable:"Ana Pérez",    trabajador_id:"t1",  prioridad:"Alta",  peso:100, estado:"Activo" },
  { id:"OBJ-02", nombre:"Optimizar costos operativos",            perspectiva:"financiera", descripcion:"Elevar la eficiencia de gastos y uso de recursos.",                   responsable:"Luis Quispe",  trabajador_id:"t4",  prioridad:"Alta",  peso:90,  estado:"Activo" },
  { id:"OBJ-03", nombre:"Aumentar ingresos rentables",            perspectiva:"financiera", descripcion:"Crecer en ventas priorizando margen y retención.",                    responsable:"Carlos Ruiz",  trabajador_id:"t2",  prioridad:"Alta",  peso:80,  estado:"Activo" },
  { id:"OBJ-04", nombre:"Mejorar la satisfacción del cliente",    perspectiva:"clientes",   descripcion:"Ofrecer una experiencia consistente y confiable.",                    responsable:"Carlos Ruiz",  trabajador_id:"t2",  prioridad:"Alta",  peso:100, estado:"Activo" },
  { id:"OBJ-05", nombre:"Incrementar la fidelidad de clientes",   perspectiva:"clientes",   descripcion:"Fortalecer la recompra y las relaciones comerciales.",                responsable:"Carlos Ruiz",  trabajador_id:"t9",  prioridad:"Media", peso:80,  estado:"Activo" },
  { id:"OBJ-06", nombre:"Ampliar la participación de mercado",    perspectiva:"clientes",   descripcion:"Aumentar presencia en segmentos prioritarios.",                       responsable:"Ana Pérez",    trabajador_id:"t1",  prioridad:"Media", peso:75,  estado:"Activo" },
  { id:"OBJ-07", nombre:"Mejorar la eficiencia operativa",        perspectiva:"procesos",   descripcion:"Reducir tiempos, reprocesos y desperdicio.",                          responsable:"María Torres", trabajador_id:"t3",  prioridad:"Alta",  peso:90,  estado:"Activo" },
  { id:"OBJ-08", nombre:"Garantizar calidad del servicio",        perspectiva:"procesos",   descripcion:"Estandarizar atención y cumplimiento de compromisos.",                responsable:"María Torres", trabajador_id:"t7",  prioridad:"Alta",  peso:90,  estado:"Activo" },
  { id:"OBJ-09", nombre:"Fortalecer abastecimiento",              perspectiva:"procesos",   descripcion:"Asegurar disponibilidad y entrega oportuna.",                         responsable:"María Torres", trabajador_id:"t8",  prioridad:"Media", peso:70,  estado:"Activo" },
  { id:"OBJ-10", nombre:"Desarrollar competencias del personal",  perspectiva:"aprendizaje",descripcion:"Alinear capacidades técnicas y comerciales con la estrategia.",       responsable:"Rosa Medina",  trabajador_id:"t5",  prioridad:"Alta",  peso:80,  estado:"Activo" },
  { id:"OBJ-11", nombre:"Impulsar cultura de mejora continua",    perspectiva:"aprendizaje",descripcion:"Promover innovación, colaboración y resolución de problemas.",        responsable:"Rosa Medina",  trabajador_id:"t5",  prioridad:"Media", peso:75,  estado:"Activo" },
  { id:"OBJ-12", nombre:"Mejorar la gestión de información",      perspectiva:"aprendizaje",descripcion:"Usar datos oportunos y confiables para decidir.",                     responsable:"Ana Pérez",    trabajador_id:"t6",  prioridad:"Media", peso:80,  estado:"Activo" },
];

run("Objetivos estratégicos (12)", () => {
  const insertMany = db.transaction((rows) => {
    for (const o of rows) insertObjetivo.run(o);
  });
  insertMany(seedObjetivos);
});

// ── 3b. RELACIONES CAUSA-EFECTO ───────────────────────────────────────────────
const insertRel = db.prepare(`
  INSERT INTO objetivo_relaciones (id, from_id, to_id, descripcion)
  VALUES (@id, @from_id, @to_id, @descripcion)
`);

const seedRelaciones = [
  { id: "REL-01", from_id: "OBJ-10", to_id: "OBJ-07", descripcion: "Competencias → eficiencia operativa" },
  { id: "REL-02", from_id: "OBJ-11", to_id: "OBJ-08", descripcion: "Mejora continua → calidad" },
  { id: "REL-03", from_id: "OBJ-12", to_id: "OBJ-07", descripcion: "Datos oportunos → eficiencia" },
  { id: "REL-04", from_id: "OBJ-07", to_id: "OBJ-04", descripcion: "Eficiencia → satisfacción" },
  { id: "REL-05", from_id: "OBJ-08", to_id: "OBJ-04", descripcion: "Calidad → satisfacción" },
  { id: "REL-06", from_id: "OBJ-09", to_id: "OBJ-04", descripcion: "Abastecimiento → satisfacción" },
  { id: "REL-07", from_id: "OBJ-04", to_id: "OBJ-05", descripcion: "Satisfacción → fidelidad" },
  { id: "REL-08", from_id: "OBJ-05", to_id: "OBJ-03", descripcion: "Fidelidad → ingresos" },
  { id: "REL-09", from_id: "OBJ-06", to_id: "OBJ-03", descripcion: "Participación → ingresos" },
  { id: "REL-10", from_id: "OBJ-03", to_id: "OBJ-01", descripcion: "Ingresos → rentabilidad" },
  { id: "REL-11", from_id: "OBJ-02", to_id: "OBJ-01", descripcion: "Costos → rentabilidad" },
];

run("Relaciones causa-efecto (11)", () => {
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertRel.run(r);
  });
  insertMany(seedRelaciones);
});

// ── 4. KPIs ──────────────────────────────────────────────────────────────────
const insertKpi = db.prepare(`
  INSERT INTO kpis (id, nombre, perspectiva, objetivo_id, unidad, formula, descripcion,
    linea_base, meta, resultado_actual, direccion, rango_inferior, rango_superior,
    frecuencia, responsable, trabajador_id, area, peso, umbral_alerta, umbral_critico, estado)
  VALUES (@id, @nombre, @perspectiva, @objetivo_id, @unidad, @formula, @descripcion,
    @linea_base, @meta, @resultado_actual, @direccion, @rango_inferior, @rango_superior,
    @frecuencia, @responsable, @trabajador_id, @area, @peso, @umbral_alerta, @umbral_critico, @estado)
`);

const baseKpi = { descripcion: "Indicador de seguimiento estratégico para TechPeru SAC.", rango_inferior: null, rango_superior: null, umbral_alerta: 80, umbral_critico: 60, estado: "Activo" };

const seedKpis = [
  { id:"KPI-01", nombre:"ROCE (rentabilidad)",                  perspectiva:"financiera",   objetivo_id:"OBJ-01", unidad:"%",          formula:"Resultado operativo / capital empleado × 100", linea_base:12,  meta:13,  resultado_actual:12.4,  direccion:"mayor",  frecuencia:"Trimestral", responsable:"Ana Pérez",    trabajador_id:"t1",  area:"Finanzas",           peso:5 },
  { id:"KPI-02", nombre:"Costo operativo por unidad",          perspectiva:"financiera",   objetivo_id:"OBJ-02", unidad:"S/ por unidad",formula:"Costos operativos / unidades procesadas",       linea_base:48,  meta:44,  resultado_actual:46.2,  direccion:"menor",  frecuencia:"Mensual",    responsable:"Luis Quispe",  trabajador_id:"t4",  area:"Finanzas",           peso:5 },
  { id:"KPI-03", nombre:"Crecimiento de ventas rentables",     perspectiva:"financiera",   objetivo_id:"OBJ-03", unidad:"%",          formula:"(Ventas actuales - ventas previas) / ventas previas × 100", linea_base:6, meta:10, resultado_actual:7.2, direccion:"mayor", frecuencia:"Mensual", responsable:"Carlos Ruiz", trabajador_id:"t2", area:"Comercial", peso:5 },
  { id:"KPI-04", nombre:"Satisfacción del cliente",            perspectiva:"clientes",     objetivo_id:"OBJ-04", unidad:"Puntos/100", formula:"Promedio de encuesta de satisfacción",           linea_base:78,  meta:90,  resultado_actual:84,    direccion:"mayor",  frecuencia:"Trimestral", responsable:"Carlos Ruiz",  trabajador_id:"t9",  area:"Comercial",          peso:5 },
  { id:"KPI-05", nombre:"Retención de clientes",               perspectiva:"clientes",     objetivo_id:"OBJ-05", unidad:"%",          formula:"Clientes retenidos / clientes al inicio × 100",  linea_base:78,  meta:85,  resultado_actual:82,    direccion:"mayor",  frecuencia:"Trimestral", responsable:"Carlos Ruiz",  trabajador_id:"t2",  area:"Comercial",          peso:5 },
  { id:"KPI-06", nombre:"Participación en mercado objetivo",   perspectiva:"clientes",     objetivo_id:"OBJ-06", unidad:"%",          formula:"Ventas propias / ventas estimadas del segmento × 100", linea_base:18, meta:22, resultado_actual:20, direccion:"mayor", frecuencia:"Trimestral", responsable:"Carlos Ruiz", trabajador_id:"t2", area:"Comercial", peso:5 },
  { id:"KPI-07", nombre:"Tiempo de ciclo del pedido",          perspectiva:"procesos",     objetivo_id:"OBJ-07", unidad:"Horas",      formula:"Hora de entrega - hora de pedido",               linea_base:36,  meta:24,  resultado_actual:28,    direccion:"menor",  frecuencia:"Mensual",    responsable:"María Torres", trabajador_id:"t8",  area:"Operaciones",        peso:5 },
  { id:"KPI-08", nombre:"Entregas completas y a tiempo",       perspectiva:"procesos",     objetivo_id:"OBJ-09", unidad:"%",          formula:"Pedidos completos y puntuales / total × 100",    linea_base:90,  meta:97,  resultado_actual:94,    direccion:"mayor",  frecuencia:"Mensual",    responsable:"María Torres", trabajador_id:"t8",  area:"Operaciones",        peso:5 },
  { id:"KPI-09", nombre:"Tasa de errores operativos",          perspectiva:"procesos",     objetivo_id:"OBJ-08", unidad:"%",          formula:"Errores identificados / operaciones × 100",      linea_base:4,   meta:2,   resultado_actual:2.7,   direccion:"menor",  frecuencia:"Mensual",    responsable:"María Torres", trabajador_id:"t7",  area:"Operaciones",        peso:5 },
  { id:"KPI-10", nombre:"Horas de capacitación por persona",   perspectiva:"aprendizaje",  objetivo_id:"OBJ-10", unidad:"Horas/año",  formula:"Horas de formación completadas por trabajador",   linea_base:16,  meta:40,  resultado_actual:28,    direccion:"mayor",  frecuencia:"Trimestral", responsable:"Rosa Medina",  trabajador_id:"t5",  area:"Gestión de Personas",peso:5 },
  { id:"KPI-11", nombre:"Clima laboral",                       perspectiva:"aprendizaje",  objetivo_id:"OBJ-11", unidad:"Puntos/100", formula:"Resultado de encuesta interna de clima",          linea_base:72,  meta:82,  resultado_actual:78,    direccion:"mayor",  frecuencia:"Semestral",  responsable:"Rosa Medina",  trabajador_id:"t11", area:"Gestión de Personas",peso:5 },
  { id:"KPI-12", nombre:"Disponibilidad de reportes críticos", perspectiva:"aprendizaje",  objetivo_id:"OBJ-12", unidad:"%",          formula:"Reportes disponibles a tiempo / reportes críticos × 100", linea_base:80, meta:98, resultado_actual:92, direccion:"mayor", frecuencia:"Mensual", responsable:"Ana Pérez", trabajador_id:"t6", area:"TI", peso:5 },
  { id:"KPI-13", nombre:"Incidentes de seguridad",             perspectiva:"procesos",     objetivo_id:"OBJ-08", unidad:"Incidentes", formula:"Número de incidentes registrables en el período", linea_base:5,   meta:2,   resultado_actual:3,     direccion:"menor",  frecuencia:"Mensual",    responsable:"María Torres", trabajador_id:"t3",  area:"Operaciones",        peso:5 },
  { id:"KPI-14", nombre:"Uso de herramientas digitales",       perspectiva:"aprendizaje",  objetivo_id:"OBJ-12", unidad:"%",          formula:"Usuarios activos / usuarios objetivo × 100",      linea_base:52,  meta:80,  resultado_actual:null,  direccion:"mayor",  frecuencia:"Mensual",    responsable:"Ana Pérez",    trabajador_id:"t10", area:"TI",                 peso:5 },
  { id:"KPI-15", nombre:"Valor promedio por cliente",          perspectiva:"clientes",     objetivo_id:"OBJ-05", unidad:"S/",         formula:"Ingresos / clientes activos",                    linea_base:180, meta:220, resultado_actual:205,   direccion:"mayor",  frecuencia:"Mensual",    responsable:"Carlos Ruiz",  trabajador_id:"t9",  area:"Comercial",          peso:5 },
  { id:"KPI-16", nombre:"Días de cuentas por cobrar",          perspectiva:"financiera",   objetivo_id:"OBJ-02", unidad:"Días",       formula:"Cuentas por cobrar / ventas diarias",            linea_base:42,  meta:30,  resultado_actual:34,    direccion:"menor",  frecuencia:"Mensual",    responsable:"Luis Quispe",  trabajador_id:"t12", area:"Finanzas",           peso:5 },
].map(k => ({ ...baseKpi, ...k }));

run("KPIs (16)", () => {
  const insertMany = db.transaction((rows) => {
    for (const k of rows) insertKpi.run(k);
  });
  insertMany(seedKpis);
});

// ── 5. MEDICIONES (últimos 6 meses simulados) ─────────────────────────────────
const insertMedicion = db.prepare(`
  INSERT INTO mediciones (id, kpi_id, periodo, fecha, valor, responsable, notas, estado)
  VALUES (@id, @kpi_id, @periodo, @fecha, @valor, @responsable, @notas, @estado)
`);

run("Mediciones históricas (6 meses × 15 KPI con datos)", () => {
  const months = [
    { periodo: "2026-01", dia: "28" }, { periodo: "2026-02", dia: "27" },
    { periodo: "2026-03", dia: "29" }, { periodo: "2026-04", dia: "28" },
    { periodo: "2026-05", dia: "29" }, { periodo: "2026-06", dia: "30" },
  ];

  const insertMany = db.transaction(() => {
    for (const kpi of seedKpis) {
      if (kpi.resultado_actual === null) continue;
      const base = kpi.linea_base;
      const curr = kpi.resultado_actual;

      months.forEach((m, idx) => {
        const progress = (idx + 1) / 6;
        let v;
        if (kpi.direccion === "menor") {
          v = +(base - (base - curr) * progress + (idx % 2 ? 0.2 : -0.1)).toFixed(2);
        } else {
          v = +(base + (curr - base) * progress + (idx % 2 ? 0.3 : -0.2)).toFixed(2);
        }
        if (idx === 5) v = curr;

        insertMedicion.run({
          id: `M-${kpi.id}-${m.periodo}`,
          kpi_id: kpi.id,
          periodo: m.periodo,
          fecha: `${m.periodo}-${m.dia}`,
          valor: v,
          responsable: kpi.responsable,
          notas: idx === 5 ? "Cierre de período de demostración" : "Medición histórica simulada",
          estado: "aprobado",
        });
      });
    }
  });
  insertMany();
});

// ── 6. RECURSOS ───────────────────────────────────────────────────────────────
const insertRecurso = db.prepare(`
  INSERT INTO recursos (id, nombre, tipo, descripcion, monto_total, moneda, estado)
  VALUES (@id, @nombre, @tipo, @descripcion, @monto_total, @moneda, @estado)
`);

const seedRecursos = [
  { id:"REC-01", nombre:"Presupuesto Comercial 2026",     tipo:"Financiero",  descripcion:"Fondo para iniciativas del área comercial.",           monto_total:120000, moneda:"PEN", estado:"Disponible" },
  { id:"REC-02", nombre:"Presupuesto Operaciones 2026",   tipo:"Financiero",  descripcion:"Fondo para mejoras operativas.",                       monto_total: 85000, moneda:"PEN", estado:"Disponible" },
  { id:"REC-03", nombre:"Presupuesto TI 2026",            tipo:"Financiero",  descripcion:"Fondo para proyectos tecnológicos.",                   monto_total: 95000, moneda:"PEN", estado:"Disponible" },
  { id:"REC-04", nombre:"Presupuesto Personas 2026",      tipo:"Financiero",  descripcion:"Fondo para capacitación y desarrollo.",                monto_total: 40000, moneda:"PEN", estado:"Disponible" },
  { id:"REC-05", nombre:"Licencia CRM Salesforce",        tipo:"Software",    descripcion:"Licencias anuales para el equipo comercial.",          monto_total:  8500, moneda:"PEN", estado:"Disponible" },
  { id:"REC-06", nombre:"Laptops para campo",             tipo:"Equipo",      descripcion:"Equipos portátiles para representantes de ventas.",    monto_total: 18000, moneda:"PEN", estado:"Disponible" },
  { id:"REC-07", nombre:"Plataforma e-learning",          tipo:"Software",    descripcion:"Acceso a plataforma de capacitación en línea.",        monto_total:  5000, moneda:"PEN", estado:"Disponible" },
  { id:"REC-08", nombre:"Servidor de Reportes BI",        tipo:"Equipo",      descripcion:"Servidor dedicado para el tablero de inteligencia.",   monto_total: 22000, moneda:"PEN", estado:"Disponible" },
];

run("Recursos (8)", () => {
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertRecurso.run(r);
  });
  insertMany(seedRecursos);
});

// ── 7. INICIATIVAS ────────────────────────────────────────────────────────────
const insertIniciativa = db.prepare(`
  INSERT INTO iniciativas (id, nombre, objetivo_id, kpi_id, responsable, trabajador_id, area,
    fecha_inicio, fecha_fin, presupuesto, ejecutado, avance, estado, descripcion)
  VALUES (@id, @nombre, @objetivo_id, @kpi_id, @responsable, @trabajador_id, @area,
    @fecha_inicio, @fecha_fin, @presupuesto, @ejecutado, @avance, @estado, @descripcion)
`);

const seedIniciativas = [
  { id:"INI-01", nombre:"Implementar CRM comercial",           objetivo_id:"OBJ-04", kpi_id:"KPI-04", responsable:"Carlos Ruiz",  trabajador_id:"t2",  area:"Comercial",           fecha_inicio:"2026-01-01", fecha_fin:"2026-06-30", presupuesto:42000, ejecutado:33600, avance:80,  estado:"En ejecución", descripcion:"Implementar CRM y estandarizar el seguimiento de clientes." },
  { id:"INI-02", nombre:"Programa de eficiencia operativa",    objetivo_id:"OBJ-02", kpi_id:"KPI-02", responsable:"Luis Quispe",  trabajador_id:"t4",  area:"Finanzas",            fecha_inicio:"2026-02-01", fecha_fin:"2026-09-30", presupuesto:30000, ejecutado:15000, avance:50,  estado:"En ejecución", descripcion:"Identificar costos evitables y optimizar procesos de soporte." },
  { id:"INI-03", nombre:"Mejora de procesos de entrega",       objetivo_id:"OBJ-09", kpi_id:"KPI-08", responsable:"María Torres", trabajador_id:"t8",  area:"Operaciones",         fecha_inicio:"2026-02-01", fecha_fin:"2026-08-31", presupuesto:28000, ejecutado:18200, avance:65,  estado:"En ejecución", descripcion:"Reducir errores de preparación y retrasos en despacho." },
  { id:"INI-04", nombre:"Academia de servicio al cliente",     objetivo_id:"OBJ-10", kpi_id:"KPI-10", responsable:"Rosa Medina",  trabajador_id:"t5",  area:"Gestión de Personas", fecha_inicio:"2026-01-15", fecha_fin:"2026-12-15", presupuesto:18000, ejecutado: 9900, avance:55,  estado:"En ejecución", descripcion:"Desarrollar habilidades de atención y venta consultiva." },
  { id:"INI-05", nombre:"Tablero de inteligencia de negocios", objetivo_id:"OBJ-12", kpi_id:"KPI-12", responsable:"Ana Pérez",    trabajador_id:"t6",  area:"TI",                  fecha_inicio:"2026-03-01", fecha_fin:"2026-07-31", presupuesto:52000, ejecutado:18200, avance:35,  estado:"En ejecución", descripcion:"Integrar reportes comerciales, financieros y operativos." },
  { id:"INI-06", nombre:"Plan de fidelización de clientes",    objetivo_id:"OBJ-05", kpi_id:"KPI-05", responsable:"Carlos Ruiz",  trabajador_id:"t9",  area:"Comercial",           fecha_inicio:"2026-04-01", fecha_fin:"2026-10-31", presupuesto:25000, ejecutado: 5000, avance:20,  estado:"En ejecución", descripcion:"Diseñar beneficios por frecuencia de compra y permanencia." },
  { id:"INI-07", nombre:"Mantenimiento preventivo 2026",       objetivo_id:"OBJ-07", kpi_id:"KPI-07", responsable:"María Torres", trabajador_id:"t3",  area:"Operaciones",         fecha_inicio:"2026-01-01", fecha_fin:"2026-05-31", presupuesto:15000, ejecutado:15000, avance:100, estado:"Finalizada",   descripcion:"Estandarizar rutinas de mantenimiento y checklists." },
  { id:"INI-08", nombre:"Ruta de adopción digital",            objetivo_id:"OBJ-12", kpi_id:"KPI-14", responsable:"Ana Pérez",    trabajador_id:"t10", area:"TI",                  fecha_inicio:"2026-06-01", fecha_fin:"2026-12-20", presupuesto:36000, ejecutado: 3600, avance:10,  estado:"Planificada",  descripcion:"Acompañar a las áreas en el uso de herramientas digitales." },
];

run("Iniciativas estratégicas (8)", () => {
  const insertMany = db.transaction((rows) => {
    for (const i of rows) insertIniciativa.run(i);
  });
  insertMany(seedIniciativas);
});

// ── 8. ASIGNACIONES DE RECURSOS ───────────────────────────────────────────────
const insertAsignacion = db.prepare(`
  INSERT INTO recurso_asignaciones (id, iniciativa_id, recurso_id, monto_asignado, monto_ejecutado, notas)
  VALUES (@id, @iniciativa_id, @recurso_id, @monto_asignado, @monto_ejecutado, @notas)
`);

const seedAsignaciones = [
  { id:"ASG-01", iniciativa_id:"INI-01", recurso_id:"REC-01", monto_asignado:42000, monto_ejecutado:33600, notas:"Presupuesto asignado para CRM" },
  { id:"ASG-02", iniciativa_id:"INI-01", recurso_id:"REC-05", monto_asignado: 8500, monto_ejecutado: 8500, notas:"Licencias Salesforce activadas" },
  { id:"ASG-03", iniciativa_id:"INI-02", recurso_id:"REC-02", monto_asignado:30000, monto_ejecutado:15000, notas:"Eficiencia operativa - fase 1" },
  { id:"ASG-04", iniciativa_id:"INI-03", recurso_id:"REC-02", monto_asignado:28000, monto_ejecutado:18200, notas:"Mejora de procesos logísticos" },
  { id:"ASG-05", iniciativa_id:"INI-04", recurso_id:"REC-04", monto_asignado:18000, monto_ejecutado: 9900, notas:"Academia de servicio" },
  { id:"ASG-06", iniciativa_id:"INI-04", recurso_id:"REC-07", monto_asignado: 5000, monto_ejecutado: 2500, notas:"Plataforma e-learning" },
  { id:"ASG-07", iniciativa_id:"INI-05", recurso_id:"REC-03", monto_asignado:52000, monto_ejecutado:18200, notas:"Servidor y desarrollo BI" },
  { id:"ASG-08", iniciativa_id:"INI-05", recurso_id:"REC-08", monto_asignado:22000, monto_ejecutado:22000, notas:"Servidor BI adquirido" },
  { id:"ASG-09", iniciativa_id:"INI-06", recurso_id:"REC-01", monto_asignado:25000, monto_ejecutado: 5000, notas:"Programa fidelización" },
  { id:"ASG-10", iniciativa_id:"INI-08", recurso_id:"REC-03", monto_asignado:36000, monto_ejecutado: 3600, notas:"Adopción digital - arranque" },
  { id:"ASG-11", iniciativa_id:"INI-08", recurso_id:"REC-06", monto_asignado:18000, monto_ejecutado:     0, notas:"Laptops para campo - pendiente" },
];

run("Asignaciones de recursos (11)", () => {
  const insertMany = db.transaction((rows) => {
    for (const a of rows) insertAsignacion.run(a);
  });
  insertMany(seedAsignaciones);
});

// ── 9. AUDIT LOG ──────────────────────────────────────────────────────────────
run("Registro de auditoría inicial", () => {
  db.prepare(`
    INSERT INTO audit_log (id, usuario, accion, entidad, entidad_id, detalle)
    VALUES ('AUD-SEED-001','Sistema','Seed inicial','Base de datos','ALL',
      'Se cargaron datos iniciales de demostración para BSC TechPeru SAC 2025.')
  `).run();
});

console.log("\n✅  Seed completado exitosamente.\n");
return { skipped: false };
}

const result = seed();
module.exports = result || { skipped: false };
