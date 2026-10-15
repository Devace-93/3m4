import type { PartialCatalog } from "./en";

/** Português (Portugal) — overrides vs the Brazilian base. */
const ptPT: PartialCatalog = {
  "nav.login": "Iniciar sessão",
  "nav.signup": "Registe-se grátis",
  "nav.logout": "Terminar sessão",
  "nav.billing": "Faturação",
  "ui.search": "Pesquisar",

  "landing.feature3Body": "302 por predefinição para análises precisas; mude qualquer link para um 301 permanente.",
  "landing.feature6Body": "Crie e gira links por código com chaves de API restritas por função.",
  "landing.feature7Body":
    "Claude Code, Cursor ou qualquer host MCP pode encurtar links e ler as análises por si, com funções, confirmações e um registo de auditoria.",
  "landing.mcpBullet1Title": "Chaves restritas por função.",
  "landing.mcpBullet3Title": "Registo de auditoria.",
  "landing.mcpBullet3Body": "Toda a alteração e toda a chamada recusada fica registada, no servidor e no agente.",
  "landing.mcpKeyNote": "Crie uma chave com a função que quiser em",
  "landing.selfhostBody2": ". Sem código de faturação, sem limites além dos que configurar.",
  "pricing.footnote":
    "Todos os preços em USD. A faturação anual poupa ~20 %. Os limites aplicam-se por período de faturação; links acima do limite são bloqueados, cliques acima do limite continuam a redirecionar (apenas deixamos de os contar).",
  "pricing.user": "utilizador",
  "pricing.users": "utilizadores",
  "pricing.teamExtras": "Funções + suporte prioritário",
  "pricing.contactUs": "Contacte-nos",
  "sponsors.become": "Torne-se supporter",

  "common.loading": "A carregar…",
  "common.creating": "A criar…",
  "common.password": "Palavra-passe",
  "common.role": "Função",

  "auth.loginTitle": "Iniciar sessão",
  "auth.loginFailed": "Falha ao iniciar sessão. Verifique o seu e-mail e palavra-passe.",
  "auth.loggingIn": "A iniciar sessão…",
  "auth.signUp": "Registe-se",
  "auth.signupFailed": "Falha no registo. Tente novamente.",
  "auth.inviteOnlyTitle": "🔒 De momento o registo é só por convite",
  "auth.logIn": "Iniciar sessão",
  "auth.creatingAccount": "A criar conta…",

  "dash.limitReached": "Atingiu o limite mensal de links deste plano.",
  "dash.redirect301": "301 — Permanente (guardado em cache pelos navegadores)",
  "dash.loadingLinks": "A carregar links…",

  "link.downloadPng": "Transferir PNG",

  "billing.title": "Faturação",
  "billing.selfHostDisabled": "A faturação está desativada",
  "billing.unavailableBody": "Estamos a disponibilizar a faturação aos poucos. Mantém tudo do seu plano atual. Volte em breve.",
  "billing.annualSave": "(poupe ~20 %)",
  "billing.featUsers": "{n} utilizadores",
  "billing.processing": "A processar…",
  "billing.notConfigured":
    "A faturação ainda não está configurada (falta VITE_REVENUECAT_PUBLIC_KEY). Adicione a sua chave pública do RevenueCat Web Billing ao .env e reconstrua a imagem web.",
  "billing.signInAgain": "Inicie sessão novamente para fazer upgrade.",
  "billing.openingCheckout": "A abrir o checkout seguro…",
  "billing.activating": "Pagamento concluído. A ativar o seu plano…",
};
export default ptPT;
