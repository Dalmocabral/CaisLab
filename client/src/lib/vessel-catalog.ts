import { normalizeBayCount, normalizeRowCount, normalizeTierCount, type BridgePositionType } from "./berth-model";

export interface CatalogVessel {
  name: string;
  loa: number;
  beam: number;
  draft: number;
  bayCount?: number;
  /** @deprecated Campo legado, mantido apenas para importar catálogos anteriores. */
  maxBayNumber?: number;
  bays?: number;
  /** Quantidade de rows (filas transversais na boca). */
  rowCount?: number;
  /** @deprecated Campo legado mantido para compatibilidade. */
  rows?: number;
  /** Quantidade de tiers (camadas de contêineres sobre o convés). */
  tierCount?: number;
  /** @deprecated Campo legado mantido para compatibilidade. */
  tiers?: number;
  berthingSide: "boreste" | "bombordo";
  imo?: string;
  type?: string;
  flag?: string;
  lastBerth?: string;
  updatedAt?: string;
  /** Posição do passadiço: 'all-aft' (popa extrema) ou 'between-bays' (entre as bays). */
  bridgePosition?: BridgePositionType;
  bridgeBay?: number;
  bridgeBayStart?: number;
  bridgeBayEnd?: number;
  separateFunnel?: boolean;
  funnelBay?: number;
  funnelBayStart?: number;
  funnelBayEnd?: number;
  imageUrl?: string;
  marineTrafficUrl?: string;
  isManualLayout?: boolean;
}

export interface PraticagemManeuver {
  dateTime: string;
  name: string;
  draft: number;
  loa: number;
  beam: number;
  maneuver: string; // 'E' = Entrada, 'S' = Saída, 'M' = Mudança
  berthFrom: string;
  berthTo: string;
  berthingSide: "boreste" | "bombordo";
  imo?: string;
  type?: string;
  flag?: string;
}

export interface PraticagemLiveResponse {
  updatedAt: string;
  count: number;
  maneuvers: PraticagemManeuver[];
}

const LOCAL_STORAGE_CATALOG_KEY = "caislab:saved_vessels:v2";

/**
 * Verifica se a embarcação atraca no Terminal Rio (TECONTPROLONG ou TECONT1) ou se é cadastro manual.
 * Descarta navios de outros berços da baía de Guanabara (CPBS, T-OIL, SUDESTE, ÁREA 11, etc.).
 */
export function isTerminalVessel(v: CatalogVessel): boolean {
  if (!v.lastBerth) return true;
  const b = v.lastBerth.trim().toUpperCase();
  // Se tiver berço do terminal, aceita
  if (b.includes("TECONTPROLONG") || b.includes("TECONT1") || b.includes("PROLONG") || b.includes("TECON")) return true;
  // Rejeita explicitamente outros terminais fora do porto
  if (
    b.includes("CPBS") ||
    b.includes("T-OIL") ||
    b.includes("ÁREA") ||
    b.includes("AREA") ||
    b.includes("SUDESTE") ||
    b.includes("T-MULT") ||
    b.includes("CSN") ||
    b.includes("COSAN") ||
    b.includes("RNV") ||
    b.includes("B-PORT") ||
    b.includes("BPORT") ||
    b.includes("TERNIUM") ||
    b.includes("PP-") ||
    b.includes("PG-") ||
    b.includes("PS-") ||
    b.includes("TOLEO") ||
    b.includes("DOME") ||
    b.includes("ALISEO")
  ) {
    return false;
  }
  // Se for navio salvo no catálogo com dimensões válidas, aceita sempre
  return true;
}

/**
 * Carrega a lista de Navios Salvos do Terminal (unindo localStorage e arquivo público JSON).
 */
export async function fetchVesselCatalog(): Promise<CatalogVessel[]> {
  const map = new Map<string, CatalogVessel>();

  // Limpar cache legado com navios de outros berços
  try {
    localStorage.removeItem("caislab:vessels_catalog:v1");
  } catch {}

  // 1. Tentar ler do arquivo / API
  try {
    const res = await fetch("/api/catalog/vessels", { cache: "no-store" });
    if (res.ok) {
      const data: CatalogVessel[] = await res.json();
      data.forEach((v) => {
        if (v.name && isTerminalVessel(v)) map.set(v.name.trim().toUpperCase(), v);
      });
    } else {
      // Fallback para arquivo estático com cache-busting para garantir versão mais recente no GitHub Pages
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const fallbackRes = await fetch(`${basePath}/vessels_catalog.json?t=${Date.now()}`, { cache: "no-store" });
      if (fallbackRes.ok) {
        const data: CatalogVessel[] = await fallbackRes.json();
        data.forEach((v) => {
          if (v.name && isTerminalVessel(v)) map.set(v.name.trim().toUpperCase(), v);
        });
      }
    }
  } catch (err) {
    console.warn("Aviso ao buscar navios salvos via API, usando fallback:", err);
    try {
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const fallbackRes = await fetch(`${basePath}/vessels_catalog.json?t=${Date.now()}`, { cache: "no-store" });
      if (fallbackRes.ok) {
        const data: CatalogVessel[] = await fallbackRes.json();
        data.forEach((v) => {
          if (v.name && isTerminalVessel(v)) map.set(v.name.trim().toUpperCase(), v);
        });
      }
    } catch {
      // ignore
    }
  }

  // 2. Mesclar com localStorage (para edições ou criações locais imediatas), preservando campos configurados do catálogo JSON
  try {
    const localRaw = localStorage.getItem(LOCAL_STORAGE_CATALOG_KEY);
    if (localRaw) {
      const localData: CatalogVessel[] = JSON.parse(localRaw);
      localData.forEach((v) => {
        if (v.name && isTerminalVessel(v)) {
          const key = v.name.trim().toUpperCase();
          const existing = map.get(key);
          if (existing) {
            // Se o navio tiver layout manual calibrado no catálogo JSON oficial (ex: CMA CGM IRON), o catálogo oficial sempre prevalece sobre cache antigo
            if (existing.isManualLayout) {
              map.set(key, {
                ...v,
                ...existing,
                imageUrl: existing.imageUrl || v.imageUrl,
                marineTrafficUrl: existing.marineTrafficUrl || v.marineTrafficUrl,
              });
            } else {
              map.set(key, {
                ...existing,
                ...v,
                imageUrl: v.imageUrl || existing.imageUrl,
                marineTrafficUrl: v.marineTrafficUrl || existing.marineTrafficUrl,
                bayCount: v.bayCount ?? v.bays ?? existing.bayCount ?? existing.bays,
                bays: v.bayCount ?? v.bays ?? existing.bayCount ?? existing.bays,
                rowCount: v.rowCount ?? v.rows ?? existing.rowCount ?? existing.rows,
                rows: v.rowCount ?? v.rows ?? existing.rowCount ?? existing.rows,
                tierCount: v.tierCount ?? v.tiers ?? existing.tierCount ?? existing.tiers,
                tiers: v.tierCount ?? v.tiers ?? existing.tierCount ?? existing.tiers,
                bridgePosition: v.bridgePosition ?? existing.bridgePosition,
                bridgeBay: v.bridgeBay ?? existing.bridgeBay,
                bridgeBayStart: v.bridgeBayStart ?? existing.bridgeBayStart,
                bridgeBayEnd: v.bridgeBayEnd ?? existing.bridgeBayEnd,
                separateFunnel: v.separateFunnel ?? existing.separateFunnel,
                funnelBay: v.funnelBay ?? existing.funnelBay,
                funnelBayStart: v.funnelBayStart ?? existing.funnelBayStart,
                funnelBayEnd: v.funnelBayEnd ?? existing.funnelBayEnd,
              });
            }
          } else {
            map.set(key, v);
          }
        }
      });
    }
  } catch (e) {
    console.warn("Erro ao ler navios salvos do localStorage:", e);
  }

  const list = Array.from(map.values()).map((v) => {
    const cleanName = v.name.trim().toUpperCase();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const isBbc = cleanName.startsWith("BBC");
    const defaultImg = isBbc ? "/vessels/bbc_amber.jpg" : `/vessels/${slug}.jpg`;
    return {
      ...v,
      imageUrl: v.imageUrl || defaultImg,
      marineTrafficUrl: v.marineTrafficUrl || (v.imo ? `https://www.marinetraffic.com/en/ais/details/ships/imo:${v.imo}` : `https://www.marinetraffic.com/en/ais/index/ships/all/keyword:${encodeURIComponent(v.name)}`),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

/**
 * Salva ou atualiza um navio no catálogo permanente (tanto no servidor/JSON quanto no localStorage).
 */
export async function saveVesselToCatalog(vessel: CatalogVessel): Promise<CatalogVessel[]> {
  const cleanName = vessel.name.trim().toUpperCase();
  const { maxBayNumber, ...currentFields } = vessel;
  const bayCount = normalizeBayCount(vessel.bayCount ?? vessel.bays ?? maxBayNumber);
  const rowCount = normalizeRowCount(vessel.rowCount ?? vessel.rows);
  const entry: CatalogVessel = {
    ...currentFields,
    name: cleanName,
    loa: Math.max(1, Number(vessel.loa) || 100),
    beam: Math.max(1, Number(vessel.beam) || 20),
    draft: Math.max(0, Number(vessel.draft) || 0),
    bayCount,
    bays: bayCount,
    rowCount,
    rows: rowCount,
    berthingSide: vessel.berthingSide === "bombordo" ? "bombordo" : "boreste",
    updatedAt: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };

  // Salvar no localStorage
  try {
    const current = await fetchVesselCatalog();
    const map = new Map<string, CatalogVessel>(current.map((v) => [v.name.trim().toUpperCase(), v]));
    const existing = map.get(cleanName);
    const definedFields = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== undefined),
    ) as Partial<CatalogVessel>;
    const { maxBayNumber: _legacyBayNumber, ...existingFields } = existing ?? {};
    const savedEntry: CatalogVessel = {
      ...existingFields,
      ...definedFields,
      name: cleanName,
      loa: entry.loa,
      beam: entry.beam,
      draft: entry.draft,
      bayCount: entry.bayCount,
      bays: entry.bayCount,
      rowCount: entry.rowCount,
      rows: entry.rowCount,
      tierCount: entry.tierCount,
      tiers: entry.tierCount,
      berthingSide: entry.berthingSide,
      imageUrl: entry.imageUrl ?? existing?.imageUrl,
      marineTrafficUrl: entry.marineTrafficUrl ?? existing?.marineTrafficUrl,
    };
    map.set(cleanName, savedEntry);
    const updatedList = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    localStorage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(updatedList));

    // Enviar para o servidor se disponível
    try {
      await fetch("/api/catalog/vessels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedEntry),
      });
    } catch {
      // offline / static mode ok
    }

    return updatedList;
  } catch (err) {
    console.error("Erro ao salvar navio no catálogo:", err);
    return [entry];
  }
}

/**
 * Remove um navio do catálogo permanente.
 */
export async function deleteVesselFromCatalog(name: string): Promise<CatalogVessel[]> {
  const cleanName = name.trim().toUpperCase();
  try {
    const current = await fetchVesselCatalog();
    const updatedList = current.filter((v) => v.name.toUpperCase() !== cleanName);
    localStorage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(updatedList));

    try {
      await fetch(`/api/catalog/vessels?name=${encodeURIComponent(cleanName)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }

    return updatedList;
  } catch (err) {
    console.error("Erro ao deletar navio do catálogo:", err);
    return [];
  }
}

/**
 * Carrega a lista de manobras ativas/programadas da Praticagem RJ.
 */
export async function fetchPraticagemLive(): Promise<PraticagemLiveResponse> {
  try {
    const res = await fetch("/api/praticagem/live", { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  try {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const fallbackRes = await fetch(`${basePath}/praticagem_live.json`, { cache: "no-store" });
    if (fallbackRes.ok) {
      return await fallbackRes.json();
    }
  } catch {
    // ignore
  }

  return { updatedAt: "", count: 0, maneuvers: [] };
}

/**
 * Solicita uma sincronização imediata (re-executa scraper da Praticagem RJ).
 */
export async function syncPraticagemNow(): Promise<{ success: boolean; count?: number; message?: string }> {
  try {
    const res = await fetch("/api/praticagem/sync", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      return { success: true, count: data.maneuversCount, message: "Praticagem RJ sincronizada com sucesso!" };
    }
  } catch (err) {
    console.warn("API /api/praticagem/sync indisponível (modo estático/GitHub Pages):", err);
  }
  return {
    success: false,
    message: "No GitHub Pages, as manobras são sincronizadas automaticamente a cada 2 horas via GitHub Actions. No app Electron, a sincronização é em tempo real.",
  };
}

/**
 * Exporta o catálogo em formato de arquivo JSON para download.
 */
export function exportCatalogJson(catalog: CatalogVessel[]) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(catalog, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `catalogo_navios_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
