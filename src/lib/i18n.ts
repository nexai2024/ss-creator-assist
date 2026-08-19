export const LOCALES = ["en", "es", "fr", "de", "pt", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

const catalog: Record<Locale, Record<string, string>> = {
  en: {
    help: "Help Center",
    search: "Search articles...",
    contact: "Contact support",
    ticket: "Check ticket",
    howHelp: "How can we help?",
    chatAria: "Open chat",
    startChat: "Start chat",
    typeMessage: "Type a message...",
    name: "Your name",
    email: "Email",
    away: "Currently away",
    replySoon: "We typically reply in a few minutes",
    proactiveDismiss: "Got it",
  },
  es: {
    help: "Centro de ayuda",
    search: "Buscar artículos...",
    contact: "Contactar soporte",
    ticket: "Consultar ticket",
    howHelp: "¿En qué podemos ayudarte?",
    chatAria: "Abrir chat",
    startChat: "Iniciar chat",
    typeMessage: "Escribe un mensaje...",
    name: "Tu nombre",
    email: "Correo",
    away: "Ahora no estamos",
    replySoon: "Solemos responder en unos minutos",
    proactiveDismiss: "Entendido",
  },
  fr: {
    help: "Centre d'aide",
    search: "Rechercher des articles...",
    contact: "Contacter le support",
    ticket: "Suivre un ticket",
    howHelp: "Comment pouvons-nous aider ?",
    chatAria: "Ouvrir le chat",
    startChat: "Démarrer le chat",
    typeMessage: "Écrire un message...",
    name: "Votre nom",
    email: "E-mail",
    away: "Actuellement absent",
    replySoon: "Nous répondons généralement en quelques minutes",
    proactiveDismiss: "Compris",
  },
  de: {
    help: "Hilfe-Center",
    search: "Artikel suchen...",
    contact: "Support kontaktieren",
    ticket: "Ticket prüfen",
    howHelp: "Wie können wir helfen?",
    chatAria: "Chat öffnen",
    startChat: "Chat starten",
    typeMessage: "Nachricht schreiben...",
    name: "Ihr Name",
    email: "E-Mail",
    away: "Derzeit nicht da",
    replySoon: "Wir antworten in der Regel in wenigen Minuten",
    proactiveDismiss: "Verstanden",
  },
  pt: {
    help: "Central de ajuda",
    search: "Pesquisar artigos...",
    contact: "Falar com o suporte",
    ticket: "Ver ticket",
    howHelp: "Como podemos ajudar?",
    chatAria: "Abrir chat",
    startChat: "Iniciar chat",
    typeMessage: "Digite uma mensagem...",
    name: "Seu nome",
    email: "E-mail",
    away: "Ausente no momento",
    replySoon: "Costumamos responder em alguns minutos",
    proactiveDismiss: "Entendi",
  },
  ja: {
    help: "ヘルプセンター",
    search: "記事を検索...",
    contact: "サポートに連絡",
    ticket: "チケットを確認",
    howHelp: "どのようにお手伝いできますか？",
    chatAria: "チャットを開く",
    startChat: "チャットを開始",
    typeMessage: "メッセージを入力...",
    name: "お名前",
    email: "メール",
    away: "不在です",
    replySoon: "通常数分以内に返信します",
    proactiveDismiss: "了解",
  },
};

export function parseLocale(value: string | null | undefined): Locale {
  const raw = (value ?? "en").toLowerCase().slice(0, 2);
  return (LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : "en";
}

export function t(locale: string | null | undefined, key: string): string {
  const loc = parseLocale(locale);
  return catalog[loc][key] ?? catalog.en[key] ?? key;
}
