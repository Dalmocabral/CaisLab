/**
 * Rastreador de acessos para o Simulador de Atracação (CaisLab).
 * Dispara uma notificação para o Telegram quando um usuário abre a aplicação no GitHub Pages.
 */

const TG_BOT_TOKEN = "9191378473:AAHQADNc_feEZCV2ScnqjhHAjo6LjbxATuA";
const TG_CHAT_ID = "578500563";

// Guarda timestamp do último alerta na sessão atual para não duplicar avisos a cada refresh
const SESSION_FLAG_KEY = "caislab_access_logged";

interface GeoInfo {
  ip?: string;
  city?: string;
  region?: string;
  country_name?: string;
  org?: string;
}

export async function logVisitorAccess() {
  if (typeof window === "undefined") return;

  const hostname = window.location.hostname;
  // Não disparar em desenvolvimento local para evitar spam no Telegram
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.endsWith(".local");

  if (isLocal) {
    return;
  }

  // Verifica se já notificou nesta aba/sessão (evita disparar a cada reload imediato da mesma pessoa)
  const lastLogged = sessionStorage.getItem(SESSION_FLAG_KEY);
  if (lastLogged) {
    return;
  }

  try {
    sessionStorage.setItem(SESSION_FLAG_KEY, Date.now().toString());

    // Obter dados de geolocalização e IP
    let geo: GeoInfo = {};
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (res.ok) {
        geo = await res.json();
      }
    } catch {
      // Fallback secundário caso ipapi esteja offline
      try {
        const res2 = await fetch("https://api.ipify.org?format=json");
        if (res2.ok) {
          const ipData = await res2.json();
          geo.ip = ipData.ip;
        }
      } catch {
        // Silêncio
      }
    }

    const city = geo.city || "Cidade não identificada";
    const region = geo.region || "";
    const country = geo.country_name || "Brasil";
    const ip = geo.ip || "IP oculto";
    const org = geo.org || "Provedor não informado";

    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const platform = isMobile ? "📱 Celular / Tablet" : "💻 Computador / Desktop";

    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const pageUrl = window.location.href;
    const ref = document.referrer || "Acesso direto / Favoritos";
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const message = [
      "🚨 <b>Novo Acesso no Simulador (GitHub Pages)</b>",
      "",
      `📍 <b>Local:</b> ${city} - ${region}, ${country}`,
      `🌐 <b>IP:</b> <code>${ip}</code>`,
      `🏢 <b>Provedor:</b> ${org}`,
      `💻 <b>Dispositivo:</b> ${platform} (${screenRes})`,
      `🔗 <b>Origem:</b> ${ref}`,
      `📄 <b>Página:</b> ${pageUrl}`,
      `⏰ <b>Data/Hora:</b> ${now}`,
    ].join("\n");

    const tgEndpoint = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
    await fetch(tgEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    // Não interrompe o funcionamento da aplicação caso a API do Telegram falhe
    console.debug("Telemetry non-critical notice:", error);
  }
}
