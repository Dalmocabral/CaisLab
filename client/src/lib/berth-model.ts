export type VesselColor = "blue" | "teal" | "orange" | "violet";
export type BerthingSide = "bombordo" | "boreste";
export type MooringLineType = "lancante-proa" | "spring-proa" | "spring-popa" | "lancante-popa";

export const MOORING_LINE_LABELS: Record<MooringLineType, string> = {
  "lancante-proa": "Lançante de proa",
  "spring-proa": "Spring de proa",
  "spring-popa": "Spring de popa",
  "lancante-popa": "Lançante de popa",
};

export interface BerthSegment {
  id: string;
  name: string;
  length: number;
}

export type BollardType = "duplo" | "alto-antigo" | "alto-novo" | "baixo-antigo" | "avariado";

export const BASE_PATH = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL)
  ? (import.meta.env.BASE_URL === "./" ? "." : import.meta.env.BASE_URL.replace(/\/$/, ""))
  : "";

export function getAssetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (BASE_PATH && BASE_PATH !== "." && path.startsWith(BASE_PATH)) {
    return path;
  }
  const clean = path.replace(/^\.?\//, "");
  return BASE_PATH ? `${BASE_PATH}/${clean}` : `/${clean}`;
}

export const BOLLARD_TYPES: Record<BollardType, { label: string; color: string; border: string; image: string }> = {
  "duplo": { label: "Cabeço duplo", color: "#3a7ebf", border: "#225a8d", image: getAssetUrl("bollards/cabeco-duplos.png") },
  "alto-antigo": { label: "Cabeço alto antigo", color: "#3d4529", border: "#252b17", image: getAssetUrl("bollards/cabeco-alto-antigo.jpg") },
  "alto-novo": { label: "Cabeço alto novo", color: "#6c757d", border: "#495057", image: getAssetUrl("bollards/cabeco-alto-novo.jpg") },
  "baixo-antigo": { label: "Cabeço baixo antigo", color: "#e67e22", border: "#b85d10", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  "avariado": { label: "Cabeço avariado", color: "#d62828", border: "#9e1515", image: getAssetUrl("bollards/cabeco-duplos.png") },
};

export interface Bollard {
  id: string;
  /** Metros desde o início do cais; null significa posição ainda não cadastrada. */
  position: number | null;
  type?: BollardType;
  image?: string;
}

export const CABECO_SIMPLES_IDS = new Set(["296", "295", "294", "293", "292", "291", "290", "282", "280", "279"]);
export const CABECO_DUPLO_IDS = new Set(["309", "308", "307", "306", "305", "304", "303", "302", "301", "300", "299", "298", "297"]);
export const CABECO_BAIXO_ANTIGO_IDS = new Set(["289", "288", "287", "286", "285", "284", "283", "278", "277"]);
export const CABECO_BAIXO_NOVO_IDS = new Set(["281"]);

export interface MooringLine {
  id: string;
  type: MooringLineType;
  /** Ponto do navio medido desde a popa; null enquanto não informado. */
  shipOffset: number | null;
  bollardId: string | null;
}

export type VesselType =
  | "container"
  | "chemical-tanker"
  | "product-tanker"
  | "tanker"
  | "general-cargo"
  | "offshore"
  | "diving-support"
  | "research-survey";

export const VESSEL_TYPE_LABELS: Record<VesselType, string> = {
  "container": "Porta-Contêineres (Container Ship - Fully Cellular)",
  "chemical-tanker": "Navio Tanque Químico (Chemical Tanker)",
  "product-tanker": "Petroleiro de Produtos (Product Tanker)",
  "tanker": "Petroleiro / Químico (Tanker Geral)",
  "general-cargo": "Carga Geral / Graneleiro (General Cargo)",
  "offshore": "Apoio Marítimo / Offshore (Pipe Layer / PLSV / PSV / AHTS)",
  "diving-support": "Apoio a Mergulho / Subsea (Diving Support Vessel - DSV)",
  "research-survey": "Pesquisa / Hidrográfico (Research Survey Vessel)",
};

export const MAX_BAY_COUNT = 78;
export const MAX_ROW_COUNT = 32;
export const MAX_TIER_COUNT = 10;

/** Normaliza a quantidade de bays informada pelo operador. */
export function normalizeBayCount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(MAX_BAY_COUNT, Math.max(1, Math.round(parsed)));
}

export function bayNumberSequence(value: unknown, vesselName?: string): number[] {
  const bayCount = normalizeBayCount(value);
  if (!bayCount) return [];
  // Bays de 20 pés são ímpares (01, 03...); se a última bay for par (ex.: 50, 78), inclui a bay par de 40 pés no final.
  const isEven = bayCount % 2 === 0;
  const oddCount = isEven ? bayCount / 2 : Math.floor(bayCount / 2) + 1;
  const seq = Array.from({ length: oddCount }, (_, index) => index * 2 + 1);
  if (isEven && bayCount > 0 && !seq.includes(bayCount)) {
    seq.push(bayCount);
  }

  // No navio EVER LEADER não tem bay 53 e 59 (são 54 e 58) e a bay 77 não existe (é apenas 78)
  const isEverLeader = typeof vesselName === "string" && vesselName.trim().toUpperCase().includes("EVER LEADER");
  if (isEverLeader) {
    return Array.from(
      new Set(
        seq
          .filter((b) => b !== 77)
          .map((b) => {
            if (b === 53) return 54;
            if (b === 59) return 58;
            return b;
          })
      )
    );
  }

  return seq;
}

/**
 * Retorna o par de bays de 20 pés que compõem uma bay / escotilha de 40 pés.
 * Ex: 58 (40') -> [57, 59]
 *     57 ou 59 -> [57, 59]
 *     34 (40') -> [33, 35]
 *     02 (40') -> [01, 03]
 */
export function get40ftBayPair(bayNumber: number): [number, number] {
  if (bayNumber <= 0) return [1, 3];
  if (bayNumber % 2 === 0) {
    return [bayNumber - 1, bayNumber + 1];
  }
  if ((bayNumber - 1) % 4 === 0) {
    return [bayNumber, bayNumber + 2];
  }
  return [bayNumber - 2, bayNumber];
}

/**
 * Retorna a lista de números de bays ocupadas pela superestrutura (passadiço ou chaminé).
 * Considera que cada bay de 40 pés (par) ocupa os dois slots de 20 pés (ímpares).
 */
export function getOccupiedBayNumbers(
  targetBay?: number,
  startBay?: number,
  endBay?: number,
): number[] {
  const primary = targetBay ?? startBay;
  if (!primary) return [];
  const start = typeof targetBay === "number" ? targetBay : (startBay ?? primary);
  const end = typeof targetBay === "number" ? targetBay : (endBay ?? primary);

  const minTarget = Math.min(start, end);
  const maxTarget = Math.max(start, end);

  const [min20] = get40ftBayPair(minTarget);
  const [, max20] = get40ftBayPair(maxTarget);

  const occupied: number[] = [];
  for (let b = min20; b <= max20; b++) {
    occupied.push(b);
  }
  return occupied;
}

export type BridgePositionType = "all-aft" | "between-bays";

export interface VesselSuperstructure {
  bridgePosition: BridgePositionType;
  bridgeBay?: number;
  bridgeBayStart?: number;
  bridgeBayEnd?: number;
  separateFunnel: boolean;
  funnelBay?: number;
  funnelBayStart?: number;
  funnelBayEnd?: number;
}

export function resolveVesselSuperstructure(vessel: Partial<Vessel>): VesselSuperstructure {
  const bridgePos: BridgePositionType = vessel.bridgePosition === "between-bays" ? "between-bays" : "all-aft";
  const bBay = typeof vessel.bridgeBay === "number"
    ? vessel.bridgeBay
    : typeof vessel.bridgeBayStart === "number"
    ? vessel.bridgeBayStart
    : bridgePos === "between-bays"
    ? 34
    : undefined;
  const sepFunnel = Boolean(vessel.separateFunnel);
  const fBay = typeof vessel.funnelBay === "number"
    ? vessel.funnelBay
    : typeof vessel.funnelBayStart === "number"
    ? vessel.funnelBayStart
    : sepFunnel
    ? 54
    : undefined;

  return {
    bridgePosition: bridgePos,
    bridgeBay: bBay,
    bridgeBayStart: typeof vessel.bridgeBay === "number" ? vessel.bridgeBay : (vessel.bridgeBayStart ?? bBay),
    bridgeBayEnd: typeof vessel.bridgeBay === "number" ? vessel.bridgeBay : (vessel.bridgeBayEnd ?? bBay),
    separateFunnel: sepFunnel,
    funnelBay: fBay,
    funnelBayStart: typeof vessel.funnelBay === "number" ? vessel.funnelBay : (vessel.funnelBayStart ?? fBay),
    funnelBayEnd: typeof vessel.funnelBay === "number" ? vessel.funnelBay : (vessel.funnelBayEnd ?? fBay),
  };
}

/** Normaliza a quantidade de rows (filas transversais) de contêineres na boca do navio. */
export function normalizeRowCount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(MAX_ROW_COUNT, Math.max(1, Math.round(parsed)));
}

/**
 * Gera a sequência padrão de numeração de Row de bombordo a boreste (olhando para a proa):
 * - Esquerda da proa (bombordo / port side): números PARES em ordem decrescente (ex: 12, 10, 08, 06, 04, 02)
 * - Linha de centro: se a quantidade for ÍMPAR, existe a Row 00
 * - Direita da proa (boreste / starboard side): números ÍMPARES em ordem crescente (ex: 01, 03, 05, 07, 09, 11)
 */
export function rowNumberSequence(value: unknown): string[] {
  const rowCount = normalizeRowCount(value);
  if (!rowCount) return [];
  const isOdd = rowCount % 2 !== 0;
  const sideCount = Math.floor(rowCount / 2);
  const result: string[] = [];

  // Pares (esquerda da proa / bombordo): do maior par decrescendo até 02
  for (let i = sideCount; i >= 1; i--) {
    result.push(String(i * 2).padStart(2, "0"));
  }

  // Se ímpar, existe a Row 00 no centro
  if (isOdd) {
    result.push("00");
  }

  // Ímpares (direita da proa / boreste): de 01 crescendo até o maior ímpar
  for (let i = 1; i <= sideCount; i++) {
    result.push(String((i - 1) * 2 + 1).padStart(2, "0"));
  }

  return result;
}

/** Normaliza a quantidade de tiers (camadas verticais de contêineres sobre o convés). */
export function normalizeTierCount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(MAX_TIER_COUNT, Math.max(1, Math.round(parsed)));
}

/** Estima a quantidade padrão de tiers no convés com base na boca do navio caso não informada */
export function defaultTierCountForBeam(beam: number): number {
  if (beam >= 48) return 5;
  if (beam >= 38) return 4;
  if (beam >= 30) return 4;
  return 3;
}

export const KNOWN_VESSEL_TYPES: Record<string, VesselType> = {
  "BBC AMBER": "general-cargo",
  "OCEAN MERMAID": "research-survey",
  "SEVEN RIO": "offshore",
  "SEVEN CRUZEIRO": "offshore",
  "SEVEN WAVES": "offshore",
  "SEVEN SUN": "offshore",
  "CMA CGM COBALT": "container",
  "CMA CGM IRON": "container",
  "CMA CGM KRYPTON": "container",
  "CMA CGM PUCCINI": "container",
  "CMA CGM VERACRUZ": "container",
  "COSCO SHIPPING ARGENTINA": "container",
  "COSCO SHIPPING BRAZIL": "container",
  "COSCO SHIPPING CHILE": "container",
  "EVER FAME": "container",
  "EVER FAR": "container",
  "EVER FASHION": "container",
  "EVER LEADER": "container",
  "KOTA ELOK": "container",
  "KOTA PAHLAWAN": "container",
  "KOTA SINGA": "container",
  "LOG-IN PANTANAL": "container",
  "LONCOMILLA": "container",
  "MAERSK FREEPORT": "container",
  "MALIAKOS": "container",
  "MERCOSUL GUARUJA": "container",
  "NC BRAVO": "container",
  "NC BREDA": "container",
  "NYK DIANA": "container",
  "NYK RUMINA": "container",
  "SEASPAN EMPIRE": "container",
  "TOKYO EXPRESS": "container",
  "ZIM BALTIMORE": "container",
};

export const KNOWN_VESSEL_DEFAULTS: Record<string, Partial<Vessel>> = {
  "NYK DIANA": {
    name: "NYK DIANA",
    loa: 294.12,
    beam: 32.25,
    draft: 12.8,
    bayCount: 70,
    bays: 70,
    rowCount: 12,
    rows: 12,
    tierCount: 4,
    tiers: 4,
    bridgePosition: "between-bays",
    bridgeBay: 56,
    bridgeBayStart: 56,
    bridgeBayEnd: 56,
    separateFunnel: false,
    vesselType: "container",
  },
  "MERCOSUL GUARUJA": {
    name: "MERCOSUL GUARUJA",
    loa: 228.15,
    beam: 32.2,
    draft: 10.2,
    bayCount: 49,
    bays: 49,
    rowCount: 12,
    rows: 12,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 42,
    bridgeBayStart: 42,
    bridgeBayEnd: 42,
    separateFunnel: false,
    vesselType: "container",
  },
  "NYK RUMINA": {
    name: "NYK RUMINA",
    loa: 294.12,
    beam: 32.25,
    draft: 12.6,
    bayCount: 70,
    bays: 70,
    rowCount: 12,
    rows: 12,
    tierCount: 4,
    tiers: 4,
    bridgePosition: "between-bays",
    bridgeBay: 56,
    bridgeBayStart: 56,
    bridgeBayEnd: 56,
    separateFunnel: false,
    vesselType: "container",
  },
  "SEASPAN EMPIRE": {
    name: "SEASPAN EMPIRE",
    loa: 294.13,
    beam: 32.2,
    draft: 9.8,
    bayCount: 71,
    bays: 71,
    rowCount: 13,
    rows: 13,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 56,
    bridgeBayStart: 56,
    bridgeBayEnd: 56,
    separateFunnel: false,
    vesselType: "container",
  },
  "SEVEN RIO": {
    name: "SEVEN RIO",
    loa: 145.95,
    beam: 29.98,
    draft: 6.5,
    berthingSide: "bombordo",
    vesselType: "offshore",
    color: "orange",
  },
  "COSCO SHIPPING CHILE": {
    name: "COSCO SHIPPING CHILE",
    loa: 335.9,
    beam: 51.0,
    draft: 11.2,
    bayCount: 78,
    bays: 78,
    rowCount: 20,
    rows: 20,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 22,
    bridgeBayStart: 22,
    bridgeBayEnd: 22,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
  },
  "COSCO SHIPPING BRAZIL": {
    name: "COSCO SHIPPING BRAZIL",
    loa: 335.93,
    beam: 51.04,
    draft: 13.5,
    bayCount: 78,
    bays: 78,
    rowCount: 20,
    rows: 20,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 22,
    bridgeBayStart: 22,
    bridgeBayEnd: 22,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
  },
  "COSCO SHIPPING ARGENTINA": {
    name: "COSCO SHIPPING ARGENTINA",
    loa: 335.95,
    beam: 51.04,
    draft: 13.0,
    bayCount: 78,
    bays: 78,
    rowCount: 20,
    rows: 20,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 22,
    bridgeBayStart: 22,
    bridgeBayEnd: 22,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
  },
  "EVER FIT": {
    name: "EVER FIT",
    loa: 333.9,
    beam: 48.43,
    draft: 14.3,
    bayCount: 76,
    bays: 76,
    rowCount: 20,
    rows: 20,
    tierCount: 7,
    tiers: 7,
    bridgePosition: "between-bays",
    bridgeBay: 28,
    bridgeBayStart: 28,
    bridgeBayEnd: 28,
    separateFunnel: true,
    funnelBay: 62,
    funnelBayStart: 62,
    funnelBayEnd: 62,
    vesselType: "container",
  },
  "CMA CGM VERACRUZ": {
    name: "CMA CGM VERACRUZ",
    loa: 228.62,
    beam: 32.22,
    draft: 9.7,
    bayCount: 50,
    bays: 50,
    rowCount: 13,
    rows: 13,
    tierCount: 4,
    tiers: 4,
    bridgePosition: "all-aft",
    bridgeBay: 50,
    bridgeBayStart: 50,
    bridgeBayEnd: 50,
    separateFunnel: false,
    funnelBayStart: 44,
    funnelBayEnd: 46,
    vesselType: "container",
  },
  "CMA CGM KRYPTON": {
    name: "CMA CGM KRYPTON",
    loa: 335.23,
    beam: 51.06,
    draft: 14.2,
    bayCount: 79,
    bays: 79,
    rowCount: 20,
    rows: 20,
    tierCount: 6,
    tiers: 6,
    bridgePosition: "between-bays",
    bridgeBay: 28,
    bridgeBayStart: 28,
    bridgeBayEnd: 28,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
  },
  "CMA CGM COBALT": {
    name: "CMA CGM COBALT",
    loa: 335.23,
    beam: 51.06,
    draft: 14.4,
    bayCount: 78,
    bays: 78,
    rowCount: 20,
    rows: 20,
    tierCount: 6,
    tiers: 6,
    bridgePosition: "between-bays",
    bridgeBay: 22,
    bridgeBayStart: 22,
    bridgeBayEnd: 22,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
    imageUrl: "/vessels/cma_cgm_cobalt.jpg",
    marineTrafficUrl: "https://www.marinetraffic.com/en/ais/details/ships/imo:9996680",
  },
  "CMA CGM IRON": {
    name: "CMA CGM IRON",
    loa: 335.23,
    beam: 51.06,
    draft: 13.5,
    bayCount: 78,
    bays: 78,
    rowCount: 20,
    rows: 20,
    tierCount: 9,
    tiers: 9,
    bridgePosition: "between-bays",
    bridgeBay: 28,
    bridgeBayStart: 28,
    bridgeBayEnd: 28,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
    imageUrl: "/vessels/cma_cgm_iron.jpg",
    marineTrafficUrl: "https://www.marinetraffic.com/en/ais/details/ships/imo:9996678",
  },
  "MERCOSUL FORTALEZA": {
    name: "MERCOSUL FORTALEZA",
    loa: 185.97,
    beam: 34.88,
    draft: 10.7,
    bayCount: 58,
    bays: 58,
    rowCount: 14,
    rows: 14,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "all-aft",
    bridgeBay: 48,
    bridgeBayStart: 48,
    bridgeBayEnd: 48,
    separateFunnel: false,
    vesselType: "container",
  },
  "MAERSK FORTALEZA": {
    name: "MAERSK FORTALEZA",
    loa: 185.97,
    beam: 34.88,
    draft: 10.7,
    bayCount: 58,
    bays: 58,
    rowCount: 14,
    rows: 14,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "all-aft",
    bridgeBay: 48,
    bridgeBayStart: 48,
    bridgeBayEnd: 48,
    separateFunnel: false,
    vesselType: "container",
  },
  "MAERSK FREEPORT": {
    name: "MAERSK FREEPORT",
    loa: 254.94,
    beam: 40.0,
    draft: 12.6,
    bayCount: 59,
    bays: 59,
    rowCount: 14,
    rows: 14,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 48,
    bridgeBayStart: 48,
    bridgeBayEnd: 48,
    separateFunnel: false,
    vesselType: "container",
    imageUrl: "/vessels/maersk_freeport.jpg",
    marineTrafficUrl: "https://www.marinetraffic.com/en/ais/details/ships/shipid:8941589",
  },
  "LOG-IN PANTANAL": {
    name: "LOG-IN PANTANAL",
    loa: 182.47,
    beam: 25.2,
    draft: 8.5,
    bayCount: 40,
    bays: 40,
    rowCount: 10,
    rows: 10,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "all-aft",
    bridgeBay: 40,
    bridgeBayStart: 40,
    bridgeBayEnd: 40,
    separateFunnel: false,
    vesselType: "container",
  },
  "NC BRISA": {
    name: "NC BRISA",
    loa: 223.96,
    beam: 34.88,
    draft: 9.5,
    bayCount: 47,
    bays: 47,
    rowCount: 12,
    rows: 12,
    tierCount: 6,
    tiers: 6,
    bridgePosition: "all-aft",
    bridgeBay: 47,
    bridgeBayStart: 47,
    bridgeBayEnd: 47,
    separateFunnel: false,
    vesselType: "container",
  },
  "SPYROS V": {
    name: "SPYROS V",
    loa: 261.03,
    beam: 32.3,
    draft: 12.6,
    bayCount: 50,
    bays: 50,
    rowCount: 10,
    rows: 10,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 34,
    bridgeBayStart: 34,
    bridgeBayEnd: 34,
    separateFunnel: false,
    vesselType: "container",
  },
  "KOTA ELOK": {
    name: "KOTA ELOK",
    loa: 335,
    beam: 51,
    draft: 14.6,
    bayCount: 79,
    bays: 79,
    rowCount: 20,
    rows: 20,
    tierCount: 6,
    tiers: 6,
    bridgePosition: "between-bays",
    bridgeBay: 24,
    bridgeBayStart: 24,
    bridgeBayEnd: 24,
    separateFunnel: true,
    funnelBay: 64,
    funnelBayStart: 64,
    funnelBayEnd: 64,
    vesselType: "container",
  },
  "KOTA SINGA": {
    name: "KOTA SINGA",
    loa: 228.0,
    beam: 37.38,
    draft: 9.2,
    bayCount: 50,
    bays: 50,
    rowCount: 14,
    rows: 14,
    tierCount: 5,
    tiers: 5,
    bridgePosition: "between-bays",
    bridgeBay: 46,
    bridgeBayStart: 45,
    bridgeBayEnd: 47,
    separateFunnel: false,
    vesselType: "container",
    imageUrl: "/vessels/kota_singa.jpg",
    marineTrafficUrl: "https://www.marinetraffic.com/en/ais/details/ships/imo:9681314",
  },
  "BBC AMBER": {
    name: "BBC AMBER",
    loa: 153.44,
    beam: 23.45,
    draft: 6.8,
    vesselType: "general-cargo",
    color: "blue",
  },
};

/**
 * Identifica se a embarcação teve seu layout de convés (bays, passadiço, chaminé) configurado manualmente.
 * Exibe o ícone 🛠️ no catálogo para que o usuário identifique os navios já prontos e quais ainda faltam.
 */
export function isManuallyConfiguredVessel(vessel?: {
  name?: string | null;
  bayCount?: number;
  bays?: number;
  bridgePosition?: string;
  separateFunnel?: boolean;
  bridgeBay?: number;
  isManualLayout?: boolean;
  vesselType?: string | null;
  type?: string | null;
} | null): boolean {
  if (!vessel) return false;
  if (vessel.isManualLayout) return true;

  const rawName = (vessel.name ?? "").trim().toUpperCase();
  if (!rawName) return false;

  const MANUAL_VESSEL_NAMES = [
    "CMA CGM KRYPTON",
    "CMA CGM COBALT",
    "CMA CGM IRON",
    "KOTA ELOK",
    "KOTA SINGA",
    "CMA CGM VERACRUZ",
    "NYK DIANA",
    "NYK RUMINA",
    "MERCOSUL GUARUJA",
    "SEASPAN EMPIRE",
    "COSCO SHIPPING CHILE",
    "COSCO SHIPPING BRAZIL",
    "COSCO SHIPPING ARGENTINA",
    "EVER FIT",
    "EVER LEADER",
    "MERCOSUL FORTALEZA",
    "MAERSK FORTALEZA",
    "MAERSK FREEPORT",
    "LOG-IN PANTANAL",
    "NC BRISA",
    "SPYROS V",
    "DUSSELDORF EXPRESS",
    "APL NEW JERSEY",
  ];

  if (MANUAL_VESSEL_NAMES.some((m) => rawName.includes(m))) {
    return true;
  }

  // Apenas navios porta-contêineres utilizam o layout manual de baias/casaria
  const vType = normalizeVesselType(vessel.vesselType ?? vessel.type, vessel.name);
  if (vType !== "container") return false;

  // Se o objeto possui campos de layout de baias e casaria explicitamente salvos
  if (
    (typeof vessel.bayCount === "number" && vessel.bayCount > 0) ||
    (typeof vessel.bays === "number" && vessel.bays > 0) ||
    Boolean(vessel.bridgePosition) ||
    Boolean(vessel.separateFunnel) ||
    typeof vessel.bridgeBay === "number"
  ) {
    return true;
  }

  return false;
}

export function normalizeVesselType(raw?: string | null, vesselName?: string | null): VesselType {
  const upper = (raw ?? "").toUpperCase().trim();
  const upperName = (vesselName ?? "").toUpperCase().trim();

  // 0. Reconhecimento direto pelo dicionário de navios conhecidos (máxima prioridade)
  if (upperName && KNOWN_VESSEL_TYPES[upperName]) {
    return KNOWN_VESSEL_TYPES[upperName];
  }

  // 1. Reconhecimento inteligente baseado na frota mundial e padrões de nomenclatura do navio:
  // a) General Cargo / Carga Geral / Multipurpose / Heavy Lift (ex: BBC Chartering, AAL, Thorco, Chipolbrok, BigLift)
  if (
    upperName.startsWith("BBC ") ||
    upperName.includes("BBC AMBER") ||
    upperName.startsWith("AAL ") ||
    upperName.startsWith("THORCO ") ||
    upperName.includes("CHIPOLBROK") ||
    upperName.includes("BIGLIFT") ||
    upperName.includes("BIGROLL") ||
    upperName.includes("SPLIETHOFF") ||
    upperName.includes("GENERAL CARGO") ||
    upperName.includes("CARGA GERAL")
  ) {
    return "general-cargo";
  }

  // b) Apoio Offshore / PLSV / PSV / AHTS (ex: Subsea 7, DOF, Siem, Solstad, Bourbon)
  if (
    upperName.startsWith("SEVEN ") ||
    upperName.startsWith("SKANDI ") ||
    upperName.startsWith("SIEM ") ||
    upperName.startsWith("NORMAND ") ||
    upperName.startsWith("BOURBON ") ||
    upperName.includes("C-INNOVATION") ||
    upperName.includes("EDISON CHOUEST")
  ) {
    return "offshore";
  }

  // c) Pesquisa / Survey / Hidrográfico / Oceanográfico (ex: OCEAN MERMAID, Fugro)
  if (
    upperName.includes("OCEAN MERMAID") ||
    upperName.includes("FUGRO") ||
    upperName.includes("SURVEY") ||
    upperName.includes("RESEARCH") ||
    upperName.includes("HIDROGRAF") ||
    upperName.includes("OCEANOGRAF")
  ) {
    return "research-survey";
  }

  // d) Navios Tanque Químicos por operadora (Stolt, Odfjell)
  if (
    upperName.startsWith("STOLT ") ||
    upperName.startsWith("ODFJELL ") ||
    upperName.startsWith("BOW ")
  ) {
    return "chemical-tanker";
  }

  // 2. Classificação robusta pelo campo de tipo técnico (raw) vindo do AIS, Praticagem, IMO ou Catálogo:
  // a) Pesquisa / Survey
  if (
    upper === "research-survey" ||
    upper.includes("RESEARCH") ||
    upper.includes("SURVEY") ||
    upper.includes("HIDROGRAF") ||
    upper.includes("PESQUISA") ||
    upper.includes("OCEANOGRAF") ||
    upper.includes("SEISMIC") ||
    upper.includes("SCIENTIFIC")
  ) {
    return "research-survey";
  }

  // b) Carga Geral / Multiuso / Graneleiro / Heavy Lift (GENERAL CARGO SHIP, BULK, etc.)
  if (
    upper === "general-cargo" ||
    upper.includes("GENERAL CARGO") ||
    upper.includes("CARGO SHIP") ||
    upper.includes("CARGA GERAL") ||
    upper.includes("MULTIPURPOSE") ||
    upper.includes("MULTI-PURPOSE") ||
    upper.includes("MPV") ||
    upper.includes("HEAVY LIFT") ||
    upper.includes("PROJECT CARGO") ||
    upper.includes("BREAK BULK") ||
    upper.includes("BREAKBULK") ||
    upper.includes("BULK") ||
    upper.includes("GRANELEIRO") ||
    upper.includes("ORE CARRIER") ||
    upper.includes("CEMENT") ||
    upper.includes("CIMENTO") ||
    upper.includes("GRAIN") ||
    upper.includes("CARRIER")
  ) {
    return "general-cargo";
  }

  // c) Químico (Chemical Tanker)
  if (
    upper === "chemical-tanker" ||
    upper.includes("CHEMICAL") ||
    upper.includes("QUÍMICO") ||
    upper.includes("QUIMICO")
  ) {
    return "chemical-tanker";
  }

  // d) Produtos Claros (Product Tanker)
  if (
    upper === "product-tanker" ||
    upper.includes("PRODUCT") ||
    upper.includes("PRODUTO") ||
    upper.includes("CLEAN")
  ) {
    return "product-tanker";
  }

  // e) Petroleiro / Óleo / Gás / Tanker geral
  if (
    upper === "tanker" ||
    upper.includes("TANKER") ||
    upper.includes("OIL") ||
    upper.includes("PETROLEIRO") ||
    upper.includes("GAS") ||
    upper.includes("GÁS") ||
    upper.includes("LPG") ||
    upper.includes("LNG") ||
    upper.includes("BITUMEN") ||
    upper.includes("ASPHALT")
  ) {
    return "tanker";
  }

  // f) Apoio a Mergulho (DSV)
  if (
    upper === "diving-support" ||
    upper.includes("DIVING") ||
    upper.includes("MERGULHO") ||
    upper.includes("DSV")
  ) {
    return "diving-support";
  }

  // g) Apoio Offshore / Pipe Layer / PSV / AHTS / Rebocador
  if (
    upper === "offshore" ||
    upper.includes("OFFSHORE") ||
    upper.includes("PIPE") ||
    upper.includes("PIPELAYER") ||
    upper.includes("PIPE LAYER") ||
    upper.includes("PIPE-LAYER") ||
    upper.includes("PLSV") ||
    upper.includes("SUBSEA") ||
    upper.includes("LANÇADOR") ||
    upper.includes("LANCADOR") ||
    upper.includes("DUTOS") ||
    upper.includes("PLATFORM SUPPLY") ||
    upper.includes("PSV") ||
    upper.includes("AHTS") ||
    upper.includes("SUPPLY") ||
    upper.includes("TUG") ||
    upper.includes("REBOCADOR") ||
    upper.includes("EMPURRADOR") ||
    upper.includes("OSRV")
  ) {
    return "offshore";
  }

  // h) Porta-Contêineres
  if (
    upper === "container" ||
    upper.includes("CONTAINER") ||
    upper.includes("CONTÊINER") ||
    upper.includes("CONTEINER") ||
    upper.includes("FULLY CELLULAR")
  ) {
    return "container";
  }

  // 3. Fallback inteligente baseado em operadoras globais de porta-contêineres:
  if (
    upperName.startsWith("CMA CGM") ||
    upperName.startsWith("MSC ") ||
    upperName.startsWith("MAERSK ") ||
    upperName.startsWith("COSCO") ||
    upperName.startsWith("EVER ") ||
    upperName.startsWith("ONE ") ||
    upperName.startsWith("HAPAG") ||
    upperName.startsWith("ZIM ") ||
    upperName.startsWith("LOG-IN") ||
    upperName.startsWith("MERCOSUL") ||
    upperName.startsWith("KOTA ") ||
    upperName.startsWith("NYK ") ||
    upperName.startsWith("NC ")
  ) {
    return "container";
  }

  return "container";
}

export interface Vessel {
  id: string;
  name: string;
  loa: number;
  beam: number;
  draft: number;
  position: number;
  /** Lado do navio voltado para o cais; a vista superior espelha a proa conforme a escolha. */
  berthingSide: BerthingSide;
  /** Posição do eixo/ponto central da escada medida a partir da popa. */
  gangwayOffset: number;
  mooringLines: MooringLine[];
  color: VesselColor;
  vesselType?: VesselType;
  /** Quantidade de bays configurada para o convés; omissa quando desconhecida. */
  bayCount?: number;
  /** @deprecated Campo legado; cenários antigos são convertidos para bayCount. */
  maxBayNumber?: number;
  /** @deprecated Campo legado mantido para compatibilidade. */
  bays?: number;
  /** Quantidade de rows (filas de contêineres na boca); omissa quando desconhecida. */
  rowCount?: number;
  /** @deprecated Campo legado mantido para compatibilidade. */
  rows?: number;
  /** Quantidade de tiers (camadas de contêineres sobre o convés); omissa quando desconhecida. */
  tierCount?: number;
  /** @deprecated Campo legado mantido para compatibilidade. */
  tiers?: number;
  /** Posição do passadiço: 'all-aft' (popa extrema, como CMA CGM Veracruz) ou 'between-bays' (entre bays). */
  bridgePosition?: BridgePositionType;
  /** Bay onde o passadiço fica quando 'between-bays' (ex: 34). */
  bridgeBay?: number;
  bridgeBayStart?: number;
  bridgeBayEnd?: number;
  /** Indica se a chaminé é separada do passadiço (navios grandes / duas ilhas). */
  separateFunnel?: boolean;
  /** Bay onde a chaminé separada fica (ex: 54). */
  funnelBay?: number;
  funnelBayStart?: number;
  funnelBayEnd?: number;
  /** URL ou caminho da foto da embarcação (ex.: foto do MarineTraffic). */
  imageUrl?: string;
  /** Link direto para a página do navio no MarineTraffic (ex.: shipid). */
  marineTrafficUrl?: string;
}

export interface ContainerHatchPlan {
  hatchIndex: number;
  colA: number;
  colB?: number;
  bay20A: number;
  bay20B?: number;
  fromSternA: number;
  fromSternB?: number;
  centerFromStern: number;
  length40: number;
  length20: number;
  isBlockedByBridge: boolean;
  isBlockedByFunnel: boolean;
  colABlocked: boolean;
  colBBlocked: boolean;
}

export interface VesselContainerDeckPlan {
  loa: number;
  beam: number;
  bays: number[];
  cellWidth: number;
  hatchGap: number;
  bowInset: number;
  deckLeft: number;
  deckRight: number;
  isAllAft: boolean;
  bridgeCenterFromStern: number;
  bridgeLength: number;
  hasSeparateFunnel: boolean;
  funnelCenterFromStern?: number;
  funnelLength?: number;
  bridgeIndices: number[];
  funnelIndices: number[];
  hatches: ContainerHatchPlan[];
  bayCellFromStern: (index: number) => number;
}

export function getVesselContainerDeckPlan(vessel: Partial<Vessel>): VesselContainerDeckPlan {
  const loa = Math.max(1, vessel.loa ?? 200);
  const beam = Math.max(1, vessel.beam ?? 32);
  const config = resolveVesselSuperstructure(vessel);
  const isFortaleza = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("FORTALEZA");
  const isDusseldorf = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("DUSSELDORF");
  const isAplNewJersey = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("APL") && vessel.name.toUpperCase().includes("NEW JERSEY");
  const isMercosulGuaruja = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("GUARUJA");
  // No 3D do Fortaleza: 10 escotilhas de 40' bem distribuídas (bays 01 a 39) com vão entre bays
  // No DUSSELDORF EXPRESS: 35 bays de 20' (01 a 69), com bay 53 isolada de 20' e passadiço entre 57 e 59
  // No APL NEW JERSEY: bay 01 isolada na proa, 13 pares de 40' até 53, passadiço entre 53 e 55, 4 pares de 40' até bay 68 na popa
  // No MERCOSUL GUARUJA: bay 01 isolada na proa, 10 pares de 40' até 41, passadiço entre 41 e 43, 2 pares de 40' na ré (43-45 e 47-49)
  const bays = isFortaleza
    ? Array.from({ length: 20 }, (_, index) => index * 2 + 1)
    : isDusseldorf
    ? Array.from({ length: 35 }, (_, index) => index * 2 + 1)
    : isAplNewJersey
    ? [
        1,
        3, 5,
        7, 9,
        11, 13,
        15, 17,
        19, 21,
        23, 25,
        27, 29,
        31, 33,
        35, 37,
        39, 41,
        43, 45,
        47, 49,
        51, 53,
        55, 57,
        59, 61,
        63, 65,
        67, 68,
      ]
    : isMercosulGuaruja
    ? Array.from({ length: 25 }, (_, index) => index * 2 + 1)
    : bayNumberSequence(vessel.bayCount ?? vessel.bays ?? vessel.maxBayNumber, vessel.name);
  const isAllAft = config.bridgePosition === "all-aft";

  const bowInset = isFortaleza ? Math.min(16, loa * 0.09) : Math.min(23, loa * 0.16);
  const aftHouseW = isFortaleza ? 13.5 : Math.max(12, Math.min(24, loa * 0.065));
  const aftHouseX = isFortaleza ? 6.5 : 2.5;

  const deckLeft = isAllAft ? aftHouseX + aftHouseW + 1.2 : 7;
  const deckRight = Math.max(deckLeft + 1, loa - bowInset);
  const deckWidth = deckRight - deckLeft;

  const rowNumberWidth = isFortaleza ? 3.5 : Math.max(6, Math.min(9.5, deckWidth * 0.042));
  const bayAreaRight = deckRight - rowNumberWidth - 0.8;
  const bayAreaWidth = Math.max(1, bayAreaRight - deckLeft);

  const isCoscoClass = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("COSCO") && (
    vessel.name.toUpperCase().includes("CHILE") ||
    vessel.name.toUpperCase().includes("BRAZIL") ||
    vessel.name.toUpperCase().includes("BRASIL") ||
    vessel.name.toUpperCase().includes("ARGENTINA") ||
    vessel.name.toUpperCase().includes("URUGUAY")
  );
  const isCmaCgmClass = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("CMA CGM") && (
    vessel.name.toUpperCase().includes("KRYPTON") ||
    vessel.name.toUpperCase().includes("COBALT") ||
    vessel.name.toUpperCase().includes("IRON")
  );
  const isKotaElok = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("KOTA") && vessel.name.toUpperCase().includes("ELOK");
  const idx63 = bays.indexOf(63);
  const idx65 = bays.indexOf(65);
  const hasCoscoFunnel = (isCoscoClass || isCmaCgmClass || isKotaElok) && config.separateFunnel && idx63 !== -1 && idx65 !== -1;

  const isNykRumina = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("NYK") && (vessel.name.toUpperCase().includes("RUMINA") || vessel.name.toUpperCase().includes("DIANA"));
  const isSeaspanEmpire = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("SEASPAN") && vessel.name.toUpperCase().includes("EMPIRE");
  const isMaerskFreeport = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("MAERSK") && vessel.name.toUpperCase().includes("FREEPORT");
  const idx23 = bays.indexOf(23);
  const idx25 = bays.indexOf(25);
  const idx41 = bays.indexOf(41);
  const idx43 = bays.indexOf(43);
  const idx47 = bays.indexOf(47);
  const idx49 = bays.indexOf(49);
  const idx53 = bays.indexOf(53);
  const idx55 = bays.indexOf(55);
  const idx57 = bays.indexOf(57);
  const idx59 = bays.indexOf(59);
  const hasSpecialBridge55_57 = (isNykRumina || isSeaspanEmpire) && idx55 !== -1 && idx57 !== -1;
  const hasKotaElokBridge = isKotaElok && idx23 !== -1 && idx25 !== -1;
  const hasFreeportBridge = isMaerskFreeport && idx47 !== -1 && idx49 !== -1;
  const hasDusseldorfBridge = isDusseldorf && idx57 !== -1 && idx59 !== -1;
  const hasAplBridge = isAplNewJersey && idx53 !== -1 && idx55 !== -1;
  const hasGuarujaBridge = isMercosulGuaruja && idx41 !== -1 && idx43 !== -1;

  const isEverFitClass = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("EVER") && (
    vessel.name.toUpperCase().includes("FIT") ||
    vessel.name.toUpperCase().includes("FAR") ||
    vessel.name.toUpperCase().includes("FAME") ||
    vessel.name.toUpperCase().includes("FASHION") ||
    vessel.name.toUpperCase().includes("FORTUNE") ||
    vessel.name.toUpperCase().includes("FAST") ||
    vessel.name.toUpperCase().includes("FORE") ||
    vessel.name.toUpperCase().includes("FUTURE")
  );
  const idx27 = bays.indexOf(27);
  const idx29 = bays.indexOf(29);
  const idx61 = bays.indexOf(61);
  const hasEverFitBridge = (isEverFitClass || isCmaCgmClass) && idx27 !== -1 && idx29 !== -1;
  const hasEverFitFunnel = isEverFitClass && config.separateFunnel && idx61 !== -1 && idx63 !== -1;

  const num40ftGaps = isDusseldorf ? 17 : isAplNewJersey ? 16 : isMercosulGuaruja ? 11 : Math.max(0, Math.floor((bays.length - 1) / 2));
  const extraSlots = (hasCoscoFunnel ? 1.4 : 0) + (hasEverFitFunnel ? 1.4 : 0) + (hasSpecialBridge55_57 ? 2.0 : 0) + (hasEverFitBridge ? 2.0 : 0) + (hasKotaElokBridge ? 2.0 : 0) + (hasFreeportBridge ? 2.0 : 0) + (hasDusseldorfBridge ? 2.0 : 0) + (hasAplBridge ? 2.0 : 0) + (hasGuarujaBridge ? 2.0 : 0);
  const rawBayWidth = bayAreaWidth / Math.max(1, bays.length + extraSlots);
  const hatchGap = isFortaleza ? 1.6 : (bays.length > 2 ? Math.max(1.4, Math.min(3.8, rawBayWidth * 0.32)) : 0);
  const totalGapsWidth = num40ftGaps * hatchGap;
  const coscoFunnelSlotW = hasCoscoFunnel ? Math.max(2.4, Math.min(8.0, rawBayWidth * 1.35)) : 0;
  const everFitFunnelSlotW = hasEverFitFunnel ? Math.max(2.4, Math.min(8.0, rawBayWidth * 1.35)) : 0;
  const nykBridgeSlotW = hasSpecialBridge55_57 ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const everFitBridgeSlotW = hasEverFitBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const kotaElokBridgeSlotW = hasKotaElokBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const freeportBridgeSlotW = hasFreeportBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const dusseldorfBridgeSlotW = hasDusseldorfBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const aplBridgeSlotW = hasAplBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const guarujaBridgeSlotW = hasGuarujaBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const availableBayWidth = Math.max(1, bayAreaWidth - totalGapsWidth - coscoFunnelSlotW - everFitFunnelSlotW - nykBridgeSlotW - everFitBridgeSlotW - kotaElokBridgeSlotW - freeportBridgeSlotW - dusseldorfBridgeSlotW - aplBridgeSlotW - guarujaBridgeSlotW);
  const cellWidth = availableBayWidth / Math.max(1, bays.length);

  const bayCellFromStern = (index: number) => {
    let gapsBefore = Math.floor(index / 2);
    if (isMercosulGuaruja) {
      if (index === 0) {
        gapsBefore = 0;
      } else if (index <= 20) {
        gapsBefore = 1 + Math.floor((index - 1) / 2);
      } else {
        gapsBefore = 10 + Math.floor((index - 21) / 2);
      }
    } else if (isAplNewJersey) {
      if (index === 0) {
        gapsBefore = 0;
      } else if (index <= 26) {
        gapsBefore = 1 + Math.floor((index - 1) / 2);
      } else {
        gapsBefore = 13 + Math.floor((index - 27) / 2);
      }
    } else if (isDusseldorf) {
      if (index <= 25) {
        gapsBefore = Math.floor(index / 2);
      } else if (index === 26) {
        gapsBefore = 13;
      } else if (index <= 28) {
        gapsBefore = 14;
      } else {
        gapsBefore = 15 + Math.floor((index - 29) / 2);
      }
    } else if (hasEverFitFunnel && index >= idx63) {
      gapsBefore = Math.floor((index - 1) / 2);
    }
    let xPos = bayAreaRight - ((index + 1) * cellWidth + gapsBefore * hatchGap);
    if (hasCoscoFunnel && index >= idx65) {
      xPos -= coscoFunnelSlotW;
    }
    if (hasEverFitFunnel && index >= idx63) {
      xPos -= everFitFunnelSlotW;
    }
    if (hasSpecialBridge55_57 && index >= idx57) {
      xPos -= nykBridgeSlotW;
    }
    if (hasEverFitBridge && index >= idx29) {
      xPos -= everFitBridgeSlotW;
    }
    if (hasKotaElokBridge && index >= idx25) {
      xPos -= kotaElokBridgeSlotW;
    }
    if (hasFreeportBridge && index >= idx49) {
      xPos -= freeportBridgeSlotW;
    }
    if (hasDusseldorfBridge && index >= idx59) {
      xPos -= dusseldorfBridgeSlotW;
    }
    if (hasAplBridge && index >= idx55) {
      xPos -= aplBridgeSlotW;
    }
    if (hasGuarujaBridge && index >= idx43) {
      xPos -= guarujaBridgeSlotW;
    }
    return xPos;
  };

  const bridgeIndices: number[] = [];
  const funnelIndices: number[] = [];

  if (!isAllAft && bays.length > 0 && !hasSpecialBridge55_57 && !hasEverFitBridge && !hasKotaElokBridge && !hasFreeportBridge && !hasDusseldorfBridge && !hasAplBridge && !hasGuarujaBridge) {
    const targetBridgeBay = config.bridgeBay ?? config.bridgeBayStart ?? 34;
    const occupiedBridgeBays = getOccupiedBayNumbers(
      targetBridgeBay,
      config.bridgeBayStart,
      config.bridgeBayEnd
    );
    bays.forEach((b, idx) => {
      if (occupiedBridgeBays.includes(b)) {
        bridgeIndices.push(idx);
      }
    });

    if (bridgeIndices.length === 0) {
      let closestIdx = 0;
      let minDiff = Infinity;
      bays.forEach((b, idx) => {
        const diff = Math.abs(b - targetBridgeBay);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      const closestBay = bays[closestIdx];
      const pair = get40ftBayPair(closestBay);
      bays.forEach((b, idx) => {
        if (b >= pair[0] && b <= pair[1]) {
          bridgeIndices.push(idx);
        }
      });
      if (bridgeIndices.length === 0) {
        bridgeIndices.push(closestIdx);
      }
    }

    if (config.separateFunnel && !hasCoscoFunnel && !hasEverFitFunnel) {
      const targetFunnelBay = config.funnelBay ?? config.funnelBayStart ?? 54;
      const occupiedFunnelBays = getOccupiedBayNumbers(
        targetFunnelBay,
        config.funnelBayStart,
        config.funnelBayEnd
      );
      bays.forEach((b, idx) => {
        if (occupiedFunnelBays.includes(b)) {
          funnelIndices.push(idx);
        }
      });

      if (funnelIndices.length === 0) {
        let closestIdx = 0;
        let minDiff = Infinity;
        bays.forEach((b, idx) => {
          const diff = Math.abs(b - targetFunnelBay);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        });
        const closestBay = bays[closestIdx];
        const pair = get40ftBayPair(closestBay);
        bays.forEach((b, idx) => {
          if (b >= pair[0] && b <= pair[1]) {
            funnelIndices.push(idx);
          }
        });
        if (funnelIndices.length === 0) {
          funnelIndices.push(closestIdx);
        }
      }
    }
  }

  let bridgeCenterFromStern: number;
  let bridgeLength: number;

  if (isAllAft) {
    bridgeCenterFromStern = aftHouseX + aftHouseW / 2;
    bridgeLength = aftHouseW;
  } else if (hasSpecialBridge55_57) {
    const rightOf57 = bayCellFromStern(idx57) + cellWidth;
    const leftOf55 = bayCellFromStern(idx55);
    bridgeCenterFromStern = (rightOf57 + leftOf55) / 2;
    bridgeLength = Math.max(10, nykBridgeSlotW - 0.4);
  } else if (hasEverFitBridge) {
    const rightOf29 = bayCellFromStern(idx29) + cellWidth;
    const leftOf27 = bayCellFromStern(idx27);
    bridgeCenterFromStern = (rightOf29 + leftOf27) / 2;
    bridgeLength = Math.max(10, everFitBridgeSlotW - 0.4);
  } else if (hasKotaElokBridge) {
    const rightOf25 = bayCellFromStern(idx25) + cellWidth;
    const leftOf23 = bayCellFromStern(idx23);
    bridgeCenterFromStern = (rightOf25 + leftOf23) / 2;
    bridgeLength = Math.max(10, kotaElokBridgeSlotW - 0.4);
  } else if (hasFreeportBridge) {
    const rightOf49 = bayCellFromStern(idx49) + cellWidth;
    const leftOf47 = bayCellFromStern(idx47);
    bridgeCenterFromStern = (rightOf49 + leftOf47) / 2;
    bridgeLength = Math.max(10, freeportBridgeSlotW - 0.4);
  } else if (hasDusseldorfBridge) {
    const rightOf59 = bayCellFromStern(idx59) + cellWidth;
    const leftOf57 = bayCellFromStern(idx57);
    bridgeCenterFromStern = (rightOf59 + leftOf57) / 2;
    bridgeLength = Math.max(10, dusseldorfBridgeSlotW - 0.4);
  } else if (hasAplBridge) {
    const rightOf55 = bayCellFromStern(idx55) + cellWidth;
    const leftOf53 = bayCellFromStern(idx53);
    bridgeCenterFromStern = (rightOf55 + leftOf53) / 2;
    bridgeLength = Math.max(10, aplBridgeSlotW - 0.4);
  } else if (hasGuarujaBridge) {
    const rightOf43 = bayCellFromStern(idx43) + cellWidth;
    const leftOf41 = bayCellFromStern(idx41);
    bridgeCenterFromStern = (rightOf43 + leftOf41) / 2;
    bridgeLength = Math.max(10, guarujaBridgeSlotW - 0.4);
  } else if (bridgeIndices.length > 0) {
    const minX = Math.min(...bridgeIndices.map((idx) => bayCellFromStern(idx)));
    const maxX = Math.max(...bridgeIndices.map((idx) => bayCellFromStern(idx) + cellWidth));
    bridgeCenterFromStern = (minX + maxX) / 2;
    bridgeLength = Math.max(12, maxX - minX);
  } else {
    bridgeCenterFromStern = loa * 0.65;
    bridgeLength = Math.max(12, Math.min(loa * 0.048, 15.5));
  }

  let funnelCenterFromStern: number | undefined;
  let funnelLength: number | undefined;

  if (hasCoscoFunnel) {
    const rightOf65 = bayCellFromStern(idx65) + cellWidth;
    const leftOf63 = bayCellFromStern(idx63);
    funnelCenterFromStern = (rightOf65 + leftOf63) / 2;
    funnelLength = Math.max(6, coscoFunnelSlotW);
  } else if (hasEverFitFunnel) {
    const rightOf63 = bayCellFromStern(idx63) + cellWidth;
    const leftOf61 = bayCellFromStern(idx61);
    funnelCenterFromStern = (rightOf63 + leftOf61) / 2;
    funnelLength = Math.max(6, everFitFunnelSlotW);
  } else if (config.separateFunnel && funnelIndices.length > 0) {
    const minX = Math.min(...funnelIndices.map((idx) => bayCellFromStern(idx)));
    const maxX = Math.max(...funnelIndices.map((idx) => bayCellFromStern(idx) + cellWidth));
    funnelCenterFromStern = (minX + maxX) / 2;
    funnelLength = Math.max(8, maxX - minX);
  }

  const bridgeSet = new Set(bridgeIndices);
  const funnelSet = new Set(funnelIndices);

  const isBayBlocked = (idx: number) => {
    if (isAllAft) return false;
    return bridgeSet.has(idx) || funnelSet.has(idx);
  };

  const totalHatches = Math.ceil(bays.length / 2);
  const hatches: ContainerHatchPlan[] = [];

  if (isMercosulGuaruja) {
    // 1. Escotilha 0: Bay 01 (bay de 20ft isolada na proa)
    const col01 = 0;
    const cellX01 = bayCellFromStern(col01);
    hatches.push({
      hatchIndex: 0,
      colA: col01,
      colB: undefined,
      bay20A: bays[col01],
      bay20B: undefined,
      fromSternA: cellX01 + cellWidth / 2,
      fromSternB: undefined,
      centerFromStern: cellX01 + cellWidth / 2,
      length40: cellWidth,
      length20: cellWidth,
      isBlockedByBridge: false,
      isBlockedByFunnel: false,
      colABlocked: false,
      colBBlocked: false,
    });

    // 2. Escotilhas 1 a 10: pares de 40ft em frente ao passadiço (bays 03-05 até 39-41)
    for (let p = 0; p < 10; p++) {
      const colA = 1 + 2 * p;
      const colB = colA + 1;
      const cellXA = bayCellFromStern(colA);
      const cellXB = bayCellFromStern(colB);
      hatches.push({
        hatchIndex: 1 + p,
        colA,
        colB,
        bay20A: bays[colA],
        bay20B: bays[colB],
        fromSternA: cellXA + cellWidth / 2,
        fromSternB: cellXB + cellWidth / 2,
        centerFromStern: (cellXB + cellXA + cellWidth) / 2,
        length40: (cellXA + cellWidth) - cellXB,
        length20: cellWidth,
        isBlockedByBridge: false,
        isBlockedByFunnel: false,
        colABlocked: false,
        colBBlocked: false,
      });
    }

    // [ O passadiço fica situado no vão entre a escotilha 10 (bays 39-41) e a escotilha 11 (bays 43-45) ]

    // 3. Escotilhas 11 e 12: pares de 40ft na ré do passadiço (43-45 e 47-49: "49 47 45 43 passadisso 41 39")
    const aftPairs = [
      { colA: 21, colB: 22 }, // 43, 45
      { colA: 23, colB: 24 }, // 47, 49
    ];
    aftPairs.forEach((pair, idx) => {
      const cellXA = bayCellFromStern(pair.colA);
      const cellXB = bayCellFromStern(pair.colB);
      hatches.push({
        hatchIndex: 11 + idx,
        colA: pair.colA,
        colB: pair.colB,
        bay20A: bays[pair.colA],
        bay20B: bays[pair.colB],
        fromSternA: cellXA + cellWidth / 2,
        fromSternB: cellXB + cellWidth / 2,
        centerFromStern: (cellXB + cellXA + cellWidth) / 2,
        length40: (cellXA + cellWidth) - cellXB,
        length20: cellWidth,
        isBlockedByBridge: false,
        isBlockedByFunnel: false,
        colABlocked: false,
        colBBlocked: false,
      });
    });
  } else if (isAplNewJersey) {
    // 1. Escotilha 0: Bay 01 (bay de 20ft isolada na proa: "05 03 | 01 na proa so tem uma bay de 20 que e 01")
    const col01 = 0;
    const cellX01 = bayCellFromStern(col01);
    hatches.push({
      hatchIndex: 0,
      colA: col01,
      colB: undefined,
      bay20A: bays[col01],
      bay20B: undefined,
      fromSternA: cellX01 + cellWidth / 2,
      fromSternB: undefined,
      centerFromStern: cellX01 + cellWidth / 2,
      length40: cellWidth,
      length20: cellWidth,
      isBlockedByBridge: false,
      isBlockedByFunnel: false,
      colABlocked: false,
      colBBlocked: false,
    });

    // 2. Escotilhas 1 a 13: pares de 40ft em frente ao passadiço (bays 03-05 até 51-53)
    for (let p = 0; p < 13; p++) {
      const colA = 1 + 2 * p;
      const colB = colA + 1;
      const cellXA = bayCellFromStern(colA);
      const cellXB = bayCellFromStern(colB);
      hatches.push({
        hatchIndex: 1 + p,
        colA,
        colB,
        bay20A: bays[colA],
        bay20B: bays[colB],
        fromSternA: cellXA + cellWidth / 2,
        fromSternB: cellXB + cellWidth / 2,
        centerFromStern: (cellXB + cellXA + cellWidth) / 2,
        length40: (cellXA + cellWidth) - cellXB,
        length20: cellWidth,
        isBlockedByBridge: false,
        isBlockedByFunnel: false,
        colABlocked: false,
        colBBlocked: false,
      });
    }

    // [ O passadiço fica situado no vão entre a escotilha 13 (bays 51-53) e a escotilha 14 (bays 55-57) ]

    // 3. Escotilhas 14 a 17: pares de 40ft na ré do passadiço (55 57, 59 61, 63 65, 67 68 "a ultima bay e 68 |")
    const aftPairs = [
      { colA: 27, colB: 28 }, // 55, 57
      { colA: 29, colB: 30 }, // 59, 61
      { colA: 31, colB: 32 }, // 63, 65
      { colA: 33, colB: 34 }, // 67, 68
    ];
    aftPairs.forEach((pair, idx) => {
      const cellXA = bayCellFromStern(pair.colA);
      const cellXB = bayCellFromStern(pair.colB);
      hatches.push({
        hatchIndex: 14 + idx,
        colA: pair.colA,
        colB: pair.colB,
        bay20A: bays[pair.colA],
        bay20B: bays[pair.colB],
        fromSternA: cellXA + cellWidth / 2,
        fromSternB: cellXB + cellWidth / 2,
        centerFromStern: (cellXB + cellXA + cellWidth) / 2,
        length40: (cellXA + cellWidth) - cellXB,
        length20: cellWidth,
        isBlockedByBridge: false,
        isBlockedByFunnel: false,
        colABlocked: false,
        colBBlocked: false,
      });
    });
  } else if (isDusseldorf) {
    // 1. Escotilhas 0 a 12: pares de 40ft (bays 01-03 até 49-51)
    for (let p = 0; p < 13; p++) {
      const colA = 2 * p;
      const colB = colA + 1;
      const cellXA = bayCellFromStern(colA);
      const cellXB = bayCellFromStern(colB);
      hatches.push({
        hatchIndex: p,
        colA,
        colB,
        bay20A: bays[colA],
        bay20B: bays[colB],
        fromSternA: cellXA + cellWidth / 2,
        fromSternB: cellXB + cellWidth / 2,
        centerFromStern: (cellXB + cellXA + cellWidth) / 2,
        length40: (cellXA + cellWidth) - cellXB,
        length20: cellWidth,
        isBlockedByBridge: false,
        isBlockedByFunnel: false,
        colABlocked: false,
        colBBlocked: false,
      });
    }

    // 2. Escotilha 13: Bay 53 (bay de 20ft isolada)
    const col53 = 26; // bays[26] === 53
    const cellX53 = bayCellFromStern(col53);
    hatches.push({
      hatchIndex: 13,
      colA: col53,
      colB: undefined,
      bay20A: bays[col53],
      bay20B: undefined,
      fromSternA: cellX53 + cellWidth / 2,
      fromSternB: undefined,
      centerFromStern: cellX53 + cellWidth / 2,
      length40: cellWidth,
      length20: cellWidth,
      isBlockedByBridge: false,
      isBlockedByFunnel: false,
      colABlocked: false,
      colBBlocked: false,
    });

    // 3. Escotilha 14: Bays 55 e 57 (par de 40ft em frente ao passadiço: 57 55)
    const col55 = 27;
    const col57 = 28;
    const cellX55 = bayCellFromStern(col55);
    const cellX57 = bayCellFromStern(col57);
    hatches.push({
      hatchIndex: 14,
      colA: col55,
      colB: col57,
      bay20A: bays[col55],
      bay20B: bays[col57],
      fromSternA: cellX55 + cellWidth / 2,
      fromSternB: cellX57 + cellWidth / 2,
      centerFromStern: (cellX57 + cellX55 + cellWidth) / 2,
      length40: (cellX55 + cellWidth) - cellX57,
      length20: cellWidth,
      isBlockedByBridge: false,
      isBlockedByFunnel: false,
      colABlocked: false,
      colBBlocked: false,
    });

    // [ O passadiço fica situado no vão entre a escotilha 14 (bays 55-57) e a escotilha 15 (bays 59-61) ]

    // 4. Escotilhas 15 a 17: pares de 40ft na ré do passadiço (61 59, 65 63, 69 67)
    const aftPairs = [
      { colA: 29, colB: 30 }, // 59, 61
      { colA: 31, colB: 32 }, // 63, 65
      { colA: 33, colB: 34 }, // 67, 69 ("ultima bay 69 67")
    ];
    aftPairs.forEach((pair, idx) => {
      const cellXA = bayCellFromStern(pair.colA);
      const cellXB = bayCellFromStern(pair.colB);
      hatches.push({
        hatchIndex: 15 + idx,
        colA: pair.colA,
        colB: pair.colB,
        bay20A: bays[pair.colA],
        bay20B: bays[pair.colB],
        fromSternA: cellXA + cellWidth / 2,
        fromSternB: cellXB + cellWidth / 2,
        centerFromStern: (cellXB + cellXA + cellWidth) / 2,
        length40: (cellXA + cellWidth) - cellXB,
        length20: cellWidth,
        isBlockedByBridge: false,
        isBlockedByFunnel: false,
        colABlocked: false,
        colBBlocked: false,
      });
    });
  } else {
    for (let h = 0; h < totalHatches; h++) {
      const colA = 2 * h;
      const colB = 2 * h + 1 < bays.length ? 2 * h + 1 : undefined;

      const bay20A = bays[colA];
      const bay20B = colB !== undefined ? bays[colB] : undefined;

      const cellXA = bayCellFromStern(colA);
      const fromSternA = cellXA + cellWidth / 2;

      let fromSternB: number | undefined;
      let centerFromStern: number;
      let length40: number;

      if (colB !== undefined) {
        const cellXB = bayCellFromStern(colB);
        fromSternB = cellXB + cellWidth / 2;
        centerFromStern = (cellXB + cellXA + cellWidth) / 2;
        length40 = (cellXA + cellWidth) - cellXB;
      } else {
        centerFromStern = fromSternA;
        length40 = cellWidth;
      }

      const colABlocked = isBayBlocked(colA);
      const colBBlocked = colB !== undefined ? isBayBlocked(colB) : false;

      const isBlockedByBridge = bridgeSet.has(colA) || (colB !== undefined && bridgeSet.has(colB));
      const isBlockedByFunnel = funnelSet.has(colA) || (colB !== undefined && funnelSet.has(colB));

      hatches.push({
        hatchIndex: h,
        colA,
        colB,
        bay20A,
        bay20B,
        fromSternA,
        fromSternB,
        centerFromStern,
        length40,
        length20: cellWidth,
        isBlockedByBridge,
        isBlockedByFunnel,
        colABlocked,
        colBBlocked,
      });
    }
  }

  return {
    loa,
    beam,
    bays,
    cellWidth,
    hatchGap,
    bowInset,
    deckLeft,
    deckRight,
    isAllAft,
    bridgeCenterFromStern,
    bridgeLength,
    hasSeparateFunnel: Boolean(config.separateFunnel),
    funnelCenterFromStern,
    funnelLength,
    bridgeIndices,
    funnelIndices,
    hatches,
    bayCellFromStern,
  };
}

export type PortainerCategory = "super-post-panamax" | "post-panamax";

export interface Portainer {
  id: string; // P4, P5, P6, P7, P8, P9
  name: string;
  manufacturer?: string; // "ZPMC"
  category?: PortainerCategory; // "super-post-panamax" (P8, P9) | "post-panamax" (P4, P5, P6, P7)
  position: number;
  color: string;
  badgeColor: string;
  enabled: boolean;
  boomOutreach?: number; // Alcance útil da lança sobre o mar medido a partir do trilho marítimo (m)
  boomHeight?: number; // Altura livre sob a lança a partir da cota do trilho/cais (m)
}

export const DEFAULT_PORTAINERS: Portainer[] = [
  { id: "P7", name: "P7", manufacturer: "ZPMC", category: "post-panamax", position: 175, color: "#65a30d", badgeColor: "#4d7c0f", enabled: true, boomOutreach: 60, boomHeight: 44 },
  { id: "P6", name: "P6", manufacturer: "ZPMC", category: "post-panamax", position: 215, color: "#65a30d", badgeColor: "#4d7c0f", enabled: true, boomOutreach: 60, boomHeight: 44 },
  { id: "P9", name: "P9", manufacturer: "ZPMC", category: "super-post-panamax", position: 255, color: "#ea580c", badgeColor: "#c2410c", enabled: true, boomOutreach: 65, boomHeight: 48 },
  { id: "P8", name: "P8", manufacturer: "ZPMC", category: "super-post-panamax", position: 295, color: "#ea580c", badgeColor: "#c2410c", enabled: true, boomOutreach: 65, boomHeight: 48 },
  { id: "P5", name: "P5", manufacturer: "ZPMC", category: "post-panamax", position: 640, color: "#65a30d", badgeColor: "#4d7c0f", enabled: true, boomOutreach: 52, boomHeight: 40 },
  { id: "P4", name: "P4", manufacturer: "ZPMC", category: "post-panamax", position: 695, color: "#65a30d", badgeColor: "#4d7c0f", enabled: true, boomOutreach: 52, boomHeight: 40 },
];

export interface PortainerLimit {
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

/** Retorna os limites operacionais de deslocamento dos portêineres (P7 não passa de 309; P8 e P6 não passam de 291-290; P5 não passa de 297-296; P4 não passa de 279). */
export function getPortainerOperationalLimits(bollards: Bollard[]): Record<string, PortainerLimit> {
  const b309 = bollards.find((b) => b.id === "309")?.position ?? 12.0;

  const b297 = bollards.find((b) => b.id === "297")?.position ?? 276.9;
  const b296 = bollards.find((b) => b.id === "296")?.position ?? 306.9;
  const p5Min = Number(((b297 + b296) / 2).toFixed(1)); // Ponto médio entre 297 e 296

  const b291 = bollards.find((b) => b.id === "291")?.position ?? 443.9;
  const b290 = bollards.find((b) => b.id === "290")?.position ?? 473.9;
  const p6Max = Number(((b291 + b290) / 2).toFixed(1)); // Ponto médio entre 291 e 290

  const b279 = bollards.find((b) => b.id === "279")?.position ?? 771.4;

  return {
    P7: {
      min: b309,
      minLabel: `Cabeço 309 (${b309.toFixed(1).replace(".", ",")} m)`,
    },
    P8: {
      max: p6Max,
      maxLabel: `Cabeços 291–290 (${p6Max.toFixed(1).replace(".", ",")} m)`,
    },
    P5: {
      min: p5Min,
      minLabel: `Cabeços 297–296 (${p5Min.toFixed(1).replace(".", ",")} m)`,
    },
    P6: {
      max: p6Max,
      maxLabel: `Cabeços 291–290 (${p6Max.toFixed(1).replace(".", ",")} m)`,
    },
    P4: {
      max: b279,
      maxLabel: `Cabeço 279 (${b279.toFixed(1).replace(".", ",")} m)`,
    },
  };
}

/** Ordem física fixa dos portêineres ao longo do cais (do início para o fim: P7 < P6 < P9 < P8 < P5 < P4). */
export const PORTAINER_TRACK_ORDER = ["P7", "P6", "P9", "P8", "P5", "P4"] as const;

/** Distância mínima segura de centro a centro entre portêineres adjacentes (largura física dos pórticos com amortecedores). */
export const PORTAINER_MIN_SPACING = 27;

/** Aplica a trava de limite do portêiner:
 * 1. Não permite passar dos limites operacionais de trecho (P5, P6, P4).
 * 2. Bloqueia a passagem física sobre outros portêineres parados nos mesmos trilhos (distância mínima de 27 m).
 */
export function clampPortainerPosition(
  id: string,
  rawPosition: number,
  bollards: Bollard[],
  totalQuay: number,
  portainers?: Array<{ id: string; position: number; name?: string; enabled?: boolean }>,
): { position: number; hitLimit: boolean; message?: string } {
  const limits = getPortainerOperationalLimits(bollards)[id];
  let position = Math.max(0, Math.min(totalQuay, rawPosition));
  let hitLimit = false;
  let message: string | undefined;

  // 1. Limites operacionais de cais
  if (limits?.min !== undefined && position < limits.min) {
    position = limits.min;
    hitLimit = true;
    message = limits.minLabel
      ? `Limite do Portêiner ${id}: o ${id} não pode passar de ${limits.minLabel}.`
      : `Limite do Portêiner ${id}: estação mínima ${limits.min.toFixed(1).replace(".", ",")} m.`;
  } else if (limits?.max !== undefined && position > limits.max) {
    position = limits.max;
    hitLimit = true;
    message = limits.maxLabel
      ? `Limite do Portêiner ${id}: o ${id} não pode passar de ${limits.maxLabel}.`
      : `Limite do Portêiner ${id}: estação máxima ${limits.max.toFixed(1).replace(".", ",")} m.`;
  }

  // 2. Bloqueio físico de trilho entre portêineres (um não pode atravessar o outro)
  if (portainers && portainers.length > 1) {
    const current = portainers.find((p) => p.id === id);
    const currPos = current ? current.position : position;
    const currentName = current?.name || id;
    const myOrderIndex = PORTAINER_TRACK_ORDER.indexOf(id as (typeof PORTAINER_TRACK_ORDER)[number]);

    let leftBlocker: { id: string; position: number; name?: string } | null = null;
    let rightBlocker: { id: string; position: number; name?: string } | null = null;
    let maxLeftLimit = -Infinity;
    let minRightLimit = Infinity;

    for (const other of portainers) {
      if (other.id === id) continue;

      let isLeft = false;
      const otherOrderIndex = PORTAINER_TRACK_ORDER.indexOf(other.id as (typeof PORTAINER_TRACK_ORDER)[number]);

      if (myOrderIndex !== -1 && otherOrderIndex !== -1) {
        isLeft = otherOrderIndex < myOrderIndex;
      } else {
        isLeft = other.position < currPos;
      }

      if (isLeft) {
        const limit = other.position + PORTAINER_MIN_SPACING;
        if (limit > maxLeftLimit) {
          maxLeftLimit = limit;
          leftBlocker = other;
        }
      } else {
        const limit = other.position - PORTAINER_MIN_SPACING;
        if (limit < minRightLimit) {
          minRightLimit = limit;
          rightBlocker = other;
        }
      }
    }

    if (leftBlocker && position < maxLeftLimit) {
      position = maxLeftLimit;
      hitLimit = true;
      const bName = leftBlocker.name || leftBlocker.id;
      message = `Bloqueio nos trilhos: o Portêiner ${currentName} não pode atravessar o Portêiner ${bName} (distância mínima: ${PORTAINER_MIN_SPACING} m).`;
    } else if (rightBlocker && position > minRightLimit) {
      position = minRightLimit;
      hitLimit = true;
      const bName = rightBlocker.name || rightBlocker.id;
      message = `Bloqueio nos trilhos: o Portêiner ${currentName} não pode atravessar o Portêiner ${bName} (distância mínima: ${PORTAINER_MIN_SPACING} m).`;
    }
  }

  return { position: Number(position.toFixed(1)), hitLimit, message };
}

export const QUAY_CRANE_SETBACK = 4.0; // Recuo operacional do cais + defensas marítimas + folga offshore (~3,5 a 4,0 m)

export interface PortainerIncompatibility {
  portainer: Portainer;
  vessel: Vessel;
  deficit: number;
  boomOutreach: number;
  vesselBeam: number;
  heightDeficit?: number;
  requiredHeight?: number;
  boomHeight?: number;
  message: string;
}

/** Verifica se um portêiner posicionado sobre um navio possui lança curta ou altura insuficiente */
export function checkPortainerIncompatibility(
  portainer: Portainer,
  vessels: Vessel[]
): PortainerIncompatibility | null {
  const boomOutreach = portainer.boomOutreach ?? 55;
  for (const vessel of vessels) {
    const vesselEnd = vessel.position + vessel.loa;
    // Verifica se o portêiner está posicionado sobre a extensão do navio
    if (portainer.position >= vessel.position && portainer.position <= vesselEnd) {
      const requiredReach = Number((vessel.beam + QUAY_CRANE_SETBACK).toFixed(1));

      // Incompatível se a lança não cobrir a boca considerando o recuo do cais e defensas
      if (vessel.beam > 0 && (boomOutreach < requiredReach || boomOutreach <= vessel.beam)) {
        const rawDeficit = Math.max(vessel.beam - boomOutreach, requiredReach - boomOutreach);
        const deficit = Number(rawDeficit.toFixed(1));
        const tiers = normalizeTierCount(vessel.tierCount ?? vessel.tiers) ?? defaultTierCountForBeam(vessel.beam);
        const estimatedDraft = vessel.draft > 0 ? vessel.draft : 10;
        const deckHeightAboveQuay = Math.max(7, estimatedDraft * 0.9 - 1);
        const requiredHeight = deckHeightAboveQuay + tiers * 2.6 + 3.8;
        const heightDeficit = portainer.boomHeight && portainer.boomHeight < requiredHeight
          ? Number((requiredHeight - portainer.boomHeight).toFixed(1))
          : undefined;

        return {
          portainer,
          vessel,
          deficit,
          boomOutreach,
          vesselBeam: vessel.beam,
          heightDeficit,
          requiredHeight,
          boomHeight: portainer.boomHeight,
          message: `Lança curta: faltam ${deficit.toFixed(1)} m na boca (${vessel.name})`,
        };
      }
    }
  }
  return null;
}

export interface Scenario {
  name: string;
  clearance: number;
  segments: BerthSegment[];
  vessels: Vessel[];
  bollards: Bollard[];
  portainers?: Portainer[];
  showPortainers?: boolean;
}

export interface BerthIssue {
  vesselId: string;
  kind: "edge" | "spacing" | "overlap" | "equipment";
  message: string;
}

export const STORAGE_KEY = "caislab:scenario:v6";

export const VESSEL_COLORS: Record<VesselColor, { label: string; fill: string; stroke: string; accent: string }> = {
  blue: { label: "Azul", fill: "#3f779b", stroke: "#285a78", accent: "#b9dce9" },
  teal: { label: "Petróleo", fill: "#2f8b89", stroke: "#216c6b", accent: "#b8e5dc" },
  orange: { label: "Âmbar", fill: "#d17a3d", stroke: "#a85a2b", accent: "#f3d2b5" },
  violet: { label: "Violeta", fill: "#7769a5", stroke: "#594e83", accent: "#d5ceed" },
};

export const CONTAINER_COLORS = ["#d8e7e7", "#bdd8dd", "#e5c5a4", "#b7c7d0", "#c8d1ae", "#f0dfb5"];

const MOORING_TYPES = Object.keys(MOORING_LINE_LABELS) as MooringLineType[];

export function defaultMooringOffset(type: MooringLineType, loa: number) {
  switch (type) {
    case "lancante-popa":
      return 0;
    case "spring-popa":
      return loa * 0.04;
    case "spring-proa":
      return loa * 0.84;
    case "lancante-proa":
    default:
      return loa;
  }
}

export function mooringOffsetLimits(type: MooringLineType, loa: number) {
  return type.endsWith("proa")
    ? { min: loa * 0.6, max: loa }
    : { min: 0, max: loa * 0.4 };
}

/** Keeps bow cables in the forward third and stern cables in the aft third. */
export function normalizeMooringOffset(type: MooringLineType, loa: number, offset: number | null) {
  const limits = mooringOffsetLimits(type, loa);
  if (offset === null || !Number.isFinite(offset) || offset < limits.min || offset > limits.max) {
    return defaultMooringOffset(type, loa);
  }
  return offset;
}

/** Position from the left endpoint of the berth view, given a station from the stern. */
export function berthwiseOffsetFromStern(loa: number, side: BerthingSide, offsetFromStern: number) {
  return side === "bombordo" ? loa - offsetFromStern : offsetFromStern;
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
}

export const DEFAULT_BOLLARD_CONFIG: { id: string; distanceToNext: number; type: BollardType; image?: string }[] = [
  { id: "309", distanceToNext: 19.8, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "308", distanceToNext: 19.8, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "307", distanceToNext: 19.8, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "306", distanceToNext: 19.8, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "305", distanceToNext: 10.7, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "304", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "303", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "302", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "301", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "300", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "299", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "298", distanceToNext: 25.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "297", distanceToNext: 30.0, type: "duplo", image: getAssetUrl("bollards/cabeco-duplos.png") },
  { id: "296", distanceToNext: 26.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "295", distanceToNext: 30.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "294", distanceToNext: 26.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "293", distanceToNext: 30.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "292", distanceToNext: 25.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "291", distanceToNext: 30.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "290", distanceToNext: 26.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "289", distanceToNext: 30.0, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "288", distanceToNext: 38.0, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "287", distanceToNext: 25.5, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "286", distanceToNext: 25.0, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "285", distanceToNext: 26.0, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "284", distanceToNext: 25.0, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "283", distanceToNext: 25.0, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "282", distanceToNext: 26.0, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "281", distanceToNext: 25.5, type: "alto-novo", image: getAssetUrl("bollards/cabecos-baixo-novo.png") },
  { id: "280", distanceToNext: 25.5, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "279", distanceToNext: 25.5, type: "alto-novo", image: getAssetUrl("bollards/cabeco-simples.png") },
  { id: "278", distanceToNext: 26.5, type: "baixo-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
  { id: "277", distanceToNext: 0, type: "alto-antigo", image: getAssetUrl("bollards/cabecos-baixo-antigo.png") },
];

export function createBollardInventory(): Bollard[] {
  let currentPos = 12.0;
  return DEFAULT_BOLLARD_CONFIG.map((item) => {
    const bollard: Bollard = {
      id: item.id,
      position: Number(currentPos.toFixed(1)),
      type: item.type,
      image: CABECO_SIMPLES_IDS.has(item.id)
        ? getAssetUrl("bollards/cabeco-simples.png")
        : CABECO_DUPLO_IDS.has(item.id)
        ? getAssetUrl("bollards/cabeco-duplos.png")
        : CABECO_BAIXO_ANTIGO_IDS.has(item.id)
        ? getAssetUrl("bollards/cabecos-baixo-antigo.png")
        : CABECO_BAIXO_NOVO_IDS.has(item.id)
        ? getAssetUrl("bollards/cabecos-baixo-novo.png")
        : item.image,
    };
    currentPos += item.distanceToNext;
    return bollard;
  });
}

export interface BollardDisplayPosition {
  id: string;
  position: number;
  estimated: boolean;
  type?: BollardType;
  image?: string;
}

/** Unpositioned bollards get schematic display slots only; their saved position remains null. */
export function bollardDisplayPositions(bollards: Bollard[], quayLength: number): BollardDisplayPosition[] {
  if (!Number.isFinite(quayLength) || quayLength <= 0) return [];
  const lastIndex = Math.max(1, bollards.length - 1);
  const positions: BollardDisplayPosition[] = [];
  bollards.forEach((bollard, index) => {
    const image = bollard.image || (
      CABECO_SIMPLES_IDS.has(bollard.id)
        ? getAssetUrl("bollards/cabeco-simples.png")
        : CABECO_DUPLO_IDS.has(bollard.id)
        ? getAssetUrl("bollards/cabeco-duplos.png")
        : CABECO_BAIXO_ANTIGO_IDS.has(bollard.id)
        ? getAssetUrl("bollards/cabecos-baixo-antigo.png")
        : CABECO_BAIXO_NOVO_IDS.has(bollard.id)
        ? getAssetUrl("bollards/cabecos-baixo-novo.png")
        : undefined
    );
    if (bollard.position !== null) {
      if (bollard.position <= quayLength) positions.push({ id: bollard.id, position: bollard.position, estimated: false, type: bollard.type, image });
      return;
    }
    positions.push({
      id: bollard.id,
      position: bollards.length <= 1 ? quayLength / 2 : (index / lastIndex) * quayLength,
      estimated: true,
      type: bollard.type,
      image,
    });
  });
  return positions;
}

function splitDelimitedRow(row: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function serializeBollardCsv(bollards: Bollard[]) {
  const quote = (value: string) => /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const rows = ["identificador;posicao_m", ...bollards.map((bollard) => `${quote(bollard.id)};${bollard.position === null ? "" : bollard.position.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 1 })}`)];
  return `\uFEFF${rows.join("\r\n")}`;
}

export function parseBollardCsv(content: string, quayLength: number): Bollard[] {
  const rows = content.replace(/^\uFEFF/, "").split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length === 0) return [];
  const delimiter = rows[0].includes(";") ? ";" : rows[0].includes("\t") ? "\t" : ",";
  const updates: Bollard[] = [];
  for (const [index, row] of rows.entries()) {
    const [id = "", rawPosition = ""] = splitDelimitedRow(row, delimiter);
    if (index === 0 && /identificador|cabe[cç]o|^id$/i.test(id) && /posi[cç]|metro|station/i.test(rawPosition)) continue;
    if (!rawPosition) continue;
    if (!id) throw new Error(`Linha ${index + 1}: informe o identificador do cabeço.`);
    const position = Number(rawPosition.replace(",", "."));
    if (!Number.isFinite(position) || position < 0 || position > quayLength) {
      const max = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(quayLength);
      throw new Error(`Linha ${index + 1}: a posição precisa estar entre 0 e ${max} m.`);
    }
    updates.push({ id, position });
  }
  if (new Set(updates.map((item) => item.id)).size !== updates.length) throw new Error("O CSV contém identificadores de cabeço repetidos.");
  return updates;
}

export function createDemoScenario(): Scenario {
  return {
    name: "Plano de atracação",
    clearance: 15,
    segments: [
      { id: "segment-expansao", name: "Expansão", length: 85 },
      { id: "segment-prolongamento", name: "Prolongamento", length: 430 },
      { id: "segment-tecon", name: "Tecon 1", length: 385 },
    ],
    vessels: [],
    bollards: createBollardInventory(),
    portainers: DEFAULT_PORTAINERS.map((p) => ({ ...p })),
    showPortainers: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMooringLineType(value: unknown): value is MooringLineType {
  return typeof value === "string" && MOORING_TYPES.includes(value as MooringLineType);
}

/** Normaliza cenários novos e versões antigas, que não tinham cabeços nem escada. */
export function normalizeScenario(value: unknown): Scenario | null {
  if (!isRecord(value) || typeof value.name !== "string" || !Array.isArray(value.segments) || !Array.isArray(value.vessels)) return null;
  if (typeof value.clearance !== "number" || !Number.isFinite(value.clearance)) return null;

  const segments: BerthSegment[] = [];
  for (const [index, raw] of value.segments.entries()) {
    if (!isRecord(raw) || typeof raw.name !== "string" || typeof raw.length !== "number" || !Number.isFinite(raw.length)) return null;
    segments.push({ id: typeof raw.id === "string" && raw.id ? raw.id : makeId("trecho"), name: raw.name, length: Math.max(1, raw.length) });
  }

  const vessels: Vessel[] = [];
  for (const [index, raw] of value.vessels.entries()) {
    if (!isRecord(raw) || typeof raw.name !== "string" || typeof raw.loa !== "number" || !Number.isFinite(raw.loa) || typeof raw.position !== "number" || !Number.isFinite(raw.position)) return null;
    const loa = Math.max(1, raw.loa);
    const rawLines = Array.isArray(raw.mooringLines) ? raw.mooringLines : [];
    const mooringLines: MooringLine[] = rawLines.flatMap((candidate, lineIndex) => {
      if (!isRecord(candidate) || !isMooringLineType(candidate.type)) return [];
      const shipOffset = normalizeMooringOffset(
        candidate.type,
        loa,
        typeof candidate.shipOffset === "number" && Number.isFinite(candidate.shipOffset) ? candidate.shipOffset : null,
      );
      return [{
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : makeId(`cabo-${lineIndex}`),
        type: candidate.type,
        shipOffset,
        bollardId: typeof candidate.bollardId === "string" ? candidate.bollardId : null,
      }];
    });
    const color = typeof raw.color === "string" && Object.prototype.hasOwnProperty.call(VESSEL_COLORS, raw.color)
      ? raw.color as VesselColor
      : (["blue", "teal", "orange", "violet"] as VesselColor[])[index % 4];
    const gangway = typeof raw.gangwayOffset === "number" && Number.isFinite(raw.gangwayOffset) ? raw.gangwayOffset : loa / 2;
    const vesselType = normalizeVesselType(
      typeof raw.vesselType === "string" ? raw.vesselType : typeof raw.type === "string" ? raw.type : undefined,
      raw.name,
    );
    const upperName = (raw.name ?? "").toUpperCase().trim();
    const isFortaleza = upperName.includes("FORTALEZA");
    const knownDefault = KNOWN_VESSEL_DEFAULTS[upperName] ??
      (upperName.includes("VERACRUZ") ? KNOWN_VESSEL_DEFAULTS["CMA CGM VERACRUZ"] :
      isFortaleza ? (KNOWN_VESSEL_DEFAULTS[upperName] ?? KNOWN_VESSEL_DEFAULTS["MERCOSUL FORTALEZA"]) :
      (upperName.includes("COSCO") && (upperName.includes("CHILE") || upperName.includes("BRAZIL") || upperName.includes("BRASIL") || upperName.includes("ARGENTINA") || upperName.includes("URUGUAY"))) ? (KNOWN_VESSEL_DEFAULTS[upperName] ?? KNOWN_VESSEL_DEFAULTS["COSCO SHIPPING BRAZIL"]) :
      (upperName.includes("EVER") && (upperName.includes("FIT") || upperName.includes("FAR") || upperName.includes("FAME") || upperName.includes("FASHION") || upperName.includes("FORTUNE"))) ? (KNOWN_VESSEL_DEFAULTS[upperName] ?? KNOWN_VESSEL_DEFAULTS["EVER FIT"]) :
      upperName.includes("PANTANAL") ? KNOWN_VESSEL_DEFAULTS["LOG-IN PANTANAL"] :
      upperName.includes("BRISA") ? KNOWN_VESSEL_DEFAULTS["NC BRISA"] :
      upperName.includes("SPYROS") ? KNOWN_VESSEL_DEFAULTS["SPYROS V"] : undefined);

    // Para navios com layout calibrado manualmente (isManualLayout), os valores do knownDefault
    // sempre prevalecem sobre dados salvos em cache (sessionStorage), garantindo que correções no
    // catálogo sejam aplicadas imediatamente sem precisar limpar o cache do navegador.
    const isManualLayoutVessel = Boolean((knownDefault as any)?.isManualLayout) || Boolean(knownDefault?.bayCount);
    const rawBayCount = isManualLayoutVessel && knownDefault?.bayCount
      ? knownDefault.bayCount
      : (raw as any).bayCount ?? (raw as any).maxBayNumber ?? raw.bays;
    const bayCount = normalizeBayCount(rawBayCount !== undefined ? rawBayCount : knownDefault?.bayCount);
    const rawRowCount = isManualLayoutVessel && knownDefault?.rowCount
      ? knownDefault.rowCount
      : (raw as any).rowCount ?? raw.rows;
    const rowCount = isFortaleza
      ? 14
      : normalizeRowCount(rawRowCount !== undefined ? rawRowCount : knownDefault?.rowCount);
    const rawTierCount = isManualLayoutVessel && knownDefault?.tierCount
      ? knownDefault.tierCount
      : (raw as any).tierCount ?? raw.tiers;
    const tierCount = isFortaleza
      ? 5
      : normalizeTierCount(rawTierCount !== undefined ? rawTierCount : knownDefault?.tierCount);
    const hasExplicitBridge = typeof (raw as any).bridgeBay === "number" || typeof (raw as any).bridgeBayStart === "number";
    const bridgePosition = isFortaleza
      ? "all-aft"
      : (isManualLayoutVessel && knownDefault?.bridgePosition
      ? knownDefault.bridgePosition
      : (raw as any).bridgePosition === "between-bays"
      ? "between-bays"
      : hasExplicitBridge
      ? ((raw as any).bridgePosition ?? "all-aft")
      : (knownDefault?.bridgePosition ?? (raw as any).bridgePosition ?? "all-aft"));
    const bridgeBay = (isManualLayoutVessel && knownDefault?.bridgeBay !== undefined)
      ? knownDefault.bridgeBay
      : typeof (raw as any).bridgeBay === "number"
      ? (raw as any).bridgeBay
      : typeof (raw as any).bridgeBayStart === "number"
      ? (raw as any).bridgeBayStart
      : knownDefault?.bridgeBay;
    const bridgeBayStart = (isManualLayoutVessel && knownDefault?.bridgeBayStart !== undefined)
      ? knownDefault.bridgeBayStart
      : typeof (raw as any).bridgeBayStart === "number"
      ? (raw as any).bridgeBayStart
      : bridgeBay ?? knownDefault?.bridgeBayStart;
    const bridgeBayEnd = (isManualLayoutVessel && knownDefault?.bridgeBayEnd !== undefined)
      ? knownDefault.bridgeBayEnd
      : typeof (raw as any).bridgeBayEnd === "number"
      ? (raw as any).bridgeBayEnd
      : bridgeBay ?? knownDefault?.bridgeBayEnd;
    const separateFunnel = isManualLayoutVessel && knownDefault?.separateFunnel !== undefined
      ? Boolean(knownDefault.separateFunnel)
      : (raw as any).separateFunnel !== undefined
      ? Boolean((raw as any).separateFunnel)
      : Boolean(knownDefault?.separateFunnel);
    const funnelBay = (isManualLayoutVessel && knownDefault?.funnelBay !== undefined)
      ? knownDefault.funnelBay
      : typeof (raw as any).funnelBay === "number"
      ? (raw as any).funnelBay
      : typeof (raw as any).funnelBayStart === "number"
      ? (raw as any).funnelBayStart
      : knownDefault?.funnelBay;
    const funnelBayStart = (isManualLayoutVessel && knownDefault?.funnelBayStart !== undefined)
      ? knownDefault.funnelBayStart
      : typeof (raw as any).funnelBayStart === "number"
      ? (raw as any).funnelBayStart
      : funnelBay ?? knownDefault?.funnelBayStart;
    const funnelBayEnd = (isManualLayoutVessel && knownDefault?.funnelBayEnd !== undefined)
      ? knownDefault.funnelBayEnd
      : typeof (raw as any).funnelBayEnd === "number"
      ? (raw as any).funnelBayEnd
      : funnelBay ?? knownDefault?.funnelBayEnd;

    vessels.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId("navio"),
      name: raw.name,
      loa,
      beam: typeof raw.beam === "number" && Number.isFinite(raw.beam) ? Math.max(0, raw.beam) : (knownDefault?.beam ?? 0),
      draft: typeof raw.draft === "number" && Number.isFinite(raw.draft) ? Math.max(0, raw.draft) : (knownDefault?.draft ?? 0),
      position: raw.position,
      berthingSide: raw.berthingSide === "bombordo" || raw.berthingSide === "boreste" ? raw.berthingSide : "boreste",
      gangwayOffset: Math.min(loa, Math.max(0, gangway)),
      mooringLines,
      color,
      vesselType,
      bayCount,
      bays: bayCount,
      rowCount,
      rows: rowCount,
      tierCount,
      tiers: tierCount,
      bridgePosition,
      bridgeBay,
      bridgeBayStart,
      bridgeBayEnd,
      separateFunnel,
      funnelBay,
      funnelBayStart,
      funnelBayEnd,
      imageUrl: typeof (raw as any).imageUrl === "string" ? (raw as any).imageUrl : (raw.name?.trim().toUpperCase() === "MAERSK FREEPORT" ? "/vessels/maersk_freeport.jpg" : (knownDefault as any)?.imageUrl),
      marineTrafficUrl: typeof (raw as any).marineTrafficUrl === "string" ? (raw as any).marineTrafficUrl : (raw.name?.trim().toUpperCase() === "MAERSK FREEPORT" ? "https://www.marinetraffic.com/en/ais/details/ships/shipid:8941589" : (knownDefault as any)?.marineTrafficUrl),
    });
  }

    const has309 = Array.isArray(value.bollards) &&
      value.bollards.some((b: unknown) => isRecord(b) && b.id === "309");
    const has277 = Array.isArray(value.bollards) &&
      value.bollards.some((b: unknown) => isRecord(b) && b.id === "277");

    let bollards: Bollard[];
    if (!has309 || !has277) {
      bollards = createBollardInventory();
    } else {
      bollards = (value.bollards as unknown[]).flatMap((raw) => {
        if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return [];
        const position = typeof raw.position === "number" && Number.isFinite(raw.position) && raw.position >= 0 ? raw.position : null;
        const type = (typeof raw.type === "string" && Object.prototype.hasOwnProperty.call(BOLLARD_TYPES, raw.type))
          ? (raw.type as BollardType)
          : undefined;
        const def = DEFAULT_BOLLARD_CONFIG.find((d) => d.id === raw.id);
        const image = CABECO_SIMPLES_IDS.has(raw.id)
          ? getAssetUrl("bollards/cabeco-simples.png")
          : CABECO_DUPLO_IDS.has(raw.id)
          ? getAssetUrl("bollards/cabeco-duplos.png")
          : CABECO_BAIXO_ANTIGO_IDS.has(raw.id)
          ? getAssetUrl("bollards/cabecos-baixo-antigo.png")
          : CABECO_BAIXO_NOVO_IDS.has(raw.id)
          ? getAssetUrl("bollards/cabecos-baixo-novo.png")
          : (typeof raw.image === "string" ? raw.image : def?.image);
        return [{ id: raw.id, position, type, image }];
      });
    }

    // Normalizar Portêineres (P4, P5, P6, P7, P8, P9)
    const showPortainers = typeof value.showPortainers === "boolean" ? value.showPortainers : true;
    let portainers: Portainer[] = [];
    if (Array.isArray(value.portainers) && value.portainers.length > 0) {
      portainers = (value.portainers as unknown[]).flatMap((raw) => {
        if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return [];
        const def = DEFAULT_PORTAINERS.find((p) => p.id === raw.id);
        const pos = typeof raw.position === "number" && Number.isFinite(raw.position) ? Math.max(0, raw.position) : (def?.position ?? 150);
        const boomOutreach = typeof raw.boomOutreach === "number" && Number.isFinite(raw.boomOutreach) ? Math.max(20, Math.min(90, raw.boomOutreach)) : (def?.boomOutreach ?? 55);
        const boomHeight = typeof raw.boomHeight === "number" && Number.isFinite(raw.boomHeight) ? Math.max(15, Math.min(80, raw.boomHeight)) : (def?.boomHeight ?? 42);
        const manufacturer = typeof raw.manufacturer === "string" ? raw.manufacturer : (def?.manufacturer ?? "ZPMC");
        const category = raw.category === "super-post-panamax" || raw.category === "post-panamax" ? raw.category : (def?.category ?? "post-panamax");
        return [{
          id: raw.id,
          name: typeof raw.name === "string" ? raw.name : raw.id,
          manufacturer,
          category,
          position: pos,
          color: (raw.id === "P8" || raw.id === "P9") ? "#ea580c" : (["P4", "P5", "P6", "P7"].includes(raw.id) ? "#65a30d" : (def?.color ?? "#65a30d")),
          badgeColor: (raw.id === "P8" || raw.id === "P9") ? "#c2410c" : (["P4", "P5", "P6", "P7"].includes(raw.id) ? "#4d7c0f" : (def?.badgeColor ?? "#4d7c0f")),
          enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
          boomOutreach,
          boomHeight,
        }];
      });
      DEFAULT_PORTAINERS.forEach((def) => {
        if (!portainers.some((p) => p.id === def.id)) {
          portainers.push({ ...def });
        }
      });
    } else {
      portainers = DEFAULT_PORTAINERS.map((p) => ({ ...p }));
    }

  return {
    name: value.name,
    clearance: Math.max(0, value.clearance),
    segments,
    vessels,
    bollards,
    portainers,
    showPortainers,
  };
}

export function readScenario(): Scenario {
  if (typeof window === "undefined") return createDemoScenario();
  try {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem("caislab:scenario:v5");
      window.localStorage.removeItem("caislab:scenario:v6");
    } catch {}

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoScenario();
    const scenario = normalizeScenario(JSON.parse(raw));
    if (!scenario) return createDemoScenario();
    // Ensure bollards match the 33 bollards with exact measurements and types from the port plan
    const b277 = scenario.bollards.find((b) => b.id === "277");
    const b288 = scenario.bollards.find((b) => b.id === "288");
    const b289 = scenario.bollards.find((b) => b.id === "289");
    if (!b277 || !b288 || !b289 || b289.type !== "baixo-antigo" || b277.type !== "alto-antigo" || Math.abs((b277.position ?? 0) - 823.4) > 1.0) {
      scenario.bollards = createBollardInventory();
    } else {
      scenario.bollards.forEach((b) => {
        if (CABECO_SIMPLES_IDS.has(b.id) && b.image !== getAssetUrl("bollards/cabeco-simples.png")) {
          b.image = getAssetUrl("bollards/cabeco-simples.png");
        } else if (CABECO_DUPLO_IDS.has(b.id) && b.image !== getAssetUrl("bollards/cabeco-duplos.png")) {
          b.image = getAssetUrl("bollards/cabeco-duplos.png");
        } else if (CABECO_BAIXO_ANTIGO_IDS.has(b.id) && b.image !== getAssetUrl("bollards/cabecos-baixo-antigo.png")) {
          b.image = getAssetUrl("bollards/cabecos-baixo-antigo.png");
        } else if (CABECO_BAIXO_NOVO_IDS.has(b.id) && b.image !== getAssetUrl("bollards/cabecos-baixo-novo.png")) {
          b.image = getAssetUrl("bollards/cabecos-baixo-novo.png");
        }
      });
    }
    return scenario;
  } catch {
    return createDemoScenario();
  }
}

export function totalQuayLength(segments: BerthSegment[]) {
  return segments.reduce((sum, segment) => sum + Math.max(0, segment.length || 0), 0);
}

export function totalShipLength(vessels: Vessel[]) {
  return vessels.reduce((sum, vessel) => sum + Math.max(0, vessel.loa || 0), 0);
}

export function minimumRequiredLength(vessels: Vessel[], clearance: number) {
  if (!vessels.length) return 0;
  return totalShipLength(vessels) + Math.max(0, clearance) * (vessels.length + 1);
}

export function remainingLength(segments: BerthSegment[], vessels: Vessel[], clearance: number) {
  return totalQuayLength(segments) - minimumRequiredLength(vessels, clearance);
}

export function calculateIssues(scenario: Scenario): BerthIssue[] {
  const total = totalQuayLength(scenario.segments);
  const margin = Math.max(0, scenario.clearance);
  const issues: BerthIssue[] = [];
  const ordered = [...scenario.vessels].sort((a, b) => a.position - b.position);

  for (const vessel of ordered) {
    if (vessel.position < margin) {
      issues.push({ vesselId: vessel.id, kind: "edge", message: `Menos de ${margin} m de margem no início do cais` });
    }
    if (vessel.position + vessel.loa > total - margin) {
      issues.push({ vesselId: vessel.id, kind: "edge", message: `Menos de ${margin} m de margem no final do cais` });
    }
  }

  for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < ordered.length; secondIndex += 1) {
      const previous = ordered[firstIndex];
      const current = ordered[secondIndex];
      const gap = current.position - (previous.position + previous.loa);
      if (gap < 0) {
        issues.push({ vesselId: current.id, kind: "overlap", message: `Sobreposição de ${Math.abs(gap).toFixed(0)} m com ${previous.name}` });
        issues.push({ vesselId: previous.id, kind: "overlap", message: `Sobreposição de ${Math.abs(gap).toFixed(0)} m com ${current.name}` });
      } else if (secondIndex === firstIndex + 1 && gap < margin) {
        issues.push({
          vesselId: current.id,
          kind: "spacing",
          message: `Afastamento de ${gap.toFixed(0)} m para ${previous.name}; mínimo configurado: ${margin} m`,
        });
      }
    }
  }

  // Verificação de interferência e capacidade de portêineres sobre navios porta-contêineres
  if (scenario.showPortainers !== false && Array.isArray(scenario.portainers)) {
    const activePortainers = scenario.portainers.filter((p) => p.enabled);
    for (const portainer of activePortainers) {
      for (const vessel of scenario.vessels) {
        if (vessel.vesselType && vessel.vesselType !== "container") continue;
        const vesselEnd = vessel.position + vessel.loa;
        if (portainer.position >= vessel.position && portainer.position <= vesselEnd) {
          const tiers = normalizeTierCount(vessel.tierCount ?? vessel.tiers) ?? defaultTierCountForBeam(vessel.beam);
          const estimatedDraft = vessel.draft > 0 ? vessel.draft : 10;
          const deckHeightAboveQuay = Math.max(7, estimatedDraft * 0.9 - 1);
          const requiredHeight = deckHeightAboveQuay + tiers * 2.6 + 3.8;

          if (portainer.boomHeight && portainer.boomHeight < requiredHeight) {
            issues.push({
              vesselId: vessel.id,
              kind: "equipment",
              message: `Portêiner ${portainer.name} (altura ${portainer.boomHeight} m) insuficiente para a pilha de ${tiers} tiers do ${vessel.name} (necessário ~${requiredHeight.toFixed(1)} m sob a lança)`,
            });
          }

          if (portainer.boomOutreach && vessel.beam > 0 && (portainer.boomOutreach < (vessel.beam + QUAY_CRANE_SETBACK) || portainer.boomOutreach <= vessel.beam)) {
            const deficit = Number(Math.max(vessel.beam - portainer.boomOutreach, vessel.beam + QUAY_CRANE_SETBACK - portainer.boomOutreach).toFixed(1));
            issues.push({
              vesselId: vessel.id,
              kind: "equipment",
              message: `Portêiner ${portainer.name} com lança curta para o ${vessel.name} (faltam ${deficit.toFixed(1)} m na boca)`,
            });
          }
        }
      }
    }
  }

  return issues;
}

export function segmentOffsets(segments: BerthSegment[]) {
  let current = 0;
  return segments.map((segment) => {
    const item = { ...segment, start: current, end: current + Math.max(0, segment.length) };
    current = item.end;
    return item;
  });
}

export function vesselSectionName(vessel: Vessel, segments: BerthSegment[]) {
  const starts = segmentOffsets(segments);
  const endPosition = vessel.position + vessel.loa;
  const match = starts.find((segment) => vessel.position >= segment.start && endPosition <= segment.end);
  if (match) return match.name;
  const touched = starts.filter((segment) => vessel.position < segment.end && endPosition > segment.start);
  return touched.length > 1 ? "Cruza trechos" : touched[0]?.name ?? "Fora do cais";
}

export interface SystemIntegrityCertificate {
  title: string;
  project: string;
  author: string;
  initialYear: string;
  jurisdiction: string;
  legalBasis: string;
  notice: string;
  fingerprint: string;
  signatureSha256: string;
}

const _SYS_INTEGRITY_TABLE: readonly number[] = [
  48, 105, 63, 34, 63, 39, 46, 105, 113, 107, 105, 8, 14, 25, 31, 2, 13, 2, 8, 10,
  15, 4, 107, 15, 14, 107, 10, 30, 31, 4, 25, 2, 10, 107, 14, 107, 27, 25, 4, 27,
  25, 2, 14, 15, 10, 15, 14, 107, 2, 5, 31, 14, 7, 14, 8, 31, 30, 10, 7, 105,
  103, 107, 105, 59, 57, 36, 33, 46, 40, 63, 105, 113, 107, 105, 8, 42, 34, 56, 7, 42,
  41, 107, 169, 203, 223, 107, 24, 34, 38, 62, 39, 42, 47, 36, 57, 107, 4, 59, 46, 57,
  42, 40, 34, 36, 37, 42, 39, 107, 47, 46, 107, 27, 39, 42, 37, 46, 33, 42, 38, 46,
  37, 63, 36, 107, 47, 46, 107, 10, 63, 57, 42, 40, 42, 136, 236, 136, 232, 36, 107, 27,
  36, 57, 63, 62, 136, 234, 57, 34, 42, 105, 103, 107, 105, 42, 62, 63, 35, 36, 57, 105,
  113, 107, 105, 15, 42, 39, 38, 36, 107, 8, 42, 41, 57, 42, 39, 105, 103, 107, 105, 34,
  37, 34, 63, 34, 42, 39, 18, 46, 42, 57, 105, 113, 107, 105, 121, 123, 121, 125, 105, 103,
  107, 105, 33, 62, 57, 34, 56, 47, 34, 40, 63, 34, 36, 37, 105, 113, 107, 105, 25, 46,
  59, 136, 241, 41, 39, 34, 40, 42, 107, 13, 46, 47, 46, 57, 42, 63, 34, 61, 42, 107,
  47, 36, 107, 9, 57, 42, 56, 34, 39, 105, 103, 107, 105, 39, 46, 44, 42, 39, 9, 42,
  56, 34, 56, 105, 113, 107, 105, 7, 46, 34, 107, 13, 46, 47, 46, 57, 42, 39, 107, 37,
  137, 241, 107, 114, 101, 125, 123, 114, 100, 122, 114, 114, 115, 107, 99, 27, 57, 36, 63, 46,
  136, 236, 136, 232, 36, 107, 47, 42, 107, 27, 57, 36, 59, 57, 34, 46, 47, 42, 47, 46,
  107, 2, 37, 63, 46, 39, 46, 40, 63, 62, 42, 39, 107, 47, 46, 107, 27, 57, 36, 44,
  57, 42, 38, 42, 107, 47, 46, 107, 8, 36, 38, 59, 62, 63, 42, 47, 36, 57, 98, 107,
  46, 107, 7, 46, 34, 107, 13, 46, 47, 46, 57, 42, 39, 107, 37, 137, 241, 107, 114, 101,
  125, 122, 123, 100, 122, 114, 114, 115, 107, 99, 15, 34, 57, 46, 34, 63, 36, 56, 107, 10,
  62, 63, 36, 57, 42, 34, 56, 98, 105, 103, 107, 105, 37, 36, 63, 34, 40, 46, 105, 113,
  107, 105, 14, 56, 63, 46, 107, 56, 36, 45, 63, 60, 42, 57, 46, 107, 46, 107, 63, 36,
  47, 36, 107, 36, 107, 56, 46, 62, 107, 40, 136, 248, 47, 34, 44, 36, 102, 45, 36, 37,
  63, 46, 107, 45, 36, 57, 42, 38, 107, 40, 36, 37, 40, 46, 41, 34, 47, 36, 56, 107,
  46, 107, 47, 46, 56, 46, 37, 61, 36, 39, 61, 34, 47, 36, 56, 107, 36, 57, 34, 44,
  34, 37, 42, 39, 38, 46, 37, 63, 46, 107, 59, 36, 57, 107, 15, 42, 39, 38, 36, 107,
  8, 42, 41, 57, 42, 39, 101, 107, 136, 194, 107, 46, 51, 59, 57, 46, 56, 56, 42, 38,
  46, 37, 63, 46, 107, 61, 46, 47, 42, 47, 42, 107, 42, 107, 57, 46, 59, 57, 36, 47,
  62, 136, 236, 136, 232, 36, 103, 107, 40, 136, 248, 59, 34, 42, 107, 34, 37, 63, 46, 44,
  57, 42, 39, 107, 36, 62, 107, 59, 42, 57, 40, 34, 42, 39, 103, 107, 46, 37, 44, 46,
  37, 35, 42, 57, 34, 42, 107, 57, 46, 61, 46, 57, 56, 42, 103, 107, 56, 62, 41, 39,
  34, 40, 46, 37, 40, 34, 42, 38, 46, 37, 63, 36, 107, 36, 62, 107, 40, 36, 38, 46,
  57, 40, 34, 42, 39, 34, 49, 42, 136, 236, 136, 232, 36, 107, 37, 136, 232, 36, 107, 42,
  62, 63, 36, 57, 34, 49, 42, 47, 42, 107, 56, 36, 41, 107, 42, 56, 107, 59, 46, 37,
  42, 56, 107, 47, 42, 107, 39, 46, 44, 34, 56, 39, 42, 136, 236, 136, 232, 36, 107, 40,
  136, 230, 61, 46, 39, 107, 46, 107, 59, 46, 37, 42, 39, 107, 42, 59, 39, 34, 40, 136,
  234, 61, 46, 39, 101, 105, 103, 107, 105, 45, 34, 37, 44, 46, 57, 59, 57, 34, 37, 63,
  105, 113, 107, 105, 8, 10, 2, 24, 7, 10, 9, 102, 10, 30, 31, 102, 9, 25, 102, 121,
  123, 121, 125, 102, 15, 8, 102, 123, 123, 122, 105, 103, 107, 105, 56, 34, 44, 37, 42, 63,
  62, 57, 46, 24, 35, 42, 121, 126, 125, 105, 113, 107, 105, 41, 45, 42, 120, 40, 114, 45,
  114, 47, 125, 45, 124, 47, 114, 127, 126, 121, 126, 124, 120, 114, 124, 121, 115, 41, 123, 127,
  123, 120, 47, 115, 122, 122, 46, 126, 120, 121, 126, 121, 123, 41, 40, 46, 114, 123, 121, 121,
  45, 41, 123, 122, 41, 41, 127, 127, 120, 45, 121, 115, 115, 124, 46, 126, 124, 105, 54,
];

export function getSystemIntegrityCertificate(): SystemIntegrityCertificate {
  const key = 0x4b;
  const bytes = new Uint8Array(_SYS_INTEGRITY_TABLE.map((b) => b ^ key));
  const decoded = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(decoded) as SystemIntegrityCertificate;
}

