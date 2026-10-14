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

export const BOLLARD_TYPES: Record<BollardType, { label: string; color: string; border: string; image: string }> = {
  "duplo": { label: "Cabeço duplo", color: "#3a7ebf", border: "#225a8d", image: "/bollards/cabeco-duplo.png" },
  "alto-antigo": { label: "Cabeço alto antigo", color: "#3d4529", border: "#252b17", image: "/bollards/cabeco-alto-antigo.jpg" },
  "alto-novo": { label: "Cabeço alto novo", color: "#6c757d", border: "#495057", image: "/bollards/cabeco-alto-novo.jpg" },
  "baixo-antigo": { label: "Cabeço baixo antigo", color: "#e67e22", border: "#b85d10", image: "/bollards/cabeco-baixo-antigo.png" },
  "avariado": { label: "Cabeço avariado", color: "#d62828", border: "#9e1515", image: "/bollards/cabeco-duplo.png" },
};

export interface Bollard {
  id: string;
  /** Metros desde o início do cais; null significa posição ainda não cadastrada. */
  position: number | null;
  type?: BollardType;
}

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
  "offshore": "Apoio Marítimo (Platform Supply Ship / PSV / AHTS)",
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
  "OCEAN MERMAID": "research-survey",
  "CMA CGM IRON": "container",
  "CMA CGM PUCCINI": "container",
  "CMA CGM VERACRUZ": "container",
  "COSCO SHIPPING ARGENTINA": "container",
  "COSCO SHIPPING BRAZIL": "container",
  "COSCO SHIPPING CHILE": "container",
  "EVER FAME": "container",
  "EVER FAR": "container",
  "EVER FASHION": "container",
  "EVER LEADER": "container",
  "KOTA PAHLAWAN": "container",
  "LOG-IN PANTANAL": "container",
  "LONCOMILLA": "container",
  "MALIAKOS": "container",
  "NC BRAVO": "container",
  "NC BREDA": "container",
  "NYK RUMINA": "container",
  "TOKYO EXPRESS": "container",
  "ZIM BALTIMORE": "container",
};

export const KNOWN_VESSEL_DEFAULTS: Record<string, Partial<Vessel>> = {
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
};

export function normalizeVesselType(raw?: string | null, vesselName?: string | null): VesselType {
  const upper = (raw ?? "").toUpperCase().trim();
  const upperName = (vesselName ?? "").toUpperCase().trim();

  // 0. Reconhecimento direto pelo nome do navio no catálogo ou padrões de nomenclatura
  if (upperName && KNOWN_VESSEL_TYPES[upperName]) {
    return KNOWN_VESSEL_TYPES[upperName];
  }
  if (
    upperName.includes("OCEAN MERMAID") ||
    upperName.includes("SURVEY") ||
    upperName.includes("RESEARCH") ||
    upperName.includes("HIDROGRAF") ||
    upperName.includes("OCEANOGRAF")
  ) {
    return "research-survey";
  }

  // 1. Pesquisa / Survey (específico)
  if (
    upper.includes("RESEARCH") ||
    upper.includes("SURVEY") ||
    upper.includes("HIDROGRAF") ||
    upper.includes("PESQUISA") ||
    upper.includes("OCEANOGRAF")
  ) {
    return "research-survey";
  }

  // 2. Chemical Tanker (específico)
  if (
    upper.includes("CHEMICAL") ||
    upper.includes("QUÍMICO") ||
    upper.includes("QUIMICO") ||
    upperName.includes("CHEM") ||
    upperName.includes("STOLT") ||
    upperName.includes("ODFJELL")
  ) {
    return "chemical-tanker";
  }

  // 3. Product Tanker (específico)
  if (
    upper.includes("PRODUCT") ||
    upper.includes("PRODUTO") ||
    upper.includes("CLEAN")
  ) {
    return "product-tanker";
  }

  // 4. Tanker geral (petroleiro, óleo, gás)
  if (
    upper === "tanker" ||
    upper.includes("TANKER") ||
    upper.includes("OIL") ||
    upper.includes("PETROLEIRO") ||
    upper.includes("GAS") ||
    upper.includes("LPG") ||
    upper.includes("LNG") ||
    upper.includes("BITUMEN") ||
    upper.includes("ASPHALT") ||
    upperName.includes("TANKER") ||
    upperName.includes("PETRO")
  ) {
    return "tanker";
  }

  // 5. Apoio a Mergulho / DSV / Subsea
  if (
    upper.includes("DIVING") ||
    upper.includes("MERGULHO") ||
    upper.includes("DSV")
  ) {
    return "diving-support";
  }

  // 6. Apoio Offshore / PSV / Supply
  if (
    upper === "offshore" ||
    upper.includes("OFFSHORE") ||
    upper.includes("PLATFORM SUPPLY") ||
    upper.includes("PSV") ||
    upper.includes("AHTS") ||
    upper.includes("SUPPLY") ||
    upper.includes("TUG") ||
    upper.includes("REBOCADOR") ||
    upper.includes("OSRV") ||
    upper.includes("PLSV") ||
    upperName.includes("SUPPLY") ||
    upperName.includes("AHTS") ||
    upperName.includes("SKANDI") ||
    upperName.includes("SIEM") ||
    upperName.includes("NORMAND") ||
    upperName.includes("BOURBON")
  ) {
    return "offshore";
  }

  // 7. Carga Geral / Graneleiro
  if (
    upper === "general-cargo" ||
    upper.includes("GENERAL CARGO") ||
    upper.includes("CARGO SHIP") ||
    upper.includes("CARGA GERAL") ||
    upper.includes("BULK") ||
    upper.includes("GRANELEIRO") ||
    upper.includes("ORE CARRIER") ||
    upper.includes("CARRIER")
  ) {
    return "general-cargo";
  }

  if (upper === "container" || upper.includes("CONTAINER")) {
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
  const bays = bayNumberSequence(vessel.bayCount ?? vessel.bays ?? vessel.maxBayNumber, vessel.name);
  const isAllAft = config.bridgePosition === "all-aft";

  const bowInset = Math.min(23, loa * 0.16);
  const aftHouseW = Math.max(12, Math.min(24, loa * 0.065));
  const aftHouseX = 2.5;

  const deckLeft = isAllAft ? aftHouseX + aftHouseW + 1.2 : 7;
  const deckRight = Math.max(deckLeft + 1, loa - bowInset);
  const deckWidth = deckRight - deckLeft;

  const rowNumberWidth = Math.max(6, Math.min(9.5, deckWidth * 0.042));
  const bayAreaRight = deckRight - rowNumberWidth - 0.8;
  const bayAreaWidth = Math.max(1, bayAreaRight - deckLeft);

  const isCoscoChile = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("COSCO") && vessel.name.toUpperCase().includes("CHILE");
  const idx63 = bays.indexOf(63);
  const idx65 = bays.indexOf(65);
  const hasCoscoFunnel = isCoscoChile && config.separateFunnel && idx63 !== -1 && idx65 !== -1;

  const isNykRumina = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("NYK") && vessel.name.toUpperCase().includes("RUMINA");
  const idx55 = bays.indexOf(55);
  const idx57 = bays.indexOf(57);
  const hasNykBridge = isNykRumina && idx55 !== -1 && idx57 !== -1;

  const num40ftGaps = Math.max(0, Math.floor((bays.length - 1) / 2));
  const extraSlots = (hasCoscoFunnel ? 1.4 : 0) + (hasNykBridge ? 2.0 : 0);
  const rawBayWidth = bayAreaWidth / Math.max(1, bays.length + extraSlots);
  const hatchGap = bays.length > 2 ? Math.max(1.4, Math.min(3.8, rawBayWidth * 0.32)) : 0;
  const totalGapsWidth = num40ftGaps * hatchGap;
  const coscoFunnelSlotW = hasCoscoFunnel ? Math.max(2.4, Math.min(8.0, rawBayWidth * 1.35)) : 0;
  const nykBridgeSlotW = hasNykBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const availableBayWidth = Math.max(1, bayAreaWidth - totalGapsWidth - coscoFunnelSlotW - nykBridgeSlotW);
  const cellWidth = availableBayWidth / Math.max(1, bays.length);

  const bayCellFromStern = (index: number) => {
    const gapsBefore = Math.floor(index / 2);
    let xPos = bayAreaRight - ((index + 1) * cellWidth + gapsBefore * hatchGap);
    if (hasCoscoFunnel && index >= idx65) {
      xPos -= coscoFunnelSlotW;
    }
    if (hasNykBridge && index >= idx57) {
      xPos -= nykBridgeSlotW;
    }
    return xPos;
  };

  const bridgeIndices: number[] = [];
  const funnelIndices: number[] = [];

  if (!isAllAft && bays.length > 0 && !hasNykBridge) {
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

    if (config.separateFunnel && !hasCoscoFunnel) {
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
  } else if (hasNykBridge) {
    const rightOf57 = bayCellFromStern(idx57) + cellWidth;
    const leftOf55 = bayCellFromStern(idx55);
    bridgeCenterFromStern = (rightOf57 + leftOf55) / 2;
    bridgeLength = Math.max(10, nykBridgeSlotW - 0.4);
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
  { id: "P6", name: "P6", manufacturer: "ZPMC", category: "post-panamax", position: 215, color: "#2563eb", badgeColor: "#1d4ed8", enabled: true, boomOutreach: 60, boomHeight: 44 },
  { id: "P9", name: "P9", manufacturer: "ZPMC", category: "super-post-panamax", position: 255, color: "#be123c", badgeColor: "#9f1239", enabled: true, boomOutreach: 65, boomHeight: 48 },
  { id: "P8", name: "P8", manufacturer: "ZPMC", category: "super-post-panamax", position: 295, color: "#ea580c", badgeColor: "#c2410c", enabled: true, boomOutreach: 65, boomHeight: 48 },
  { id: "P5", name: "P5", manufacturer: "ZPMC", category: "post-panamax", position: 640, color: "#9333ea", badgeColor: "#7e22ce", enabled: true, boomOutreach: 52, boomHeight: 40 },
  { id: "P4", name: "P4", manufacturer: "ZPMC", category: "post-panamax", position: 695, color: "#78350f", badgeColor: "#58250b", enabled: true, boomOutreach: 52, boomHeight: 40 },
];

export interface PortainerLimit {
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

/** Retorna os limites operacionais de deslocamento dos portêineres (P5 não passa de 297-296; P6 não passa de 291-290; P4 não passa de 279). */
export function getPortainerOperationalLimits(bollards: Bollard[]): Record<string, PortainerLimit> {
  const b297 = bollards.find((b) => b.id === "297")?.position ?? 276.9;
  const b296 = bollards.find((b) => b.id === "296")?.position ?? 306.9;
  const p5Min = Number(((b297 + b296) / 2).toFixed(1)); // Ponto médio entre 297 e 296

  const b291 = bollards.find((b) => b.id === "291")?.position ?? 443.9;
  const b290 = bollards.find((b) => b.id === "290")?.position ?? 473.9;
  const p6Max = Number(((b291 + b290) / 2).toFixed(1)); // Ponto médio entre 291 e 290

  const b279 = bollards.find((b) => b.id === "279")?.position ?? 771.4;

  return {
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

export const DEFAULT_BOLLARD_CONFIG: { id: string; distanceToNext: number; type: BollardType }[] = [
  { id: "309", distanceToNext: 19.8, type: "duplo" },
  { id: "308", distanceToNext: 19.8, type: "duplo" },
  { id: "307", distanceToNext: 19.8, type: "duplo" },
  { id: "306", distanceToNext: 19.8, type: "duplo" },
  { id: "305", distanceToNext: 10.7, type: "duplo" },
  { id: "304", distanceToNext: 25.0, type: "duplo" },
  { id: "303", distanceToNext: 25.0, type: "duplo" },
  { id: "302", distanceToNext: 25.0, type: "duplo" },
  { id: "301", distanceToNext: 25.0, type: "duplo" },
  { id: "300", distanceToNext: 25.0, type: "duplo" },
  { id: "299", distanceToNext: 25.0, type: "duplo" },
  { id: "298", distanceToNext: 25.0, type: "duplo" },
  { id: "297", distanceToNext: 30.0, type: "duplo" },
  { id: "296", distanceToNext: 26.0, type: "alto-novo" },
  { id: "295", distanceToNext: 30.0, type: "alto-novo" },
  { id: "294", distanceToNext: 26.0, type: "alto-novo" },
  { id: "293", distanceToNext: 30.0, type: "alto-novo" },
  { id: "292", distanceToNext: 25.0, type: "alto-novo" },
  { id: "291", distanceToNext: 30.0, type: "alto-novo" },
  { id: "290", distanceToNext: 26.0, type: "alto-novo" },
  { id: "289", distanceToNext: 30.0, type: "baixo-antigo" },
  { id: "288", distanceToNext: 38.0, type: "baixo-antigo" },
  { id: "287", distanceToNext: 25.5, type: "baixo-antigo" },
  { id: "286", distanceToNext: 25.0, type: "baixo-antigo" },
  { id: "285", distanceToNext: 26.0, type: "baixo-antigo" },
  { id: "284", distanceToNext: 25.0, type: "baixo-antigo" },
  { id: "283", distanceToNext: 25.0, type: "baixo-antigo" },
  { id: "282", distanceToNext: 26.0, type: "alto-novo" },
  { id: "281", distanceToNext: 25.5, type: "alto-novo" },
  { id: "280", distanceToNext: 25.5, type: "alto-novo" },
  { id: "279", distanceToNext: 25.5, type: "alto-novo" },
  { id: "278", distanceToNext: 26.5, type: "baixo-antigo" },
  { id: "277", distanceToNext: 0, type: "alto-antigo" },
];

export function createBollardInventory(): Bollard[] {
  let currentPos = 12.0;
  return DEFAULT_BOLLARD_CONFIG.map((item) => {
    const bollard: Bollard = {
      id: item.id,
      position: Number(currentPos.toFixed(1)),
      type: item.type,
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
}

/** Unpositioned bollards get schematic display slots only; their saved position remains null. */
export function bollardDisplayPositions(bollards: Bollard[], quayLength: number): BollardDisplayPosition[] {
  if (!Number.isFinite(quayLength) || quayLength <= 0) return [];
  const lastIndex = Math.max(1, bollards.length - 1);
  const positions: BollardDisplayPosition[] = [];
  bollards.forEach((bollard, index) => {
    if (bollard.position !== null) {
      if (bollard.position <= quayLength) positions.push({ id: bollard.id, position: bollard.position, estimated: false, type: bollard.type });
      return;
    }
    positions.push({
      id: bollard.id,
      position: bollards.length <= 1 ? quayLength / 2 : (index / lastIndex) * quayLength,
      estimated: true,
      type: bollard.type,
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
    const knownDefault = KNOWN_VESSEL_DEFAULTS[upperName] ??
      (upperName.includes("VERACRUZ") ? KNOWN_VESSEL_DEFAULTS["CMA CGM VERACRUZ"] :
      (upperName.includes("COSCO") && upperName.includes("CHILE")) ? KNOWN_VESSEL_DEFAULTS["COSCO SHIPPING CHILE"] : undefined);

    const rawBayCount = (raw as any).bayCount ?? (raw as any).maxBayNumber ?? raw.bays;
    const bayCount = normalizeBayCount(rawBayCount !== undefined ? rawBayCount : knownDefault?.bayCount);
    const rawRowCount = (raw as any).rowCount ?? raw.rows;
    const rowCount = normalizeRowCount(rawRowCount !== undefined ? rawRowCount : knownDefault?.rowCount);
    const rawTierCount = (raw as any).tierCount ?? raw.tiers;
    const tierCount = normalizeTierCount(rawTierCount !== undefined ? rawTierCount : knownDefault?.tierCount);
    const bridgePosition = (raw as any).bridgePosition === "between-bays"
      ? "between-bays"
      : (raw as any).bridgePosition === "all-aft"
      ? "all-aft"
      : knownDefault?.bridgePosition ?? "all-aft";
    const bridgeBay = typeof (raw as any).bridgeBay === "number"
      ? (raw as any).bridgeBay
      : typeof (raw as any).bridgeBayStart === "number"
      ? (raw as any).bridgeBayStart
      : knownDefault?.bridgeBay;
    const bridgeBayStart = typeof (raw as any).bridgeBayStart === "number"
      ? (raw as any).bridgeBayStart
      : bridgeBay ?? knownDefault?.bridgeBayStart;
    const bridgeBayEnd = typeof (raw as any).bridgeBayEnd === "number"
      ? (raw as any).bridgeBayEnd
      : bridgeBay ?? knownDefault?.bridgeBayEnd;
    const separateFunnel = (raw as any).separateFunnel !== undefined
      ? Boolean((raw as any).separateFunnel)
      : Boolean(knownDefault?.separateFunnel);
    const funnelBay = typeof (raw as any).funnelBay === "number"
      ? (raw as any).funnelBay
      : typeof (raw as any).funnelBayStart === "number"
      ? (raw as any).funnelBayStart
      : knownDefault?.funnelBay;
    const funnelBayStart = typeof (raw as any).funnelBayStart === "number"
      ? (raw as any).funnelBayStart
      : funnelBay ?? knownDefault?.funnelBayStart;
    const funnelBayEnd = typeof (raw as any).funnelBayEnd === "number"
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
        return [{ id: raw.id, position, type }];
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
          color: typeof raw.color === "string" ? raw.color : (def?.color ?? "#2563eb"),
          badgeColor: typeof raw.badgeColor === "string" ? raw.badgeColor : (def?.badgeColor ?? "#1d4ed8"),
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

          if (portainer.boomOutreach && vessel.beam > 0 && portainer.boomOutreach < vessel.beam) {
            issues.push({
              vesselId: vessel.id,
              kind: "equipment",
              message: `Portêiner ${portainer.name} (alcance ${portainer.boomOutreach} m) não cobre a boca total do ${vessel.name} (${vessel.beam.toFixed(1)} m)`,
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
