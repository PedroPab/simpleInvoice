// ============================================================
// PRESTADOR POR DEFECTO
// ============================================================
//
// Estos valores son públicos y genéricos para poder publicar la app.
// Carga tus datos reales desde /configuracion usando un JSON privado.

export const PROVIDER = {
  name: "Nombre del Prestador",
  title: "Profesión o servicio",
  cc: "0000000000",
  email: "correo@ejemplo.com",
  phone: "+57 300 000 0000",
  city: "Ciudad, País",
  website: "tu-dominio.com",

  bank: "Banco",
  accountType: "Tipo de cuenta",
  accountNumber: "000 000000 00",
  accountHolder: "Nombre del titular",
  nequi: "+573000000000",
  breve: "@usuario"
} as const;
