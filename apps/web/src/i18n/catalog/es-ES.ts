import type { PartialCatalog } from "./en";

/** Español (España) — overrides vs the Mexican base. */
const esES: PartialCatalog = {
  "pricing.footnote":
    "Todos los precios en USD. La facturación anual ahorra ~20 %. Los límites se aplican por periodo de facturación; los enlaces que superan el límite se bloquean, los clics que lo superan siguen redirigiendo (solo dejamos de contarlos).",
  "early.bannerText":
    "Ahora mismo todas las cuentas tienen acceso completo sin coste. Los planes y límites se introducirán más adelante, con aviso antes de cualquier cambio.",
  "auth.loginSubtitle": "Bienvenido de nuevo a 3m4.",
  "auth.inviteOnlyBody": "Estamos abriendo poco a poco. Mantente al tanto: pronto habrá plazas.",
  "auth.freePitch": "Gratis para siempre: 50 enlaces y 1.000 clics rastreados al mes.",
  "dash.limitReached": "Has alcanzado el límite mensual de enlaces de este plan.",
  "billing.annualSave": "(ahorra ~20 %)",
  "billing.notConfigured":
    "La facturación todavía no está configurada (falta VITE_REVENUECAT_PUBLIC_KEY). Añade tu clave pública de RevenueCat Web Billing a .env y vuelve a construir la imagen web.",
};
export default esES;
