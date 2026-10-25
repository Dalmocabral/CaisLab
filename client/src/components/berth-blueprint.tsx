import { useRef, useState } from "react";
import {
  calculateIssues,
  berthwiseOffsetFromStern,
  bollardDisplayPositions,
  bayNumberSequence,
  rowNumberSequence,
  normalizeRowCount,
  normalizeTierCount,
  defaultTierCountForBeam,
  CONTAINER_COLORS,
  normalizeMooringOffset,
  MOORING_LINE_LABELS,
  segmentOffsets,
  type Scenario,
  VESSEL_COLORS,
  type BollardType,
  BOLLARD_TYPES,
  getAssetUrl,
  type VesselType,
  VESSEL_TYPE_LABELS,
  type Portainer,
  DEFAULT_PORTAINERS,
  getPortainerOperationalLimits,
  clampPortainerPosition,
  normalizeVesselType,
  resolveVesselSuperstructure,
  get40ftBayPair,
  getOccupiedBayNumbers,
  type Vessel,
  type MooringLineType,
} from "@/lib/berth-model";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BerthBlueprintProps {
  scenario: Scenario;
  zoom: number;
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
  onMoveVessel: (id: string, position: number) => void;
  onAssignMooringLine: (vesselId: string, lineId: string, bollardId: string) => void;
  onUpdateBollard?: (id: string, patch: { id?: string; position?: number | null; type?: BollardType }) => void;
  onMovePortainer?: (id: string, position: number) => void;
  onPortainerLimitHit?: (message: string) => void;
  isPresentationMode?: boolean;
}

const PAD = 54;
const HEIGHT = 390;
const QUAY_Y = 218;
const CABLE_END_Y = 215;
const VESSEL_BERTH_BOTTOM_Y = QUAY_Y - 18; // 18 px de distância do cais (costado encostado nas defensas)

/** Calcula os pontos estruturais de fixação dos cabos no navio (conforme os 4 pontos marcados pelo usuário):
 * - Lançante de popa: centro do espelho de popa (transom)
 * - Spring de popa: canto da popa junto ao cais
 * - Spring de proa: ombro da proa junto ao cais (início do afunilamento da proa)
 * - Lançante de proa: bico da proa
 */
function getMooringShipAnchor(
  lineType: MooringLineType,
  vessel: Vessel,
  scale: number,
  trackStart: number
): { x: number; y: number } {
  const x = trackStart + vessel.position * scale;
  const vesselWidth = vessel.loa * scale;
  const vesselHeight = Math.max(20, vessel.beam * scale);
  const y = VESSEL_BERTH_BOTTOM_Y - vesselHeight;
  const bowInset = Math.min(23 * scale, vesselWidth * 0.16);
  const isBombordo = vessel.berthingSide === "bombordo";

  switch (lineType) {
    case "lancante-popa":
      // Centro do espelho de popa (transom)
      return isBombordo
        ? { x: x + vesselWidth, y: y + vesselHeight / 2 }
        : { x: x, y: y + vesselHeight / 2 };

    case "spring-popa":
      // Canto da popa junto ao cais
      return isBombordo
        ? { x: x + vesselWidth - 6, y: y + vesselHeight }
        : { x: x + 6, y: y + vesselHeight };

    case "spring-proa":
      // Ombro da proa junto ao cais (início do afunilamento do bico)
      return isBombordo
        ? { x: x + bowInset, y: y + vesselHeight }
        : { x: x + vesselWidth - bowInset, y: y + vesselHeight };

    case "lancante-proa":
    default:
      // Bico da proa
      return isBombordo
        ? { x: x, y: y + vesselHeight / 2 }
        : { x: x + vesselWidth, y: y + vesselHeight / 2 };
  }
}

/** Renderiza o convés conteneiro preenchendo o navio, com números de Bay acima e Rows na proa. */
function renderContainerDeck(
  x: number,
  y: number,
  vesselWidth: number,
  vesselHeight: number,
  bowInset: number,
  color: { fill: string; stroke: string },
  vessel: Vessel,
  mirrorText = false,
) {
  const config = resolveVesselSuperstructure(vessel);
  const isDusseldorf = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("DUSSELDORF");
  const isAplNewJersey = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("APL") && vessel.name.toUpperCase().includes("NEW JERSEY");
  const isMercosulGuaruja = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("GUARUJA");
  const bays = isDusseldorf
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
  const rows = rowNumberSequence(vessel.rowCount ?? vessel.rows);
  const effectiveRows = rows.length > 0
    ? rows
    : rowNumberSequence(Math.max(4, Math.min(20, Math.round(vesselHeight / 2.7))));
  const activeRowCount = effectiveRows.length;

  const containerTop = y + 1.2;
  const containerHeight = Math.max(1, vesselHeight - 2.4);
  const cellHeight = containerHeight / Math.max(1, activeRowCount);

  // Modo 1: Casaria 100% na popa (All-Aft, como CMA CGM Veracruz)
  const isAllAft = config.bridgePosition === "all-aft";

  const aftHouseW = Math.max(12, Math.min(24, vesselWidth * 0.065));
  const aftHouseH = Math.max(14, containerHeight * 0.88);
  const aftHouseX = x + 2.5;
  const aftHouseY = y + (vesselHeight - aftHouseH) / 2;

  // Deck de contêineres: se a casaria for na popa, os contêineres começam colados nela
  const deckLeft = isAllAft ? aftHouseX + aftHouseW + 1.2 : x + 7;
  const deckRight = Math.max(deckLeft + 1, x + vesselWidth - bowInset);
  const deckWidth = deckRight - deckLeft;

  // Faixa na proa para os números das Rows
  const rowNumberWidth = Math.max(6, Math.min(9.5, deckWidth * 0.042));
  const bayAreaRight = deckRight - rowNumberWidth - 0.8;
  const bayAreaWidth = Math.max(1, bayAreaRight - deckLeft);

  const isCoscoClass = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("COSCO") && (
    vessel.name.toUpperCase().includes("CHILE") ||
    vessel.name.toUpperCase().includes("BRAZIL") ||
    vessel.name.toUpperCase().includes("BRASIL") ||
    vessel.name.toUpperCase().includes("ARGENTINA") ||
    vessel.name.toUpperCase().includes("URUGUAY")
  );
  const idx63 = bays.indexOf(63);
  const idx65 = bays.indexOf(65);
  const hasCoscoFunnel = isCoscoClass && config.separateFunnel && idx63 !== -1 && idx65 !== -1;

  const isNykRumina = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("NYK") && vessel.name.toUpperCase().includes("RUMINA");
  const isSeaspanEmpire = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("SEASPAN") && vessel.name.toUpperCase().includes("EMPIRE");
  const idx41 = bays.indexOf(41);
  const idx43 = bays.indexOf(43);
  const idx53 = bays.indexOf(53);
  const idx55 = bays.indexOf(55);
  const idx57 = bays.indexOf(57);
  const idx59 = bays.indexOf(59);
  const hasSpecialBridge55_57 = (isNykRumina || isSeaspanEmpire) && idx55 !== -1 && idx57 !== -1;
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
  const hasEverFitBridge = isEverFitClass && idx27 !== -1 && idx29 !== -1;
  const hasEverFitFunnel = isEverFitClass && config.separateFunnel && idx61 !== -1 && idx63 !== -1;

  // Separação visual entre as bays de 40' (cada par de bays de 20' forma uma bay/hatch de 40')
  const num40ftGaps = isDusseldorf ? 17 : isAplNewJersey ? 16 : isMercosulGuaruja ? 11 : Math.max(0, Math.floor((bays.length - 1) / 2));
  const extraSlots = (hasCoscoFunnel ? 1.4 : 0) + (hasEverFitFunnel ? 1.4 : 0) + (hasSpecialBridge55_57 ? 2.0 : 0) + (hasEverFitBridge ? 2.0 : 0) + (hasDusseldorfBridge ? 2.0 : 0) + (hasAplBridge ? 2.0 : 0) + (hasGuarujaBridge ? 2.0 : 0);
  const rawBayWidth = bayAreaWidth / Math.max(1, bays.length + extraSlots);
  const hatchGap = bays.length > 2 ? Math.max(1.4, Math.min(3.8, rawBayWidth * 0.32)) : 0;
  const totalGapsWidth = num40ftGaps * hatchGap;
  const coscoFunnelSlotW = hasCoscoFunnel ? Math.max(2.4, Math.min(8.0, rawBayWidth * 1.35)) : 0;
  const everFitFunnelSlotW = hasEverFitFunnel ? Math.max(2.4, Math.min(8.0, rawBayWidth * 1.35)) : 0;
  const nykBridgeSlotW = hasSpecialBridge55_57 ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const everFitBridgeSlotW = hasEverFitBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const dusseldorfBridgeSlotW = hasDusseldorfBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const aplBridgeSlotW = hasAplBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const guarujaBridgeSlotW = hasGuarujaBridge ? Math.max(10.0, Math.min(16.0, rawBayWidth * 2.0)) : 0;
  const availableBayWidth = Math.max(1, bayAreaWidth - totalGapsWidth - coscoFunnelSlotW - everFitFunnelSlotW - nykBridgeSlotW - everFitBridgeSlotW - dusseldorfBridgeSlotW - aplBridgeSlotW - guarujaBridgeSlotW);
  const cellWidth = availableBayWidth / Math.max(1, bays.length);
  const labelSize = bays.length ? Math.max(2.6, Math.min(5.4, cellWidth * 0.54)) : 3.4;
  const rowLabelSize = Math.max(2.0, Math.min(labelSize, cellHeight * 0.72));
  const rowLabelX = deckRight - rowNumberWidth / 2;

  // Posição X da baia considerando o espaço visual entre escotilhas de 40'
  const bayCellX = (index: number) => {
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

  // Modo 2: Passadiço entre as bays (Ilha / Casaria no meio)
  const bridgeIndices: number[] = [];
  const funnelIndices: number[] = [];

  if (!isAllAft && bays.length > 0 && !hasSpecialBridge55_57 && !hasEverFitBridge && !hasDusseldorfBridge && !hasAplBridge && !hasGuarujaBridge) {
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

    // Fallback se o número estiver fora do range exato: pega o mais próximo e seu par de 40'
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

  const bridgeSet = new Set(bridgeIndices);
  const funnelSet = new Set(funnelIndices);

  const isBayOccupied = (index: number) => {
    if (isAllAft) return false;
    return bridgeSet.has(index) || funnelSet.has(index);
  };

  const textTransform = (centerX: number) => mirrorText ? `translate(${centerX * 2} 0) scale(-1 1)` : undefined;

  return (
    <g className="deck-container-ship">
      {/* Contêineres preenchendo as baias e rows */}
      {bays.map((bay, index) => {
        if (isBayOccupied(index)) return null;
        const cellX = bayCellX(index);
        return (
          <g key={`bay-column-${bay}`}>
            {effectiveRows.map((rowLabel, rIdx) => {
              const cellY = containerTop + rIdx * cellHeight;
              const cellH = Math.max(0.6, cellHeight - 0.35);
              const cellW = Math.max(0.6, cellWidth - 0.35);
              return (
                <rect
                  key={`bay-cell-${bay}-${rowLabel}`}
                  x={cellX + 0.18}
                  y={cellY + 0.18}
                  width={cellW}
                  height={cellH}
                  rx="0.4"
                  fill={CONTAINER_COLORS[(index * 3 + rIdx * 2) % CONTAINER_COLORS.length]}
                  stroke="#ffffff"
                  strokeWidth="0.25"
                >
                  <title>{`Bay ${bay} · Row ${rowLabel}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}

      {/* Números das Bays posicionados ACIMA do desenho do navio (as bays ocupadas por casaria no meio não mostram label) */}
      {bays.length > 0 ? (
        <>
          {bays.map((bay, index) => {
            if (isBayOccupied(index)) return null;

            const isVeracruz = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("VERACRUZ");
            const isCoscoClass = typeof vessel.name === "string" && vessel.name.toUpperCase().includes("COSCO") && (
              vessel.name.toUpperCase().includes("CHILE") ||
              vessel.name.toUpperCase().includes("BRAZIL") ||
              vessel.name.toUpperCase().includes("BRASIL") ||
              vessel.name.toUpperCase().includes("ARGENTINA") ||
              vessel.name.toUpperCase().includes("URUGUAY")
            );

            // No navio Veracruz, remove a bay 49 e deixa a 50 centralizada entre a divisão dos contêineres de 20'
            if (isVeracruz && bay === 49) return null;

            // No navio Cosco, remove a bay 77 e deixa a 78 centralizada entre a divisão dos contêineres de 20'
            if (isCoscoClass && bay === 77) return null;

            const cellX = bayCellX(index);
            let centerX = cellX + cellWidth / 2;

            if (isVeracruz && bay === 50) {
              const idx49 = bays.indexOf(49);
              if (idx49 !== -1) {
                const cellX49 = bayCellX(idx49);
                centerX = (cellX + cellWidth / 2 + cellX49 + cellWidth / 2) / 2;
              }
            }

            if (isCoscoClass && bay === 78) {
              const idx77 = bays.indexOf(77);
              if (idx77 !== -1) {
                const cellX77 = bayCellX(idx77);
                centerX = (cellX + cellWidth / 2 + cellX77 + cellWidth / 2) / 2;
              }
            }

            // No navio Ever Fit, remove a bay 75 e deixa a 76 centralizada entre a divisão dos contêineres de 20'
            if (isEverFitClass && bay === 75) return null;

            if (isEverFitClass && bay === 76) {
              const idx75 = bays.indexOf(75);
              if (idx75 !== -1) {
                const cellX75 = bayCellX(idx75);
                centerX = (cellX + cellWidth / 2 + cellX75 + cellWidth / 2) / 2;
              }
            }

            // No navio NYK Rumina, remove a bay 69 e deixa a 70 centralizada entre a divisão dos contêineres de 20'
            if (isNykRumina && bay === 69) return null;

            if (isNykRumina && bay === 70) {
              const idx69 = bays.indexOf(69);
              if (idx69 !== -1) {
                const cellX69 = bayCellX(idx69);
                centerX = (cellX + cellWidth / 2 + cellX69 + cellWidth / 2) / 2;
              }
            }

            // No navio APL NEW JERSEY, remove a bay 67 e deixa a 68 centralizada na última escotilha de 40' ("a ultima bay e 68 |")
            if (isAplNewJersey && bay === 67) return null;

            if (isAplNewJersey && bay === 68) {
              const idx67 = bays.indexOf(67);
              if (idx67 !== -1) {
                const cellX67 = bayCellX(idx67);
                centerX = (cellX + cellWidth / 2 + cellX67 + cellWidth / 2) / 2;
              }
            }

            return (
              <g key={`bay-label-${bay}`}>
                <title>{`Bay ${bay} · posição de ${bay % 2 === 0 ? "40" : "20"} pés`}</title>
                <text
                  transform={textTransform(centerX)}
                  x={centerX}
                  y={y - 3.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelSize}
                  fontWeight="800"
                  fill="#173343"
                  paintOrder="stroke"
                  stroke="#f8fbfc"
                  strokeWidth="0.7"
                  strokeLinejoin="round"
                >
                  {String(bay).padStart(2, "0")}
                </text>
              </g>
            );
          })}
        </>
      ) : (
        <text transform={textTransform((deckLeft + deckRight) / 2)} x={(deckLeft + deckRight) / 2} y={y + vesselHeight / 2} textAnchor="middle" dominantBaseline="middle" fontSize="3.2" fontWeight="700" fill="#71848b">
          INFORME A QUANTIDADE DE BAYS
        </text>
      )}

      {/* Números das Rows na proa (mesma formatação das Bays, limpos e sem borda) */}
      {effectiveRows.map((rowLabel, rIdx) => {
        const rowCenterY = containerTop + (rIdx + 0.5) * cellHeight;
        return (
          <g key={`row-label-${rowLabel}-${rIdx}`}>
            <title>{`Row ${rowLabel}`}</title>
            <text
              transform={textTransform(rowLabelX)}
              x={rowLabelX}
              y={rowCenterY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={rowLabelSize}
              fontWeight="800"
              fill="#173343"
              paintOrder="stroke"
              stroke="#f8fbfc"
              strokeWidth="0.7"
              strokeLinejoin="round"
            >
              {rowLabel}
            </text>
          </g>
        );
      })}

      {/* Quebra-ondas de proa */}
      <path
        d={`M ${x + vesselWidth - bowInset} ${y + 3} L ${x + vesselWidth - 4} ${y + vesselHeight / 2} L ${x + vesselWidth - bowInset} ${y + vesselHeight - 3} Z`}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth="0.8"
      />

      {/* ESTRUTURAS: */}
      {/* 1. Casaria na Popa Extrema (All-Aft, ex: CMA CGM Veracruz) */}
      {isAllAft && (
        <g className="superstructure-all-aft">
          <rect
            x={aftHouseX}
            y={aftHouseY}
            width={aftHouseW}
            height={aftHouseH}
            rx="2"
            fill={color.fill}
            stroke={color.stroke}
            strokeWidth="1.2"
          />
          {/* Asas do passadiço até a borda */}
          <line
            x1={aftHouseX + aftHouseW * 0.72}
            y1={y + 1.5}
            x2={aftHouseX + aftHouseW * 0.72}
            y2={y + vesselHeight - 1.5}
            stroke={color.stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Chaminé na popa */}
          <ellipse
            cx={aftHouseX + aftHouseW * 0.28}
            cy={y + vesselHeight / 2}
            rx={Math.max(2.2, aftHouseW * 0.16)}
            ry={Math.max(2, vesselHeight * 0.12)}
            fill="#1e293b"
            stroke="#0f172a"
            strokeWidth="0.8"
          />
        </g>
      )}

      {/* 2. Passadiço Entre as Bays (Sem deixar vão branco, ocupando toda a escotilha de 40' ou faixa de bays) */}
      {!isAllAft && bridgeIndices.length > 0 && (
        <g className="superstructure-bridge-island">
          {(() => {
            const minX = Math.min(...bridgeIndices.map((idx) => bayCellX(idx)));
            const maxX = Math.max(...bridgeIndices.map((idx) => bayCellX(idx) + cellWidth));
            const slotW = Math.max(1.2, maxX - minX - 0.35);
            const slotX = minX + 0.18;
            return (
              <>
                <rect
                  x={slotX}
                  y={y + 2.5}
                  width={slotW}
                  height={vesselHeight - 5}
                  rx="1.8"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.2"
                />
                {/* Asas do passadiço */}
                <line
                  x1={slotX + slotW * 0.55}
                  y1={y + 0.8}
                  x2={slotX + slotW * 0.55}
                  y2={y + vesselHeight - 0.8}
                  stroke={color.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Se a chaminé não for separada, desenha chaminé no próprio passadiço (lado de ré) */}
                {!config.separateFunnel && (
                  <ellipse
                    cx={slotX + slotW * 0.25}
                    cy={y + vesselHeight / 2}
                    rx={Math.max(2.2, Math.min(4.8, slotW * 0.22))}
                    ry={Math.max(1.8, Math.min(3.2, vesselHeight * 0.11))}
                    fill="#1e293b"
                    stroke="#0f172a"
                    strokeWidth="0.7"
                  />
                )}
              </>
            );
          })()}
        </g>
      )}

      {/* 3. Chaminé Separada Entre as Bays (ocupando toda a escotilha da bay da chaminé) */}
      {!isAllAft && config.separateFunnel && funnelIndices.length > 0 && (
        <g className="superstructure-funnel-island">
          {(() => {
            const minX = Math.min(...funnelIndices.map((idx) => bayCellX(idx)));
            const maxX = Math.max(...funnelIndices.map((idx) => bayCellX(idx) + cellWidth));
            const slotW = Math.max(1.2, maxX - minX - 0.35);
            const slotX = minX + 0.18;
            return (
              <>
                <rect
                  x={slotX}
                  y={y + 3.2}
                  width={slotW}
                  height={vesselHeight - 6.4}
                  rx="1.6"
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth="1.1"
                />
                <ellipse
                  cx={slotX + slotW / 2}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(2.2, Math.min(4.5, slotW * 0.32))}
                  ry={Math.max(2.0, Math.min(3.8, vesselHeight * 0.16))}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 3b. Chaminé Separada Específica do COSCO (estreita entre as bays 63 e 65, sem ocultar as bays) */}
      {!isAllAft && hasCoscoFunnel && (
        <g className="superstructure-funnel-island-cosco">
          {(() => {
            const rightOf65 = bayCellX(idx65) + cellWidth;
            const leftOf63 = bayCellX(idx63);
            const slotW = Math.max(1.6, coscoFunnelSlotW - 0.35);
            const slotX = (rightOf65 + leftOf63 - slotW) / 2;
            const centerFunnelX = slotX + slotW / 2;
            return (
              <>
                <title>Chaminé (Bay 64)</title>
                <rect
                  x={slotX}
                  y={y + 3.2}
                  width={slotW}
                  height={vesselHeight - 6.4}
                  rx="1.6"
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth="1.1"
                />
                <ellipse
                  cx={centerFunnelX}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(1.8, Math.min(3.6, slotW * 0.36))}
                  ry={Math.max(1.8, Math.min(3.4, vesselHeight * 0.15))}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 2b. Passadiço Específico do NYK RUMINA / SEASPAN EMPIRE (entre as bays 55 e 57, sem ocultar as bays) */}
      {!isAllAft && hasSpecialBridge55_57 && (
        <g className="superstructure-bridge-island-nyk">
          {(() => {
            const rightOf57 = bayCellX(idx57) + cellWidth;
            const leftOf55 = bayCellX(idx55);
            const slotW = Math.max(8.0, nykBridgeSlotW - 0.4);
            const slotX = (rightOf57 + leftOf55 - slotW) / 2;
            return (
              <>
                <title>Passadiço (entre Bay 55 e Bay 57)</title>
                <rect
                  x={slotX}
                  y={y + 2.5}
                  width={slotW}
                  height={vesselHeight - 5}
                  rx="1.8"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.2"
                />
                {/* Asas do passadiço */}
                <line
                  x1={slotX + slotW * 0.55}
                  y1={y + 0.8}
                  x2={slotX + slotW * 0.55}
                  y2={y + vesselHeight - 0.8}
                  stroke={color.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Chaminé no próprio passadiço (lado de ré) */}
                <ellipse
                  cx={slotX + slotW * 0.25}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(2.2, Math.min(4.8, slotW * 0.22))}
                  ry={Math.max(1.8, Math.min(3.2, vesselHeight * 0.11))}
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="0.7"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 2c. Passadiço Específico do EVER FIT (entre as bays 27 e 29, sem ocultar as bays) */}
      {!isAllAft && hasEverFitBridge && (
        <g className="superstructure-bridge-island-everfit">
          {(() => {
            const rightOf29 = bayCellX(idx29) + cellWidth;
            const leftOf27 = bayCellX(idx27);
            const slotW = Math.max(8.0, everFitBridgeSlotW - 0.4);
            const slotX = (rightOf29 + leftOf27 - slotW) / 2;
            return (
              <>
                <title>Passadiço (entre Bay 27 e Bay 29)</title>
                <rect
                  x={slotX}
                  y={y + 2.5}
                  width={slotW}
                  height={vesselHeight - 5}
                  rx="1.8"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.2"
                />
                {/* Asas do passadiço */}
                <line
                  x1={slotX + slotW * 0.55}
                  y1={y + 0.8}
                  x2={slotX + slotW * 0.55}
                  y2={y + vesselHeight - 0.8}
                  stroke={color.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 2d. Passadiço Específico do DUSSELDORF EXPRESS (entre as bays 57 e 59: 61 59 [passadiço] 57 55 - 53 - 51 49) */}
      {!isAllAft && hasDusseldorfBridge && (
        <g className="superstructure-bridge-island-dusseldorf">
          {(() => {
            const rightOf59 = bayCellX(idx59) + cellWidth;
            const leftOf57 = bayCellX(idx57);
            const slotW = Math.max(8.0, dusseldorfBridgeSlotW - 0.4);
            const slotX = (rightOf59 + leftOf57 - slotW) / 2;
            return (
              <>
                <title>Passadiço (entre Bay 57 e Bay 59)</title>
                <rect
                  x={slotX}
                  y={y + 2.5}
                  width={slotW}
                  height={vesselHeight - 5}
                  rx="1.8"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.2"
                />
                {/* Asas do passadiço */}
                <line
                  x1={slotX + slotW * 0.55}
                  y1={y + 0.8}
                  x2={slotX + slotW * 0.55}
                  y2={y + vesselHeight - 0.8}
                  stroke={color.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Chaminé no próprio passadiço (lado de ré) */}
                <ellipse
                  cx={slotX + slotW * 0.25}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(2.2, Math.min(4.8, slotW * 0.22))}
                  ry={Math.max(1.8, Math.min(3.2, vesselHeight * 0.11))}
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="0.7"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 2e. Passadiço Específico do APL NEW JERSEY (entre as bays 53 e 55: 57 55 [passadiço] 53 51) */}
      {!isAllAft && hasAplBridge && (
        <g className="superstructure-bridge-island-apl">
          {(() => {
            const rightOf55 = bayCellX(idx55) + cellWidth;
            const leftOf53 = bayCellX(idx53);
            const slotW = Math.max(8.0, aplBridgeSlotW - 0.4);
            const slotX = (rightOf55 + leftOf53 - slotW) / 2;
            return (
              <>
                <title>Passadiço (entre Bay 53 e Bay 55)</title>
                <rect
                  x={slotX}
                  y={y + 2.5}
                  width={slotW}
                  height={vesselHeight - 5}
                  rx="1.8"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.2"
                />
                {/* Asas do passadiço */}
                <line
                  x1={slotX + slotW * 0.55}
                  y1={y + 0.8}
                  x2={slotX + slotW * 0.55}
                  y2={y + vesselHeight - 0.8}
                  stroke={color.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Chaminé no próprio passadiço (lado de ré) */}
                <ellipse
                  cx={slotX + slotW * 0.25}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(2.2, Math.min(4.8, slotW * 0.22))}
                  ry={Math.max(1.8, Math.min(3.2, vesselHeight * 0.11))}
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="0.7"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 2f. Passadiço Específico do MERCOSUL GUARUJA (entre as bays 41 e 43: 49 47 45 43 [passadiço] 41 39) */}
      {!isAllAft && hasGuarujaBridge && (
        <g className="superstructure-bridge-island-guaruja">
          {(() => {
            const rightOf43 = bayCellX(idx43) + cellWidth;
            const leftOf41 = bayCellX(idx41);
            const slotW = Math.max(8.0, guarujaBridgeSlotW - 0.4);
            const slotX = (rightOf43 + leftOf41 - slotW) / 2;
            return (
              <>
                <title>Passadiço (entre Bay 41 e Bay 43)</title>
                <rect
                  x={slotX}
                  y={y + 2.5}
                  width={slotW}
                  height={vesselHeight - 5}
                  rx="1.8"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="1.2"
                />
                {/* Asas do passadiço */}
                <line
                  x1={slotX + slotW * 0.55}
                  y1={y + 0.8}
                  x2={slotX + slotW * 0.55}
                  y2={y + vesselHeight - 0.8}
                  stroke={color.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                {/* Chaminé no próprio passadiço (lado de ré) */}
                <ellipse
                  cx={slotX + slotW * 0.25}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(2.2, Math.min(4.8, slotW * 0.22))}
                  ry={Math.max(1.8, Math.min(3.2, vesselHeight * 0.11))}
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="0.7"
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 3c. Chaminé Separada Específica do EVER FIT (entre as bays 61 e 63, deixando a 61 de 20' na frente) */}
      {!isAllAft && hasEverFitFunnel && (
        <g className="superstructure-funnel-island-everfit">
          {(() => {
            const rightOf63 = bayCellX(idx63) + cellWidth;
            const leftOf61 = bayCellX(idx61);
            const slotW = Math.max(1.6, everFitFunnelSlotW - 0.35);
            const slotX = (rightOf63 + leftOf61 - slotW) / 2;
            const centerFunnelX = slotX + slotW / 2;
            return (
              <>
                <title>Chaminé (entre Bay 61 e Bay 63)</title>
                <rect
                  x={slotX}
                  y={y + 3.2}
                  width={slotW}
                  height={vesselHeight - 6.4}
                  rx="1.6"
                  fill="#14532d"
                  stroke="#052e16"
                  strokeWidth="1.1"
                />
                <ellipse
                  cx={centerFunnelX}
                  cy={y + vesselHeight / 2}
                  rx={Math.max(1.8, Math.min(3.6, slotW * 0.36))}
                  ry={Math.max(1.8, Math.min(3.4, vesselHeight * 0.15))}
                  fill="#052e16"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                />
              </>
            );
          })()}
        </g>
      )}
    </g>
  );
}

/** Renderiza o convés de um Navio de Carga Geral (General Cargo Ship / Bulk Carrier) com porões, escotilhas e guindastes */
function renderGeneralCargoDeck(
  x: number,
  y: number,
  vesselWidth: number,
  vesselHeight: number,
  bowInset: number,
  color: { fill: string; stroke: string }
) {
  // Superestrutura de ré e chaminé
  const houseX = x + 7;
  const houseW = Math.max(20, Math.min(48, vesselWidth * 0.15));
  const houseH = Math.max(12, vesselHeight * 0.72);
  const houseY = y + (vesselHeight - houseH) / 2;

  // Área útil de carga
  const cargoStartX = houseX + houseW + 5;
  const cargoEndX = x + vesselWidth - bowInset - 6;
  const cargoLength = Math.max(20, cargoEndX - cargoStartX);

  // 3 a 5 porões conforme o comprimento do navio
  const numHolds = vesselWidth > 260 ? 5 : vesselWidth > 150 ? 4 : 3;
  const craneGap = Math.max(12, Math.min(24, cargoLength * 0.09));
  const totalHoldLength = cargoLength - (numHolds - 1) * craneGap;
  const holdW = Math.max(12, totalHoldLength / numHolds);
  const holdH = Math.max(10, vesselHeight * 0.58);
  const holdY = y + (vesselHeight - holdH) / 2;

  return (
    <g className="deck-general-cargo">
      {/* Chapa base de aço do convés */}
      <rect
        x={cargoStartX - 3}
        y={y + 3}
        width={cargoLength + 6}
        height={vesselHeight - 6}
        fill="#e6ecf0"
        opacity="0.8"
      />

      {/* Porões de Carga com Tampas de Escotilha Tipo Painel */}
      {Array.from({ length: numHolds }, (_, i) => {
        const hX = cargoStartX + i * (holdW + craneGap);
        const panels = holdW > 24 ? 4 : 2;
        const panelW = (holdW - 2) / panels;
        return (
          <g key={`hold-${i}`}>
            {/* Braçola externa do porão (Coaming) */}
            <rect
              x={hX}
              y={holdY}
              width={holdW}
              height={holdH}
              rx="1.5"
              fill="#3a4b5d"
              stroke="#1e293b"
              strokeWidth="1.1"
            />
            {/* Painéis da tampa de escotilha (Hatch cover panels) */}
            {Array.from({ length: panels }, (_, p) => (
              <rect
                key={`panel-${p}`}
                x={hX + 1 + p * panelW}
                y={holdY + 1}
                width={Math.max(1, panelW - 1)}
                height={holdH - 2}
                fill={p % 2 === 0 ? "#4f6277" : "#45566a"}
                stroke="#687e95"
                strokeWidth="0.5"
                rx="0.5"
              />
            ))}
            {/* Vinco transversal central */}
            <line
              x1={hX}
              y1={holdY + holdH / 2}
              x2={hX + holdW}
              y2={holdY + holdH / 2}
              stroke="#263442"
              strokeWidth="0.7"
              strokeDasharray="3 2"
            />
            {/* Etiqueta de identificação do porão */}
            {holdW > 20 && (
              <text
                x={hX + holdW / 2}
                y={holdY + holdH / 2 + 2.5}
                textAnchor="middle"
                fontSize="5.2px"
                fontWeight="700"
                fill="#cbd5e1"
                opacity="0.85"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                P{i + 1}
              </text>
            )}
          </g>
        );
      })}

      {/* Guindastes de Bordo (Deck Cranes) entre os porões */}
      {Array.from({ length: numHolds - 1 }, (_, i) => {
        const craneCenterX = cargoStartX + (i + 1) * holdW + i * craneGap + craneGap / 2;
        const craneRadius = Math.min(4.6, vesselHeight * 0.16);
        const boomLength = Math.min(holdW * 0.85, 24);
        const boomDirection = i % 2 === 0 ? 1 : -1;
        const boomEndX = craneCenterX + boomLength * boomDirection;
        const boomEndY = y + vesselHeight / 2 + (i % 2 === 0 ? -2 : 2);

        return (
          <g key={`crane-${i}`}>
            {/* Base da casaria do guindaste */}
            <rect
              x={craneCenterX - craneRadius - 1.2}
              y={y + (vesselHeight - craneRadius * 2.6) / 2}
              width={(craneRadius + 1.2) * 2}
              height={craneRadius * 2.6}
              rx="1"
              fill="#cbd5e1"
              stroke="#64748b"
              strokeWidth="0.6"
            />
            {/* Coluna / Pedestal circular */}
            <circle
              cx={craneCenterX}
              cy={y + vesselHeight / 2}
              r={craneRadius}
              fill="#f8fafc"
              stroke="#1e293b"
              strokeWidth="1.1"
            />
            {/* Cabine de comando do guindasteiro */}
            <rect
              x={craneCenterX - 2}
              y={y + vesselHeight / 2 - 2}
              width="4"
              height="4"
              rx="0.8"
              fill="#e2e8f0"
              stroke="#0f172a"
              strokeWidth="0.8"
            />
            {/* Lança tubular amarela (Boom/Jib) de alta visibilidade */}
            <line
              x1={craneCenterX}
              y1={y + vesselHeight / 2}
              x2={boomEndX}
              y2={boomEndY}
              stroke="#f59e0b"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            {/* Cabo de sustentação e moitão/gancho */}
            <line
              x1={craneCenterX}
              y1={y + vesselHeight / 2}
              x2={boomEndX}
              y2={boomEndY}
              stroke="#b45309"
              strokeWidth="0.6"
              strokeDasharray="2 1"
            />
            <circle cx={boomEndX} cy={boomEndY} r="1.2" fill="#1e293b" />
          </g>
        );
      })}

      {/* Castelo de Proa com molinetes e guinchos */}
      <path
        d={`M ${x + vesselWidth - bowInset} ${y + 3} L ${x + vesselWidth - 5} ${y + vesselHeight / 2} L ${x + vesselWidth - bowInset} ${y + vesselHeight - 3} Z`}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth="0.8"
      />
      <circle cx={x + vesselWidth - bowInset / 2} cy={y + vesselHeight * 0.35} r="1.6" fill="#475569" stroke="#1e293b" strokeWidth="0.6" />
      <circle cx={x + vesselWidth - bowInset / 2} cy={y + vesselHeight * 0.65} r="1.6" fill="#475569" stroke="#1e293b" strokeWidth="0.6" />

      {/* Superestrutura de Ré / Passadiço */}
      <rect
        x={houseX}
        y={houseY}
        width={houseW}
        height={houseH}
        rx="2"
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth="1.2"
      />
      {/* Asas do passadiço */}
      <line
        x1={houseX + houseW * 0.72}
        y1={y + 2}
        x2={houseX + houseW * 0.72}
        y2={y + vesselHeight - 2}
        stroke={color.stroke}
        strokeWidth="1.4"
      />
      {/* Chaminé */}
      <ellipse
        cx={houseX + houseW * 0.28}
        cy={y + vesselHeight / 2}
        rx={Math.max(2.5, houseW * 0.14)}
        ry={Math.max(2, vesselHeight * 0.12)}
        fill="#1e293b"
        stroke="#0f172a"
        strokeWidth="0.8"
      />
      {/* Botes salva-vidas fechados em laranja */}
      <rect x={houseX + 2} y={y + 1} width={Math.max(6, houseW * 0.3)} height="2.2" rx="1" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
      <rect x={houseX + 2} y={y + vesselHeight - 3.2} width={Math.max(6, houseW * 0.3)} height="2.2" rx="1" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
    </g>
  );
}

/** Renderiza o convés de um Navio Tanque (Chemical/Products Tanker) com manifold central, tubulações, domos de carga e guindaste de mangotes */
function renderTankerDeck(
  x: number,
  y: number,
  vesselWidth: number,
  vesselHeight: number,
  bowInset: number,
  color: { fill: string; stroke: string }
) {
  // Superestrutura de ré encostada no espelho de popa
  const houseX = x + 5;
  const houseW = Math.max(18, Math.min(46, vesselWidth * 0.14));
  const houseH = Math.max(14, vesselHeight * 0.78);
  const houseY = y + (vesselHeight - houseH) / 2;

  // Área dos tanques de carga
  const tankStartX = houseX + houseW + 4;
  const tankEndX = x + vesselWidth - bowInset - 4;
  const tankLength = Math.max(20, tankEndX - tankStartX);

  // Número de compartimentos de tanques
  const numTanks = vesselWidth > 260 ? 6 : vesselWidth > 140 ? 5 : 4;
  const tankSecW = tankLength / numTanks;

  // Passadiço elevado central e rack de tubulações
  const trunkH = Math.max(5.5, Math.min(10, vesselHeight * 0.22));
  const trunkY = y + (vesselHeight - trunkH) / 2;

  // Estação do Manifold de Carga a meia-nau (50% do LOA)
  const manifoldX = x + vesselWidth * 0.50;
  const manifoldW = Math.max(12, Math.min(22, vesselWidth * 0.055));

  return (
    <g className="deck-tanker">
      {/* Chapa base do convés de tanques */}
      <rect
        x={tankStartX}
        y={y + 3}
        width={tankLength}
        height={vesselHeight - 6}
        fill="#dae4ec"
        stroke="#94a3b8"
        strokeWidth="0.6"
      />

      {/* Cavernas transversais de tanques e Domos de Inspeção */}
      {Array.from({ length: numTanks }, (_, i) => {
        const tX = tankStartX + i * tankSecW;
        const midX = tX + tankSecW / 2;
        const domeR = Math.min(2.7, vesselHeight * 0.08);

        return (
          <g key={`tank-${i}`}>
            {/* Divisória transversal entre tanques de carga */}
            {i > 0 && (
              <line
                x1={tX}
                y1={y + 3}
                x2={tX}
                y2={y + vesselHeight - 3}
                stroke="#64748b"
                strokeWidth="0.8"
                strokeDasharray="3 2"
              />
            )}
            {/* Domo do tanque de Bombordo e Válvula P/V */}
            <circle
              cx={midX}
              cy={y + (trunkY - y) / 2 + 1}
              r={domeR}
              fill="#ffffff"
              stroke="#334155"
              strokeWidth="0.9"
            />
            <circle cx={midX + 2.5} cy={y + (trunkY - y) / 2 + 1} r="0.9" fill="#dc2626" />

            {/* Domo do tanque de Boreste e Válvula P/V */}
            <circle
              cx={midX}
              cy={trunkY + trunkH + (y + vesselHeight - trunkY - trunkH) / 2 - 1}
              r={domeR}
              fill="#ffffff"
              stroke="#334155"
              strokeWidth="0.9"
            />
            <circle cx={midX + 2.5} cy={trunkY + trunkH + (y + vesselHeight - trunkY - trunkH) / 2 - 1} r="0.9" fill="#dc2626" />
          </g>
        );
      })}

      {/* Passadiço Central Elevado (Trunk / Catwalk) */}
      <rect
        x={tankStartX}
        y={trunkY}
        width={tankLength}
        height={trunkH}
        fill="#94a3b8"
        stroke="#475569"
        strokeWidth="0.8"
      />

      {/* Tubulações de Convés Padronizadas por Cores */}
      {/* 1. Gás Inerte / Linha de Retorno de Vapores (Amarelo) */}
      <line
        x1={tankStartX}
        y1={trunkY + 1.2}
        x2={tankStartX + tankLength}
        y2={trunkY + 1.2}
        stroke="#facc15"
        strokeWidth="0.9"
      />
      {/* 2. Tubulação de Carga Principal (Vinho escuro) */}
      <line
        x1={tankStartX}
        y1={trunkY + trunkH * 0.35}
        x2={tankStartX + tankLength}
        y2={trunkY + trunkH * 0.35}
        stroke="#991b1b"
        strokeWidth="1.2"
      />
      {/* 3. Tubulação de Produtos / Químicos (Azul) */}
      <line
        x1={tankStartX}
        y1={trunkY + trunkH * 0.65}
        x2={tankStartX + tankLength}
        y2={trunkY + trunkH * 0.65}
        stroke="#0284c7"
        strokeWidth="1.1"
      />
      {/* 4. Linha de Incêndio e Lavagem (Vermelho vivo) */}
      <line
        x1={tankStartX}
        y1={trunkY + trunkH - 1.2}
        x2={tankStartX + tankLength}
        y2={trunkY + trunkH - 1.2}
        stroke="#ef4444"
        strokeWidth="0.8"
      />

      {/* Manifold de Carga a Meia-Nau (Bandeja de Contenção Amarela e Flanges) */}
      <rect
        x={manifoldX - manifoldW / 2}
        y={y + 1.5}
        width={manifoldW}
        height={vesselHeight - 3}
        rx="1"
        fill="#fef08a"
        stroke="#ca8a04"
        strokeWidth="1.2"
      />
      {/* Conexões transversais de válvulas no manifold */}
      <line
        x1={manifoldX - 3}
        y1={y + 2}
        x2={manifoldX - 3}
        y2={y + vesselHeight - 2}
        stroke="#991b1b"
        strokeWidth="1.6"
      />
      <line
        x1={manifoldX}
        y1={y + 2}
        x2={manifoldX}
        y2={y + vesselHeight - 2}
        stroke="#0284c7"
        strokeWidth="1.6"
      />
      <line
        x1={manifoldX + 3}
        y1={y + 2}
        x2={manifoldX + 3}
        y2={y + vesselHeight - 2}
        stroke="#facc15"
        strokeWidth="1.4"
      />
      {/* Flanges de conexão em terra (Boreste e Bombordo) */}
      <rect x={manifoldX - 4.5} y={y + 0.5} width="9" height="2" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
      <rect x={manifoldX - 4.5} y={y + vesselHeight - 2.5} width="9" height="2" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />

      {/* Guindaste de Mangotes (Hose Handling Crane) ao lado do Manifold */}
      <g>
        <circle
          cx={manifoldX + manifoldW / 2 + 3.5}
          cy={y + vesselHeight / 2}
          r="2.8"
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="1"
        />
        {/* Lança amarela operando sobre o manifold */}
        <line
          x1={manifoldX + manifoldW / 2 + 3.5}
          y1={y + vesselHeight / 2}
          x2={manifoldX - 2}
          y2={y + 4}
          stroke="#f59e0b"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx={manifoldX - 2} cy={y + 4} r="1" fill="#1e293b" />
      </g>

      {/* Proa com guinchos de manobra */}
      <path
        d={`M ${x + vesselWidth - bowInset} ${y + 3} L ${x + vesselWidth - 4} ${y + vesselHeight / 2} L ${x + vesselWidth - bowInset} ${y + vesselHeight - 3} Z`}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth="0.8"
      />
      <circle cx={x + vesselWidth - bowInset / 2} cy={y + vesselHeight * 0.35} r="1.6" fill="#475569" stroke="#1e293b" strokeWidth="0.6" />
      <circle cx={x + vesselWidth - bowInset / 2} cy={y + vesselHeight * 0.65} r="1.6" fill="#475569" stroke="#1e293b" strokeWidth="0.6" />

      {/* Superestrutura de Ré / Passadiço */}
      <rect
        x={houseX}
        y={houseY}
        width={houseW}
        height={houseH}
        rx="2"
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth="1.2"
      />
      {/* Asas do passadiço */}
      <line
        x1={houseX + houseW * 0.74}
        y1={y + 2}
        x2={houseX + houseW * 0.74}
        y2={y + vesselHeight - 2}
        stroke={color.stroke}
        strokeWidth="1.6"
      />
      {/* Chaminé da praça de máquinas */}
      <ellipse
        cx={houseX + houseW * 0.28}
        cy={y + vesselHeight / 2}
        rx={Math.max(2.5, houseW * 0.15)}
        ry={Math.max(2, vesselHeight * 0.13)}
        fill="#1e293b"
        stroke="#0f172a"
        strokeWidth="0.8"
      />
      {/* Botes salva-vidas totalmente fechados */}
      <rect x={houseX + 2} y={y + 1} width={Math.max(6, houseW * 0.32)} height="2.2" rx="1" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
      <rect x={houseX + 2} y={y + vesselHeight - 3.2} width={Math.max(6, houseW * 0.32)} height="2.2" rx="1" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
    </g>
  );
}

/** Renderiza o convés de uma Embarcação de Pesquisa / Hidrográfica (Research Survey Vessel - ex: Ocean Mermaid) com convés oceanográfico de popa, pórtico A-Frame e guinchos */
function renderResearchSurveyDeck(
  x: number,
  y: number,
  vesselWidth: number,
  vesselHeight: number,
  bowInset: number,
  color: { fill: string; stroke: string }
) {
  // Superestrutura de meia-proa
  const houseW = Math.max(16, Math.min(50, vesselWidth * 0.28));
  const houseH = Math.max(12, vesselHeight * 0.78);
  const houseX = x + vesselWidth * 0.42;
  const houseY = y + (vesselHeight - houseH) / 2;

  // Convés oceanográfico de popa
  const surveyDeckX = x + 6;
  const surveyDeckW = Math.max(10, houseX - surveyDeckX - 2);

  return (
    <g>
      {/* Convés de trabalho oceanográfico na popa (antiderrapante cinza escuro) */}
      <rect
        x={surveyDeckX}
        y={y + 2.5}
        width={surveyDeckW}
        height={vesselHeight - 5}
        fill="#334155"
        stroke="#1e293b"
        strokeWidth="0.8"
        rx="1"
      />
      {/* Laboratórios em módulos de contêineres científicos (Lab Vans) */}
      <rect x={surveyDeckX + 4} y={y + 4} width={Math.max(6, surveyDeckW * 0.35)} height={vesselHeight * 0.32} fill="#e2e8f0" stroke="#475569" strokeWidth="0.6" rx="0.5" />
      <rect x={surveyDeckX + 4} y={y + vesselHeight - vesselHeight * 0.32 - 4} width={Math.max(6, surveyDeckW * 0.35)} height={vesselHeight * 0.32} fill="#0284c7" stroke="#0369a1" strokeWidth="0.6" rx="0.5" />

      {/* Guinchos de cabos oceanográficos (CTD winches) */}
      <circle cx={surveyDeckX + surveyDeckW * 0.65} cy={y + vesselHeight * 0.35} r="2.8" fill="#1e293b" stroke="#64748b" strokeWidth="0.6" />
      <circle cx={surveyDeckX + surveyDeckW * 0.65} cy={y + vesselHeight * 0.65} r="2.8" fill="#1e293b" stroke="#64748b" strokeWidth="0.6" />

      {/* Pórtico A-Frame de Popa em Laranja Internacional */}
      <rect x={x + 3} y={y + 2} width="4" height={vesselHeight - 4} fill="#ea580c" stroke="#9a3412" strokeWidth="0.9" rx="0.8" />
      <line x1={x + 3} y1={y + vesselHeight / 2} x2={x + 10} y2={y + vesselHeight / 2} stroke="#ea580c" strokeWidth="1.6" />

      {/* Superestrutura científica de meia-proa */}
      <rect
        x={houseX}
        y={houseY}
        width={houseW}
        height={houseH}
        rx="2"
        fill="#1e40af"
        stroke="#1e3a8a"
        strokeWidth="1.2"
      />
      {/* Passadiço com asas */}
      <line
        x1={houseX + houseW * 0.68}
        y1={y + 1.5}
        x2={houseX + houseW * 0.68}
        y2={y + vesselHeight - 1.5}
        stroke="#ffffff"
        strokeWidth="1.6"
      />
      {/* Cúpulas de radar e satélite brancas */}
      <circle cx={houseX + houseW * 0.35} cy={y + vesselHeight * 0.38} r="2.2" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />
      <circle cx={houseX + houseW * 0.35} cy={y + vesselHeight * 0.62} r="2.2" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />

      {/* Proa com quebra-mar em V */}
      <path
        d={`M ${x + vesselWidth - bowInset} ${y + 3} L ${x + vesselWidth - 4} ${y + vesselHeight / 2} L ${x + vesselWidth - bowInset} ${y + vesselHeight - 3} Z`}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth="0.8"
      />
    </g>
  );
}

/** Renderiza o convés de uma Embarcação de Apoio Offshore (PSV / AHTS / Supply) com convés aberto de madeira na popa e crash rails */
function renderOffshoreDeck(
  x: number,
  y: number,
  vesselWidth: number,
  vesselHeight: number,
  bowInset: number,
  color: { fill: string; stroke: string },
  vesselName?: string
) {
  // Superestrutura na PROA
  const houseW = Math.max(16, Math.min(48, vesselWidth * 0.28));
  const houseH = Math.max(12, vesselHeight * 0.82);
  const houseX = x + vesselWidth - bowInset - houseW;
  const houseY = y + (vesselHeight - houseH) / 2;

  // Enorme convés de carga aberto na ré em pranchamento de madeira
  const aftDeckX = x + 6;
  const aftDeckW = Math.max(12, houseX - aftDeckX);

  const isPipeLayer = Boolean(
    vesselName && (vesselName.toUpperCase().includes("SEVEN") || vesselName.toUpperCase().includes("PIPE"))
  );

  return (
    <g>
      {/* Convés de madeira marítima na popa */}
      <rect
        x={aftDeckX}
        y={y + 2.5}
        width={aftDeckW}
        height={vesselHeight - 5}
        fill="#854d0e"
        stroke="#713f12"
        strokeWidth="0.8"
        rx="1"
      />
      {/* Trilhos de peação de carga em aço */}
      <line x1={aftDeckX} y1={y + vesselHeight * 0.35} x2={aftDeckX + aftDeckW} y2={y + vesselHeight * 0.35} stroke="#a16207" strokeWidth="0.7" strokeDasharray="4 2" />
      <line x1={aftDeckX} y1={y + vesselHeight * 0.65} x2={aftDeckX + aftDeckW} y2={y + vesselHeight * 0.65} stroke="#a16207" strokeWidth="0.7" strokeDasharray="4 2" />

      {/* Amuradas laterais com topo amarelo (Crash Rails) */}
      <rect x={aftDeckX} y={y + 1} width={aftDeckW} height="1.8" fill="#eab308" stroke="#ca8a04" strokeWidth="0.4" />
      <rect x={aftDeckX} y={y + vesselHeight - 2.8} width={aftDeckW} height="1.8" fill="#eab308" stroke="#ca8a04" strokeWidth="0.4" />

      {/* Rolo de popa no espelho */}
      <rect x={x + 2} y={y + vesselHeight * 0.25} width="3" height={vesselHeight * 0.5} rx="1" fill="#1e293b" stroke="#0f172a" strokeWidth="0.6" />

      {/* Guindaste articulado subsea */}
      <circle cx={houseX - 5} cy={y + vesselHeight * 0.3} r="3" fill="#1e3a8a" stroke="#0f172a" strokeWidth="0.7" />
      <line x1={houseX - 5} y1={y + vesselHeight * 0.3} x2={houseX - 18} y2={y + vesselHeight * 0.35} stroke="#eab308" strokeWidth="1.6" strokeLinecap="round" />

      {/* Carretéis / Carrosséis de Dutos Flexíveis Submarinos (Pipe Reels / Carousels para Pipe Layer) */}
      {isPipeLayer && (() => {
        const reel1X = aftDeckX + aftDeckW * 0.28;
        const reel2X = aftDeckX + aftDeckW * 0.62;
        const reelY = y + vesselHeight / 2;
        const reelR = Math.min(7.5, vesselHeight * 0.30);
        return (
          <g className="plsv-pipe-reels">
            <title>Carretéis de Dutos Flexíveis Submarinos (Pipe Carousels)</title>
            {[reel1X, reel2X].map((rx, idx) => (
              <g key={`reel-${idx}`}>
                <circle cx={rx} cy={reelY} r={reelR} fill="#1e293b" stroke="#64748b" strokeWidth="1" />
                <circle cx={rx} cy={reelY} r={reelR * 0.78} fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
                <circle cx={rx} cy={reelY} r={reelR * 0.52} fill="#334155" stroke="#f59e0b" strokeWidth="0.8" />
                <circle cx={rx} cy={reelY} r={reelR * 0.22} fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
              </g>
            ))}
          </g>
        );
      })()}

      {/* Torre VLS de Lançamento de Dutos (Vertical Lay System Tower para Pipe Layer) */}
      {isPipeLayer && (() => {
        const towerX = houseX - 8;
        const towerY = y + vesselHeight / 2;
        const towerW = Math.max(7, vesselWidth * 0.07);
        const towerH = vesselHeight * 0.60;
        return (
          <g className="plsv-vls-tower">
            <title>Torre VLS de Lançamento de Dutos Submarinos (Pipe Lay Tower)</title>
            <rect
              x={towerX - towerW / 2}
              y={towerY - towerH / 2}
              width={towerW}
              height={towerH}
              rx="1.2"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="1.1"
            />
            <line x1={towerX - towerW / 2} y1={towerY - towerH / 2} x2={towerX + towerW / 2} y2={towerY + towerH / 2} stroke="#dc2626" strokeWidth="1.2" />
            <line x1={towerX - towerW / 2} y1={towerY + towerH / 2} x2={towerX + towerW / 2} y2={towerY - towerH / 2} stroke="#dc2626" strokeWidth="1.2" />
            <rect x={towerX - 2.2} y={towerY - 2.8} width="4.4" height="5.6" rx="0.5" fill="#eab308" stroke="#a16207" strokeWidth="0.6" />
          </g>
        );
      })()}

      {/* Superestrutura na PROA */}
      <rect
        x={houseX}
        y={houseY}
        width={houseW}
        height={houseH}
        rx="2"
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth="1.2"
      />
      {/* Asas do passadiço */}
      <line
        x1={houseX + houseW * 0.32}
        y1={y + 1.5}
        x2={houseX + houseW * 0.32}
        y2={y + vesselHeight - 1.5}
        stroke={color.stroke}
        strokeWidth="1.6"
      />
      {/* Botes fechados embutidos */}
      <rect x={houseX + 4} y={y + 1} width={Math.max(5, houseW * 0.26)} height="2.2" rx="1" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />
      <rect x={houseX + 4} y={y + vesselHeight - 3.2} width={Math.max(5, houseW * 0.26)} height="2.2" rx="1" fill="#ea580c" stroke="#9a3412" strokeWidth="0.5" />

      {/* Heliponto sobre a Proa (Helideck em balanço para Pipe Layer / PLSV) */}
      {isPipeLayer && (() => {
        const heliR = Math.min(8.5, vesselHeight * 0.36);
        const heliX = houseX + houseW - 1.5;
        const heliY = y + vesselHeight / 2;
        return (
          <g className="plsv-helideck">
            <title>Heliponto (Helideck) da Proa</title>
            <circle cx={heliX} cy={heliY} r={heliR + 0.8} fill="#475569" stroke="#1e293b" strokeWidth="0.8" />
            <circle cx={heliX} cy={heliY} r={heliR} fill="#334155" stroke="#f8fafc" strokeWidth="0.8" />
            <circle cx={heliX} cy={heliY} r={heliR * 0.65} fill="none" stroke="#ffffff" strokeWidth="0.9" strokeDasharray="3 1.5" />
            <text
              x={heliX}
              y={heliY + 2.2}
              textAnchor="middle"
              fontSize={`${heliR * 0.85}px`}
              fontWeight="900"
              fill="#eab308"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              H
            </text>
          </g>
        );
      })()}
    </g>
  );
}

/** Renderiza o blueprint de topo de um Portêiner STS (guindaste de cais para contêineres P4 a P9) */
function renderPortainerSvg({
  portainer,
  scale,
  trackStart,
  isHovered,
  isDragging,
  isPresentationMode = false,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  portainer: Portainer;
  scale: number;
  trackStart: number;
  isHovered: boolean;
  isDragging: boolean;
  isPresentationMode?: boolean;
  onPointerDown: (e: React.PointerEvent<SVGGElement>) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const cx = trackStart + portainer.position * scale;
  const seaRailY = 242;
  const landRailY = 272;
  const boomOutreach = portainer.boomOutreach ?? 55;
  // Alcance real da lança sobre o navio projetando-se a partir do costado de atracação
  const boomTipY = VESSEL_BERTH_BOTTOM_Y - boomOutreach * scale;
  const sillLeftX = cx - 11;
  const sillRightX = cx + 11;
  const girderLeftX = cx - 5.2;
  const girderRightX = cx + 5.2;

  // Rótulo com setas conforme o modelo original do terminal
  let arrowLabel = portainer.name;
  if (portainer.id === "P7") arrowLabel = "P7 ▶";
  else if (portainer.id === "P6") arrowLabel = "◀ P6";
  else if (portainer.id === "P5") arrowLabel = "P5 ▶";
  else if (portainer.id === "P4") arrowLabel = "◀ P4";

  const numRungs = Math.max(6, Math.floor((seaRailY - boomTipY) / 8));
  const trolleyY = (VESSEL_BERTH_BOTTOM_Y + boomTipY) / 2;

  return (
    <g
      key={`portainer-${portainer.id}`}
      className={`portainer-crane-group ${isDragging ? "portainer-dragging" : ""}`}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        opacity: isPresentationMode
          ? (isDragging ? 0.95 : isHovered ? 0.85 : 0.22)
          : (isDragging ? 0.98 : 1),
        transition: "opacity 0.2s ease",
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <title>{`Portêiner ${portainer.name} · Lança: ${boomOutreach} m · Estação ${portainer.position.toFixed(1).replace(".", ",")} m · Arraste para reposicionar ao longo do cais`}</title>

      {/* Linha guia de centro / alinhamento do portêiner */}
      <line
        x1={cx}
        y1={boomTipY}
        x2={cx}
        y2={284}
        stroke={portainer.color}
        strokeWidth="0.8"
        strokeDasharray="3 3"
        opacity="0.4"
      />

      {/* Lança Marítima (Boom) projetando-se sobre o navio com alcance real configurado */}
      {/* Vigas principais da lança */}
      <line
        x1={girderLeftX}
        y1={boomTipY}
        x2={girderLeftX}
        y2={landRailY}
        stroke={portainer.color}
        strokeWidth="2.2"
      />
      <line
        x1={girderRightX}
        y1={boomTipY}
        x2={girderRightX}
        y2={landRailY}
        stroke={portainer.color}
        strokeWidth="2.2"
      />

      {/* Ponta da lança marítima (Headframe) com indicador de alcance em metros */}
      <line
        x1={girderLeftX - 3}
        y1={boomTipY}
        x2={girderRightX + 3}
        y2={boomTipY}
        stroke="#0f172a"
        strokeWidth="2.8"
      />
      <circle cx={girderLeftX} cy={boomTipY} r="1.4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />
      <circle cx={girderRightX} cy={boomTipY} r="1.4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />

      {/* Etiqueta na ponta com a metragem da lança (permite conferir visualmente a cobertura da boca) */}
      <rect
        x={cx - 11}
        y={boomTipY - 8.5}
        width="22"
        height="6.8"
        rx="1.5"
        fill="#0f172a"
        stroke={portainer.color}
        strokeWidth="0.6"
        opacity={isHovered ? 1 : 0.85}
      />
      <text
        x={cx}
        y={boomTipY - 4.8}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: "#ffffff",
          fontSize: "4.8px",
          fontWeight: 900,
          letterSpacing: "0.2px",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {boomOutreach}m
      </text>

      {/* Tirantes e treliças diagonais da lança (Lattice rungs) */}
      {Array.from({ length: numRungs }, (_, i) => {
        const yRung = boomTipY + 4 + i * 8;
        if (yRung >= seaRailY) return null;
        return (
          <g key={`rung-${i}`}>
            <line
              x1={girderLeftX}
              y1={yRung}
              x2={girderRightX}
              y2={yRung}
              stroke={portainer.color}
              strokeWidth="0.9"
              opacity="0.8"
            />
            <line
              x1={girderLeftX}
              y1={yRung}
              x2={girderRightX}
              y2={yRung + 8}
              stroke={portainer.color}
              strokeWidth="0.6"
              opacity="0.55"
            />
          </g>
        );
      })}

      {/* Carro do Trole (Trolley) com Spreader telescópico sobre as baías de contêineres */}
      <g>
        {/* Carro do trole sobre os trilhos da lança */}
        <rect
          x={cx - 6}
          y={trolleyY - 4.5}
          width="12"
          height="9"
          rx="1"
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="0.9"
        />
        {/* Barra amarela do spreader telescópico */}
        <rect
          x={cx - 7.5}
          y={trolleyY - 2}
          width="15"
          height="4"
          rx="0.6"
          fill="#eab308"
          stroke="#854d0e"
          strokeWidth="0.6"
        />
        {/* 4 guias / twistlocks nos cantos do spreader */}
        <circle cx={cx - 6.5} cy={trolleyY - 1} r="0.8" fill="#1e293b" />
        <circle cx={cx + 6.5} cy={trolleyY - 1} r="0.8" fill="#1e293b" />
        <circle cx={cx - 6.5} cy={trolleyY + 1} r="0.8" fill="#1e293b" />
        <circle cx={cx + 6.5} cy={trolleyY + 1} r="0.8" fill="#1e293b" />
        {/* Cabine panorâmica envidraçada do operador do trole */}
        <rect
          x={cx + 6}
          y={trolleyY - 3}
          width="3.5"
          height="6"
          rx="0.6"
          fill="#38bdf8"
          stroke="#0284c7"
          strokeWidth="0.5"
          opacity="0.9"
        />
      </g>

      {/* Pórtico e Pernas do Guindaste sobre os dois trilhos do cais */}
      {/* Vigas balancins longitudinais (Sills) conectando os bogies de cada lado */}
      <line
        x1={sillLeftX}
        y1={seaRailY - 1}
        x2={sillLeftX}
        y2={landRailY + 1}
        stroke={portainer.color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <line
        x1={sillRightX}
        y1={seaRailY - 1}
        x2={sillRightX}
        y2={landRailY + 1}
        stroke={portainer.color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Travessas transversais do portal sobre o cais */}
      <line
        x1={sillLeftX}
        y1={seaRailY + 3}
        x2={sillRightX}
        y2={seaRailY + 3}
        stroke={portainer.color}
        strokeWidth="2.2"
      />
      <line
        x1={sillLeftX}
        y1={landRailY - 3}
        x2={sillRightX}
        y2={landRailY - 3}
        stroke={portainer.color}
        strokeWidth="2.2"
      />

      {/* Contraventamento diagonal do pórtico (X-bracing) */}
      <line
        x1={sillLeftX + 1}
        y1={seaRailY + 4}
        x2={sillRightX - 1}
        y2={landRailY - 4}
        stroke={portainer.color}
        strokeWidth="1.2"
        opacity="0.8"
      />
      <line
        x1={sillRightX - 1}
        y1={seaRailY + 4}
        x2={sillLeftX + 1}
        y2={landRailY - 4}
        stroke={portainer.color}
        strokeWidth="1.2"
        opacity="0.8"
      />

      {/* 4 Truques de Rodas (Bogies / Wheel trucks) sobre os trilhos */}
      {/* Bogies do trilho marítimo (seaward rail) */}
      <rect x={sillLeftX - 3.5} y={seaRailY - 2.5} width="7" height="5" rx="1.2" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx={sillLeftX - 1.8} cy={seaRailY} r="1" fill="#cbd5e1" />
      <circle cx={sillLeftX + 1.8} cy={seaRailY} r="1" fill="#cbd5e1" />

      <rect x={sillRightX - 3.5} y={seaRailY - 2.5} width="7" height="5" rx="1.2" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx={sillRightX - 1.8} cy={seaRailY} r="1" fill="#cbd5e1" />
      <circle cx={sillRightX + 1.8} cy={seaRailY} r="1" fill="#cbd5e1" />

      {/* Bogies do trilho terrestre (landward rail) */}
      <rect x={sillLeftX - 3.5} y={landRailY - 2.5} width="7" height="5" rx="1.2" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx={sillLeftX - 1.8} cy={landRailY} r="1" fill="#cbd5e1" />
      <circle cx={sillLeftX + 1.8} cy={landRailY} r="1" fill="#cbd5e1" />

      <rect x={sillRightX - 3.5} y={landRailY - 2.5} width="7" height="5" rx="1.2" fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx={sillRightX - 1.8} cy={landRailY} r="1" fill="#cbd5e1" />
      <circle cx={sillRightX + 1.8} cy={landRailY} r="1" fill="#cbd5e1" />

      {/* Contra-lança terrestre (Backreach) e Casa de Máquinas / Guincho (Machinery House) */}
      <rect
        x={cx - 7.5}
        y={landRailY + 0.5}
        width="15"
        height="9"
        rx="1.5"
        fill={portainer.color}
        stroke="#0f172a"
        strokeWidth="1"
      />
      <rect
        x={cx - 5.5}
        y={landRailY + 2}
        width="11"
        height="6"
        rx="0.8"
        fill="#1e293b"
        opacity="0.35"
      />
      <line
        x1={cx}
        y1={landRailY + 1}
        x2={cx}
        y2={landRailY + 9}
        stroke="#ffffff"
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* Plaqueta de identificação do Portêiner (ex: P7, P6, P9, etc.) conforme desenho oficial */}
      <g>
        <rect
          x={cx - 15}
          y={284}
          width="30"
          height="16"
          rx="3.5"
          fill={portainer.badgeColor}
          stroke={isHovered ? "#facc15" : "#ffffff"}
          strokeWidth={isHovered ? "1.8" : "1.2"}
          filter={isHovered || isDragging ? "drop-shadow(0 2px 5px rgba(0,0,0,0.35))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.2))"}
        />
        <text
          x={cx}
          y={292}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: "#ffffff",
            fontSize: "8.5px",
            fontWeight: 900,
            letterSpacing: "0.4px",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {arrowLabel}
        </text>

        {/* Cota em metros logo abaixo do badge */}
        <text
          x={cx}
          y={304}
          textAnchor="middle"
          style={{
            fill: "#334155",
            fontSize: "6px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {Math.round(portainer.position)} m
        </text>
      </g>
    </g>
  );
}

export default function BerthBlueprint({
  scenario,
  zoom,
  selectedVesselId,
  onSelectVessel,
  onMoveVessel,
  onAssignMooringLine,
  onUpdateBollard,
  onMovePortainer,
  onPortainerLimitHit,
  isPresentationMode = false,
}: BerthBlueprintProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<
    | { kind: "vessel"; id: string; grabOffset: number }
    | { kind: "mooring"; vesselId: string; lineId: string }
    | { kind: "portainer"; id: string; grabOffset: number }
    | null
  >(null);
  const [activeBollardId, setActiveBollardId] = useState<string | null>(null);
  const [editingBollardId, setEditingBollardId] = useState<string | null>(null);
  const [editId, setEditId] = useState("");
  const [editType, setEditType] = useState<BollardType>("duplo");
  const [editPosition, setEditPosition] = useState<string>("");
  const [lineDragPoint, setLineDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoveredBollardId, setHoveredBollardId] = useState<string | null>(null);
  const [hoveredPortainerId, setHoveredPortainerId] = useState<string | null>(null);
  const total = scenario.segments.reduce((sum, segment) => sum + Math.max(0, segment.length), 0);
  const scale = Math.max(0.68, 900 / Math.max(total, 1));
  const width = total * scale + PAD * 2;
  const trackStart = PAD;
  const trackEnd = PAD + total * scale;
  const tickEvery = total > 1500 ? 100 : 50;
  const offsets = segmentOffsets(scenario.segments);
  const sortedVessels = [...scenario.vessels].sort((a, b) => a.position - b.position);
  const bollardById = new Map(scenario.bollards.map((bollard) => [bollard.id, bollard]));
  const bollardDisplays = bollardDisplayPositions(scenario.bollards, total);
  const bollardDisplayById = new Map(bollardDisplays.map((bollard) => [bollard.id, bollard]));
  const hoveredDisplay = hoveredBollardId ? bollardDisplayById.get(hoveredBollardId) : null;
  const hoveredBollard = hoveredBollardId ? bollardById.get(hoveredBollardId) : null;
  const issueByVessel = new Map<string, string[]>();

  const operationalLimits = getPortainerOperationalLimits(scenario.bollards);
  const p5LimitM = operationalLimits.P5?.min;
  const p6LimitM = operationalLimits.P6?.max;
  const p4LimitM = operationalLimits.P4?.max;
  const p5LimitX = p5LimitM !== undefined ? trackStart + p5LimitM * scale : null;
  const p6LimitX = p6LimitM !== undefined ? trackStart + p6LimitM * scale : null;
  const p4LimitX = p4LimitM !== undefined ? trackStart + p4LimitM * scale : null;

  const portainersList = scenario.portainers ?? DEFAULT_PORTAINERS;
  const p5Portainer = portainersList.find((p) => p.id === "P5");
  const p6Portainer = portainersList.find((p) => p.id === "P6");
  const p4Portainer = portainersList.find((p) => p.id === "P4");
  const isP5Active = (isPresentationMode || scenario.showPortainers !== false) && (p5Portainer ? (isPresentationMode || p5Portainer.enabled) : true);
  const isP6Active = (isPresentationMode || scenario.showPortainers !== false) && (p6Portainer ? (isPresentationMode || p6Portainer.enabled) : true);
  const isP4Active = (isPresentationMode || scenario.showPortainers !== false) && (p4Portainer ? (isPresentationMode || p4Portainer.enabled) : true);

  const b297 = scenario.bollards.find((b) => b.id === "297")?.position ?? 276.9;
  const b296 = scenario.bollards.find((b) => b.id === "296")?.position ?? 306.9;
  const b294 = scenario.bollards.find((b) => b.id === "294")?.position ?? 362.9;

  const b279 = scenario.bollards.find((b) => b.id === "279")?.position ?? 771.4;
  const b278 = scenario.bollards.find((b) => b.id === "278")?.position ?? 796.9;
  const b277 = scenario.bollards.find((b) => b.id === "277")?.position ?? 823.4;

  // Cerca divisória entre empresas (entre cabeço 278 e 277)
  const fenceM = (b278 + b277) / 2; // ~810.15m
  const fenceX = trackStart + fenceM * scale;

  const manifold297_296_M = (b297 + b296) / 2; // ~291.9m
  const manifold297_296_X = trackStart + manifold297_296_M * scale;
  const manifold294_X = trackStart + b294 * scale;
  for (const issue of calculateIssues(scenario)) {
    issueByVessel.set(issue.vesselId, [...(issueByVessel.get(issue.vesselId) ?? []), issue.message]);
  }

  const mooredLinesByBollardId = new Map<string, { vesselName: string; lineType: string }[]>();
  scenario.vessels.forEach((vessel) => {
    vessel.mooringLines.forEach((line) => {
      if (line.bollardId) {
        const list = mooredLinesByBollardId.get(line.bollardId) ?? [];
        list.push({ vesselName: vessel.name, lineType: MOORING_LINE_LABELS[line.type] || line.type });
        mooredLinesByBollardId.set(line.bollardId, list);
      }
    });
  });

  function pointAt(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function positionAt(clientX: number) {
    return (pointAt(clientX, 0).x - PAD) / scale;
  }

  function nearestBollard(x: number) {
    let nearest = bollardDisplays[0] ?? null;
    for (const bollard of bollardDisplays.slice(1)) {
      if (!nearest || Math.abs(trackStart + bollard.position * scale - x) < Math.abs(trackStart + nearest.position * scale - x)) nearest = bollard;
    }
    return nearest;
  }

  function onPointerDown(event: React.PointerEvent<SVGGElement>, id: string, position: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    onSelectVessel(id);
    if (!isPresentationMode) {
      dragRef.current = { kind: "vessel", id, grabOffset: positionAt(event.clientX) - position };
      svgRef.current?.setPointerCapture(event.pointerId);
    }
  }

  function onPortainerPointerDown(event: React.PointerEvent<SVGGElement>, id: string, position: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { kind: "portainer", id, grabOffset: positionAt(event.clientX) - position };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function startMooringDrag(event: React.PointerEvent<SVGCircleElement>, vesselId: string, lineId: string, x: number, y: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { kind: "mooring", vesselId, lineId };
    setLineDragPoint({ x, y });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function moveMooringToAdjacentBollard(event: React.KeyboardEvent<SVGCircleElement>, currentBollardId: string | null, vesselId: string, lineId: string) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    const currentIndex = bollardDisplays.findIndex((item) => item.id === currentBollardId);
    const nextIndex = currentIndex < 0
      ? (event.key === "ArrowRight" ? 0 : bollardDisplays.length - 1)
      : Math.max(0, Math.min(bollardDisplays.length - 1, currentIndex + (event.key === "ArrowRight" ? 1 : -1)));
    const next = bollardDisplays[nextIndex];
    if (next) onAssignMooringLine(vesselId, lineId, next.id);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "vessel") {
      const next = positionAt(event.clientX) - drag.grabOffset;
      onMoveVessel(drag.id, Math.round(next * 10) / 10);
    } else if (drag.kind === "portainer") {
      const rawNext = positionAt(event.clientX) - drag.grabOffset;
      const portainersList = scenario.portainers ?? DEFAULT_PORTAINERS;
      const clamped = clampPortainerPosition(drag.id, rawNext, scenario.bollards, total, portainersList);
      onMovePortainer?.(drag.id, clamped.position);
      if (clamped.hitLimit && clamped.message) {
        onPortainerLimitHit?.(clamped.message);
      }
    } else {
      setLineDragPoint(pointAt(event.clientX, event.clientY));
    }
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag?.kind === "mooring") {
      const point = pointAt(event.clientX, event.clientY);
      const target = nearestBollard(point.x);
      if (target && point.y >= QUAY_Y - 38 && point.y <= QUAY_Y + 38) {
        onAssignMooringLine(drag.vesselId, drag.lineId, target.id);
        setActiveBollardId(target.id);
      }
      setLineDragPoint(null);
    }
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  }

  function onPointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    setLineDragPoint(null);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  }

  const dragTarget = lineDragPoint ? nearestBollard(lineDragPoint.x) : null;

  const ticks: number[] = [];
  for (let meter = 0; meter <= total; meter += tickEvery) ticks.push(meter);
  if (ticks[ticks.length - 1] !== total && total > 0) ticks.push(total);

  return (
    <div className="blueprint-scroll" aria-label="Blueprint do cais; arraste um navio para ajustar sua posição ou a ponta de um cabo para escolher o cabeço">
      <div style={{ position: "relative", width: width * zoom, height: HEIGHT * zoom, display: "inline-block" }}>
        <svg
        ref={svgRef}
        className="blueprint-svg"
        width={width * zoom}
        height={HEIGHT * zoom}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="group"
        aria-label={`Vista superior de ${scenario.vessels.length} navios e ${scenario.bollards.length} cabeços numerados de 399 a 367 em um cais de ${total} metros`}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <defs>
          <pattern id="water-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#dcebf0" strokeWidth="0.65" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={width} height={HEIGHT} fill="#f8fbfc" />
        {/* Faixa sombreada da empresa vizinha além da cerca divisória */}
        <rect
          x={fenceX}
          y="0"
          width={Math.max(0, width - fenceX)}
          height={HEIGHT}
          fill="#64748b"
          opacity="0.14"
          pointerEvents="none"
        />
        <rect x={trackStart} y="32" width={total * scale} height={QUAY_Y - 32} fill="#eef7f8" />
        <rect x={trackStart} y="32" width={total * scale} height={QUAY_Y - 32} fill="url(#water-grid)" />

        {scenario.clearance > 0 && (
          <>
            <rect x={trackStart} y="32" width={scenario.clearance * scale} height={QUAY_Y - 32} fill="#f9ebd8" opacity="0.65" />
            <rect x={trackEnd - scenario.clearance * scale} y="32" width={scenario.clearance * scale} height={QUAY_Y - 32} fill="#f9ebd8" opacity="0.65" />
          </>
        )}

        {ticks.map((meter) => {
          const x = trackStart + meter * scale;
          return (
            <g key={`tick-${meter}`}>
              <line x1={x} y1="33" x2={x} y2="221" stroke="#d1dde2" strokeDasharray="3 5" />
              {!isPresentationMode && (
                <>
                  <line x1={x} y1="27" x2={x} y2="35" stroke="#70858f" strokeWidth="1.5" />
                  <text x={x} y="21" textAnchor="middle" className="blueprint-ruler-label">{meter} m</text>
                </>
              )}
            </g>
          );
        })}

        {/* Cabos amarelos; conectados aos pontos estruturais do navio e cabeços */}
        {sortedVessels.flatMap((vessel) => {
          return vessel.mooringLines.map((line) => {
            const bollard = line.bollardId ? bollardById.get(line.bollardId) : undefined;
            const { x: shipX, y: shipY } = getMooringShipAnchor(line.type, vessel, scale, trackStart);
            const bollardDisplay = bollard?.id ? bollardDisplayById.get(bollard.id) : undefined;
            const isDragging = dragRef.current?.kind === "mooring" && dragRef.current.vesselId === vessel.id && dragRef.current.lineId === line.id;
            const bollardX = bollardDisplay ? trackStart + bollardDisplay.position * scale : shipX;
            const endX = isDragging && lineDragPoint ? lineDragPoint.x : bollardX;
            const endY = isDragging && lineDragPoint ? lineDragPoint.y : bollardDisplay ? CABLE_END_Y : shipY;
            const isSpring = line.type.startsWith("spring");
            const stationDescription = bollardDisplay?.estimated ? "estação ilustrativa, não levantada" : bollardDisplay ? `estação ${bollardDisplay.position} m` : "cabeço ainda não escolhido";
            return (
              <g key={`line-${vessel.id}-${line.id}`}>
                <title>{vessel.name} · {MOORING_LINE_LABELS[line.type]} · {bollard ? `Cabeço ${bollard.id} · ${stationDescription}` : stationDescription}</title>
                <line x1={shipX} y1={shipY} x2={endX} y2={endY} stroke="#51491d" strokeWidth="4.2" opacity="0.42" pointerEvents="none" />
                <line x1={shipX} y1={shipY} x2={endX} y2={endY} stroke="#f1cc19" strokeWidth="2.8" strokeDasharray={isSpring ? "5 3" : undefined} opacity="0.98" pointerEvents="none" />
              </g>
            );
          });
        })}

        {sortedVessels.map((vessel, index) => {
          const x = trackStart + vessel.position * scale;
          const vesselWidth = vessel.loa * scale;
          const vesselHeight = Math.max(20, vessel.beam * scale);
          const y = VESSEL_BERTH_BOTTOM_Y - vesselHeight;
          const bowInset = Math.min(23 * scale, vesselWidth * 0.16);
          const color = VESSEL_COLORS[vessel.color];
          const messages = issueByVessel.get(vessel.id) ?? [];
          const isIssue = messages.length > 0;
          const isSelected = selectedVesselId === vessel.id;
          const vesselType = normalizeVesselType(vessel.vesselType, vessel.name);

          return (
            <g
              key={vessel.id}
              className={`ship-drag-group ${isSelected ? "is-selected" : ""} ${isIssue ? "has-issue" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${vessel.name}, ${VESSEL_TYPE_LABELS[vesselType]}, ${vessel.loa} metros.${!isPresentationMode ? " Arraste para reposicionar." : ""}`}
              onPointerDown={(event) => onPointerDown(event, vessel.id, vessel.position)}
              onKeyDown={(event) => {
                if (!isPresentationMode) {
                  if (event.key === "ArrowLeft") { event.preventDefault(); onMoveVessel(vessel.id, vessel.position - 5); }
                  if (event.key === "ArrowRight") { event.preventDefault(); onMoveVessel(vessel.id, vessel.position + 5); }
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectVessel(vessel.id);
                }
              }}
              onClick={() => onSelectVessel(vessel.id)}
              style={{
                cursor: isPresentationMode
                  ? "default"
                  : dragRef.current?.kind === "vessel" && dragRef.current.id === vessel.id
                  ? "grabbing"
                  : "grab",
              }}
            >
              <title>
                {vessel.name} · {VESSEL_TYPE_LABELS[vesselType]} · LOA {vessel.loa} m · posição {vessel.position.toFixed(1)} m
                {vesselType === "container" ? ` · ${normalizeTierCount(vessel.tierCount ?? vessel.tiers) ?? defaultTierCountForBeam(vessel.beam)} tiers no convés` : ""}
                {messages.length ? ` · ${messages.join("; ")}` : ""}
              </title>
              {isSelected && !isPresentationMode && <rect x={x - 5} y={y - 25} width={Math.max(18, vesselWidth + 10)} height={vesselHeight + 37} rx="9" fill="none" stroke="#16869a" strokeWidth="1.5" strokeDasharray="4 4" />}
              {!isPresentationMode ? (
                <text x={x + vesselWidth / 2} y={y - 15} textAnchor="middle" className={`ship-name ${isIssue ? "ship-name-issue" : ""}`}>
                  {vessel.name.length > 26 ? `${vessel.name.slice(0, 24)}…` : vessel.name}
                </text>
              ) : (
                <text
                  x={x + vesselWidth / 2}
                  y={y - 16}
                  textAnchor="middle"
                  style={{
                    fill: "#0f172a",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {vessel.name}
                </text>
              )}
              <g transform={vessel.berthingSide === "bombordo" ? `translate(${2 * x + vesselWidth}, 0) scale(-1, 1)` : undefined}>
                {/* Casco exterior hidrodinâmico */}
                <path d={`M ${x + 6} ${y} Q ${x} ${y + vesselHeight / 2} ${x + 6} ${y + vesselHeight} L ${x + vesselWidth - bowInset} ${y + vesselHeight} L ${x + vesselWidth} ${y + vesselHeight / 2} L ${x + vesselWidth - bowInset} ${y} Z`} fill="#f7fafb" stroke={isIssue ? "#bd4540" : color.stroke} strokeWidth={isIssue ? 3 : 2} strokeDasharray={isIssue ? "7 4" : undefined} />
                
                {/* Visualização detalhada do convés conforme tipo de navio */}
                {vesselType === "research-survey"
                  ? renderResearchSurveyDeck(x, y, vesselWidth, vesselHeight, bowInset, color)
                  : (vesselType === "offshore" || vesselType === "diving-support")
                  ? renderOffshoreDeck(x, y, vesselWidth, vesselHeight, bowInset, color, vessel.name)
                  : vesselType === "general-cargo"
                  ? renderGeneralCargoDeck(x, y, vesselWidth, vesselHeight, bowInset, color)
                  : (vesselType === "tanker" || vesselType === "chemical-tanker" || vesselType === "product-tanker")
                  ? renderTankerDeck(x, y, vesselWidth, vesselHeight, bowInset, color)
                  : renderContainerDeck(x, y, vesselWidth, vesselHeight, bowInset, color, vessel, vessel.berthingSide === "bombordo")
                }

                {/* Faixa de costado junto ao cais */}
                <line x1={x + 7} y1={y + vesselHeight - 1} x2={x + vesselWidth - bowInset} y2={y + vesselHeight - 1} stroke={vessel.berthingSide === "bombordo" ? "#7566a8" : "#18849a"} strokeWidth="2" />
              </g>
              <line x1={x + vesselWidth / 2} y1={y + vesselHeight + 1} x2={x + vesselWidth / 2} y2={QUAY_Y - 4} stroke={isIssue ? "#bd4540" : color.stroke} strokeDasharray="3 4" opacity="0.58" />
              <circle cx={x + vesselWidth / 2} cy={QUAY_Y - 3} r="3.3" fill={isIssue ? "#bd4540" : color.fill} />
            </g>
          );
        })}

        {/* Marcações roxas na ponta da proa e na popa indicando o alinhamento no cais */}
        {sortedVessels.map((vessel) => {
          const vesselHeight = Math.max(20, vessel.beam * scale);
          const y = VESSEL_BERTH_BOTTOM_Y - vesselHeight;

          const bowStation = vessel.berthingSide === "bombordo" ? vessel.position : vessel.position + vessel.loa;
          const bowX = trackStart + bowStation * scale;
          const bowY = y + vesselHeight / 2;

          const sternStation = vessel.berthingSide === "bombordo" ? vessel.position + vessel.loa : vessel.position;
          const sternX = trackStart + sternStation * scale;
          const sternY = y + vesselHeight / 2;

          return (
            <g key={`vessel-markers-${vessel.id}`} pointerEvents="none">
              {/* Marcação da Popa */}
              <g key={`stern-marker-${vessel.id}`}>
                <title>{vessel.name} · Espelho da popa na estação {sternStation.toFixed(1)} m no cais</title>
                <line
                  x1={sternX}
                  y1={sternY + 2}
                  x2={sternX}
                  y2={QUAY_Y - 3}
                  stroke="#7566a8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity="0.88"
                />
                <path
                  d={`M ${sternX - 4.5} ${sternY + 10} L ${sternX} ${sternY + 2} L ${sternX + 4.5} ${sternY + 10} Z`}
                  fill="#7566a8"
                  stroke="#fff"
                  strokeWidth="1"
                />
                <circle
                  cx={sternX}
                  cy={QUAY_Y - 3}
                  r="3.3"
                  fill="#7566a8"
                  stroke="#fff"
                  strokeWidth="1"
                />
                <text
                  x={sternX}
                  y={QUAY_Y - 7}
                  textAnchor="middle"
                  style={{
                    fill: "#5a4b8a",
                    fontSize: "5.8px",
                    fontWeight: 800,
                    paintOrder: "stroke",
                    stroke: "#ffffff",
                    strokeWidth: "2px",
                    strokeLinejoin: "round",
                  }}
                >
                  POPA {sternStation.toFixed(0)}m
                </text>
              </g>

              {/* Marcação da Proa */}
              <g key={`bow-marker-${vessel.id}`}>
                <title>{vessel.name} · Bico da proa na estação {bowStation.toFixed(1)} m no cais</title>
                <line
                  x1={bowX}
                  y1={bowY + 2}
                  x2={bowX}
                  y2={QUAY_Y - 3}
                  stroke="#7566a8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity="0.88"
                />
                <path
                  d={`M ${bowX - 4.5} ${bowY + 10} L ${bowX} ${bowY + 2} L ${bowX + 4.5} ${bowY + 10} Z`}
                  fill="#7566a8"
                  stroke="#fff"
                  strokeWidth="1"
                />
                <circle
                  cx={bowX}
                  cy={QUAY_Y - 3}
                  r="3.3"
                  fill="#7566a8"
                  stroke="#fff"
                  strokeWidth="1"
                />
                <text
                  x={bowX}
                  y={QUAY_Y - 7}
                  textAnchor="middle"
                  style={{
                    fill: "#5a4b8a",
                    fontSize: "5.8px",
                    fontWeight: 800,
                    paintOrder: "stroke",
                    stroke: "#ffffff",
                    strokeWidth: "2px",
                    strokeLinejoin: "round",
                  }}
                >
                  PROA {bowStation.toFixed(0)}m
                </text>
              </g>
            </g>
          );
        })}

        {sortedVessels.slice(1).map((vessel, index) => {
          const previous = sortedVessels[index];
          const gap = vessel.position - (previous.position + previous.loa);
          const x1 = trackStart + (previous.position + previous.loa) * scale;
          const x2 = trackStart + vessel.position * scale;
          const mid = (x1 + x2) / 2;
          const warning = gap < scenario.clearance;
          return (
            <g key={`gap-${previous.id}-${vessel.id}`} className={warning ? "gap-measure gap-measure-warning" : "gap-measure"}>
              <line x1={x1} y1="145" x2={x2} y2="145" stroke={warning ? "#bd4540" : "#55727f"} strokeWidth="1.3" />
              {gap >= 0 && <path d={`M ${x1 + 5} 142 L ${x1} 145 L ${x1 + 5} 148 M ${x2 - 5} 142 L ${x2} 145 L ${x2 - 5} 148`} fill="none" stroke={warning ? "#bd4540" : "#55727f"} strokeWidth="1.1" />}
              <text x={mid} y="139" textAnchor="middle" className="gap-label">{gap.toFixed(0)} m</text>
            </g>
          );
        })}

        <rect x={trackStart} y={QUAY_Y} width={total * scale} height="60" fill="#8d9da3" />
        <rect x={trackStart} y={QUAY_Y} width={total * scale} height="4" fill="#637b84" />
        {/* Área sombreada do cais além da cerca divisória */}
        <rect
          x={fenceX}
          y={QUAY_Y}
          width={Math.max(0, trackEnd - fenceX)}
          height="60"
          fill="#475569"
          opacity="0.18"
          pointerEvents="none"
        />

        {/* Trilhos dos Portêineres STS (Trilho Marítimo e Terrestre) */}
        <g className="crane-rails" opacity={!isPresentationMode && scenario.showPortainers === false ? 0.35 : 1}>
          <line x1={trackStart} y1="242" x2={trackEnd} y2="242" stroke="#475569" strokeWidth="2.4" />
          <line x1={trackStart} y1="242" x2={trackEnd} y2="242" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="16 4" />
          <line x1={trackStart} y1="272" x2={trackEnd} y2="272" stroke="#475569" strokeWidth="2.4" />
          <line x1={trackStart} y1="272" x2={trackEnd} y2="272" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="16 4" />
        </g>

        {/* Cerca divisória entre empresas (entre cabeço 278 e 277) */}
        <g className="fence-boundary-layer" pointerEvents="none">
          <title>{`Divisão de concessão entre empresas · Cerca entre Cabeços 278 e 277 (estação ${fenceM.toFixed(1).replace(".", ",")} m)`}</title>
          {/* Linha vertical tracejada da cerca */}
          <line
            x1={fenceX}
            y1="175"
            x2={fenceX}
            y2="278"
            stroke="#991b1b"
            strokeWidth="1.8"
            strokeDasharray="5 3"
          />
          {/* Ramificação tracejada em L conectando ao badge da cerca */}
          <path
            d={`M ${fenceX} 278 L ${fenceX + 11} 278 L ${fenceX + 11} 283`}
            fill="none"
            stroke="#991b1b"
            strokeWidth="1.8"
            strokeDasharray="4 2.5"
          />
          {/* Badge vermelho "Cerca" */}
          <rect
            x={fenceX + 1}
            y="283"
            width="36"
            height="13"
            rx="2"
            fill="#991b1b"
            stroke="#7f1d1d"
            strokeWidth="0.8"
          />
          <text
            x={fenceX + 19}
            y="291.8"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fill: "#ffffff",
              fontSize: "6.2px",
              fontWeight: 900,
              letterSpacing: "0.2px",
            }}
          >
            Cerca
          </text>
        </g>

        {/* Marcadores visuais dos Limites Operacionais (aparecem com opacidade leve somente no simulador quando ativo) */}
        {!isPresentationMode && scenario.showPortainers !== false && (
          <g className="portainer-limit-markers" pointerEvents="none">
            {/* Limite P5 (Meio entre cabeços 297 e 296) - visível somente se P5 estiver ativo */}
            {isP5Active && p5LimitX !== null && p5LimitM !== undefined && (() => {
              const isHighlighted = hoveredPortainerId === "P5" || (dragRef.current?.kind === "portainer" && dragRef.current.id === "P5");
              return (
                <g opacity={isHighlighted ? 0.95 : 0.42} style={{ transition: "opacity 0.2s ease" }}>
                  <line
                    x1={p5LimitX}
                    y1={224}
                    x2={p5LimitX}
                    y2={276}
                    stroke="#9333ea"
                    strokeWidth={isHighlighted ? "1.8" : "1.2"}
                    strokeDasharray="3 3"
                  />
                  <polygon
                    points={`${p5LimitX},224 ${p5LimitX + 4},219 ${p5LimitX - 4},219`}
                    fill="#9333ea"
                  />
                  <rect
                    x={p5LimitX - 21}
                    y={274}
                    width="42"
                    height="11"
                    rx="2.5"
                    fill="#9333ea"
                    stroke="#581c87"
                    strokeWidth="0.6"
                  />
                  <text
                    x={p5LimitX}
                    y={282}
                    textAnchor="middle"
                    style={{ fill: "#ffffff", fontSize: "5.2px", fontWeight: 800, letterSpacing: "0.2px" }}
                  >
                    ◀ LIM P5 (297–296)
                  </text>
                </g>
              );
            })()}

            {/* Limite P6 (Meio entre cabeços 291 e 290) - visível somente se P6 estiver ativo */}
            {isP6Active && p6LimitX !== null && p6LimitM !== undefined && (() => {
              const isHighlighted = hoveredPortainerId === "P6" || (dragRef.current?.kind === "portainer" && dragRef.current.id === "P6");
              return (
                <g opacity={isHighlighted ? 0.95 : 0.42} style={{ transition: "opacity 0.2s ease" }}>
                  <line
                    x1={p6LimitX}
                    y1={224}
                    x2={p6LimitX}
                    y2={276}
                    stroke="#2563eb"
                    strokeWidth={isHighlighted ? "1.8" : "1.2"}
                    strokeDasharray="3 3"
                  />
                  <polygon
                    points={`${p6LimitX},224 ${p6LimitX + 4},219 ${p6LimitX - 4},219`}
                    fill="#2563eb"
                  />
                  <rect
                    x={p6LimitX - 21}
                    y={274}
                    width="42"
                    height="11"
                    rx="2.5"
                    fill="#2563eb"
                    stroke="#1e3a8a"
                    strokeWidth="0.6"
                  />
                  <text
                    x={p6LimitX}
                    y={282}
                    textAnchor="middle"
                    style={{ fill: "#ffffff", fontSize: "5.2px", fontWeight: 800, letterSpacing: "0.2px" }}
                  >
                    LIM P6 (291–290) ▶
                  </text>
                </g>
              );
            })()}

            {/* Limite P4 (Cabeço 279) - visível se P4 estiver ativo */}
            {isP4Active && p4LimitX !== null && p4LimitM !== undefined && (() => {
              const isHighlighted = hoveredPortainerId === "P4" || (dragRef.current?.kind === "portainer" && dragRef.current.id === "P4");
              return (
                <g opacity={isHighlighted ? 1 : 0.88} style={{ transition: "opacity 0.2s ease" }}>
                  <title>{`Limite Operacional Portêiner P04 / P4 · Cabeço 279 (estação ${p4LimitM.toFixed(1).replace(".", ",")} m)`}</title>
                  {/* Linha vertical descendo do Cabeço 279 até o marcador */}
                  <line
                    x1={p4LimitX}
                    y1={214}
                    x2={p4LimitX}
                    y2={308}
                    stroke="#78350f"
                    strokeWidth={isHighlighted ? "1.8" : "1.4"}
                    strokeDasharray="4 3"
                  />
                  {/* Seta apontando para a esquerda (P04) com base alinhada ao Cabeço 279 */}
                  <path
                    d={`M ${p4LimitX} 295 L ${p4LimitX - 21} 295 L ${p4LimitX - 28} 301.5 L ${p4LimitX - 21} 308 L ${p4LimitX} 308 Z`}
                    fill="#78350f"
                    stroke="#451a03"
                    strokeWidth="0.8"
                  />
                  <text
                    x={p4LimitX - 11}
                    y={303.6}
                    textAnchor="middle"
                    style={{
                      fill: "#ffffff",
                      fontSize: "6px",
                      fontWeight: 900,
                      letterSpacing: "0.3px",
                    }}
                  >
                    P04
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* Estruturas de Manifolds (centralizadores de tubulações e válvulas para granéis químicos / líquidos) */}
        <g className="shore-manifolds-layer">
          {/* Manifold de cais entre cabeços 297 e 296 */}
          <g
            className="manifold-structure"
            opacity="0.48"
            style={{ transition: "opacity 0.2s ease" }}
          >
            <title>Manifold de cais (Cabeço 297–296 · est. {manifold297_296_M.toFixed(1).replace(".", ",")}m) · Centralizador de tubulações e válvulas para navios químicos/petroleiros</title>
            <rect x={manifold297_296_X - 6} y="230" width="12" height="6.5" rx="1.2" fill="#f8fafc" stroke="#475569" strokeWidth="0.8" />
            <line x1={manifold297_296_X - 8} y1="233.2" x2={manifold297_296_X + 8} y2="233.2" stroke="#b91c1c" strokeWidth="1.8" />
            <rect x={manifold297_296_X - 5} y="228.8" width="2.2" height="3" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
            <rect x={manifold297_296_X - 1.1} y="228.8" width="2.2" height="3" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
            <rect x={manifold297_296_X + 2.8} y="228.8" width="2.2" height="3" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
            <circle cx={manifold297_296_X} cy="233.2" r="1.6" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
            <line x1={manifold297_296_X - 1.2} y1="233.2" x2={manifold297_296_X + 1.2} y2="233.2" stroke="#78350f" strokeWidth="0.4" />
            <line x1={manifold297_296_X} y1="232" x2={manifold297_296_X} y2="234.4" stroke="#78350f" strokeWidth="0.4" />
            <text
              x={manifold297_296_X}
              y="239.5"
              textAnchor="middle"
              style={{
                fill: "#334155",
                fontSize: "4.4px",
                fontWeight: 800,
                paintOrder: "stroke",
                stroke: "#ffffff",
                strokeWidth: "1.6px",
                strokeLinejoin: "round",
              }}
            >
              manifold
            </text>
          </g>

          {/* Manifold de cais no cabeço 294 */}
          <g
            className="manifold-structure"
            opacity="0.48"
            style={{ transition: "opacity 0.2s ease" }}
          >
            <title>Manifold de cais (Cabeço 294 · est. {b294.toFixed(1).replace(".", ",")}m) · Centralizador de tubulações e válvulas para navios químicos/petroleiros</title>
            <rect x={manifold294_X - 6} y="230" width="12" height="6.5" rx="1.2" fill="#f8fafc" stroke="#475569" strokeWidth="0.8" />
            <line x1={manifold294_X - 8} y1="233.2" x2={manifold294_X + 8} y2="233.2" stroke="#b91c1c" strokeWidth="1.8" />
            <rect x={manifold294_X - 5} y="228.8" width="2.2" height="3" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
            <rect x={manifold294_X - 1.1} y="228.8" width="2.2" height="3" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
            <rect x={manifold294_X + 2.8} y="228.8" width="2.2" height="3" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.5" />
            <circle cx={manifold294_X} cy="233.2" r="1.6" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
            <line x1={manifold294_X - 1.2} y1="233.2" x2={manifold294_X + 1.2} y2="233.2" stroke="#78350f" strokeWidth="0.4" />
            <line x1={manifold294_X} y1="232" x2={manifold294_X} y2="234.4" stroke="#78350f" strokeWidth="0.4" />
            <text
              x={manifold294_X}
              y="239.5"
              textAnchor="middle"
              style={{
                fill: "#334155",
                fontSize: "4.4px",
                fontWeight: 800,
                paintOrder: "stroke",
                stroke: "#ffffff",
                strokeWidth: "1.6px",
                strokeLinejoin: "round",
              }}
            >
              manifold
            </text>
          </g>

          {/* Manifold Lado Terra (na passagem dos portêineres, direção 297–296) conforme modelo */}
          <g
            className="manifold-land-structure"
            opacity="0.52"
            style={{ transition: "opacity 0.2s ease" }}
          >
            <title>Manifold lado terra (Direção Cabeços 297–296 · est. {manifold297_296_M.toFixed(1).replace(".", ",")}m) · Centralizador de tubulações e válvulas na passagem dos portêineres</title>
            <rect x={manifold297_296_X - 8.5} y="253" width="17" height="10" rx="1.5" fill="#f8fafc" stroke="#64748b" strokeWidth="0.8" />
            <line x1={manifold297_296_X - 11} y1="258" x2={manifold297_296_X + 11} y2="258" stroke="#dc2626" strokeWidth="2" />
            <line x1={manifold297_296_X} y1="252" x2={manifold297_296_X} y2="264" stroke="#0284c7" strokeWidth="1.4" />
            <rect x={manifold297_296_X - 11.5} y="256.5" width="2" height="3" fill="#450a0a" stroke="#000" strokeWidth="0.3" />
            <rect x={manifold297_296_X + 9.5} y="256.5" width="2" height="3" fill="#450a0a" stroke="#000" strokeWidth="0.3" />
            <circle cx={manifold297_296_X} cy="258" r="3.4" fill="#ffffff" stroke="#1e293b" strokeWidth="0.9" />
            <line x1={manifold297_296_X - 2.6} y1="258" x2={manifold297_296_X + 2.6} y2="258" stroke="#1e293b" strokeWidth="0.7" />
            <line x1={manifold297_296_X} y1="255.4" x2={manifold297_296_X} y2="260.6" stroke="#1e293b" strokeWidth="0.7" />
            <circle cx={manifold297_296_X} cy="258" r="1.2" fill="#f59e0b" />
            <text
              x={manifold297_296_X + 11}
              y="259.5"
              style={{
                fill: "#334155",
                fontSize: "5.2px",
                fontStyle: "italic",
                fontWeight: 700,
                letterSpacing: "0.15px",
                paintOrder: "stroke",
                stroke: "#ffffff",
                strokeWidth: "1.6px",
                strokeLinejoin: "round",
              }}
            >
              manifold lado terra
            </text>
          </g>
        </g>

        {/* Cabeços numerados com cores oficiais e numeração na vertical */}
        {bollardDisplays.map((display) => {
          const x = trackStart + display.position * scale;
          const isDropTarget = dragTarget?.id === display.id;
          const isHovered = hoveredBollardId === display.id;
          const bollard = bollardById.get(display.id);
          const bType: BollardType = bollard?.type || display.type || "duplo";
          const bConfig = BOLLARD_TYPES[bType] || BOLLARD_TYPES["duplo"];
          const positionText = display.estimated ? "posição esquemática, não levantada" : `estação ${display.position} m desde o início do cais`;
          return (
            <g
              key={`bollard-${display.id}`}
              className={`bollard-marker ${isHovered ? "bollard-marker-hover" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Cabeço ${display.id}, ${bConfig.label}, ${positionText}`}
              onPointerEnter={() => setHoveredBollardId(display.id)}
              onPointerLeave={() => setHoveredBollardId((curr) => (curr === display.id ? null : curr))}
              onClick={() => {
                setHoveredBollardId(null);
                setEditingBollardId(display.id);
                setEditId(display.id);
                setEditType(bType);
                setEditPosition(display.position !== null ? String(display.position) : "");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setHoveredBollardId(null);
                  setEditingBollardId(display.id);
                  setEditId(display.id);
                  setEditType(bType);
                  setEditPosition(display.position !== null ? String(display.position) : "");
                }
              }}
            >
              <title>Cabeço {display.id} ({bConfig.label}) · {positionText}</title>
              {/* Hitbox ampliada para o cursor e hover com mouse */}
              <rect
                x={x - 9}
                y="210"
                width="18"
                height="28"
                className="bollard-hitbox"
                fill="transparent"
                style={{ cursor: "pointer" }}
              />
              {/* Haste vertical do cabeço com ponta superior e base sobre o cais */}
              <line
                x1={x}
                y1="210"
                x2={x}
                y2="234"
                stroke={isHovered ? "#f1cc19" : "#111a1d"}
                strokeWidth={isHovered ? "2.6" : "2.2"}
              />
              {/* Cápsula arredondada do cabeço com a cor oficial do seu tipo */}
              <rect
                x={x - 4.3}
                y={215}
                width="8.6"
                height="19"
                rx="2.6"
                className="bollard-capsule"
                fill={isHovered ? "#f1cc19" : bConfig.color}
                stroke={isHovered ? "#594d12" : bConfig.border}
                strokeWidth={isHovered ? "1.4" : "0.9"}
              />
              {/* Numeração na vertical dentro do cabeço */}
              <text
                x={x}
                y={224.5}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(-90 ${x} 224.5)`}
                className={`bollard-number ${display.estimated ? "bollard-number-estimated" : ""}`}
                style={{
                  fill: isHovered ? "#111a1d" : "#ffffff",
                  fontSize: "6.2px",
                  fontWeight: 900,
                  letterSpacing: "0.2px",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {display.id}
              </text>
            </g>
          );
        })}

        {/* Cotas em metros entre cabeços adjacentes (ex: 19,8, 10,7, 25,0, 30,0) como na planta portuária */}
        {!isPresentationMode && bollardDisplays.slice(0, -1).map((display, index) => {
          const next = bollardDisplays[index + 1];
          if (!next) return null;
          const x1 = trackStart + display.position * scale;
          const x2 = trackStart + next.position * scale;
          const dist = Math.abs(next.position - display.position);
          const midX = (x1 + x2) / 2;
          const pixelGap = Math.abs(x2 - x1);
          if (dist < 0.1 || pixelGap < 5) return null;
          return (
            <g key={`gap-bollard-${display.id}-${next.id}`} pointerEvents="none">
              <text
                x={midX}
                y="224.5"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fill: "#1f2937",
                  fontSize: pixelGap < 13 ? "4.8px" : "5.4px",
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  paintOrder: "stroke",
                  stroke: "#ffffff",
                  strokeWidth: pixelGap < 13 ? "1.8px" : "2.2px",
                  strokeLinejoin: "round",
                }}
              >
                {dist.toFixed(1).replace(".", ",")}
              </text>
            </g>
          );
        })}

        {/* Alças de cabo em camada superior para continuarem arrastáveis sobre os símbolos pretos. */}
        {sortedVessels.flatMap((vessel) => vessel.mooringLines.map((line) => {
          const { x: shipX, y: shipY } = getMooringShipAnchor(line.type, vessel, scale, trackStart);
          const display = line.bollardId ? bollardDisplayById.get(line.bollardId) : undefined;
          const isDragging = dragRef.current?.kind === "mooring" && dragRef.current.vesselId === vessel.id && dragRef.current.lineId === line.id;
          const x = isDragging && lineDragPoint ? lineDragPoint.x : display ? trackStart + display.position * scale : shipX;
          const y = isDragging && lineDragPoint ? lineDragPoint.y : display ? CABLE_END_Y : shipY;
          return (
            <g key={`line-handle-${vessel.id}-${line.id}`}>
              <circle cx={x} cy={y} r={isDragging ? 5.5 : 4.2} fill="#f1cc19" stroke="#51491d" strokeWidth="1.4" pointerEvents="none" />
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="transparent"
                pointerEvents="all"
                role="button"
                tabIndex={0}
                aria-label={`Arraste a ponta da ${MOORING_LINE_LABELS[line.type]} até um cabeço numerado`}
                style={{ cursor: "grab", touchAction: "none" }}
                onPointerDown={(event) => startMooringDrag(event, vessel.id, line.id, x, y)}
                onKeyDown={(event) => moveMooringToAdjacentBollard(event, line.bollardId, vessel.id, line.id)}
              />
              {isDragging && dragTarget && (
                <text x={x} y={QUAY_Y - 41} textAnchor="middle" className="bollard-drop-label">Soltar no {dragTarget.id}</text>
              )}
            </g>
          );
        }))}

        {/* Portêineres STS (P4, P5, P6, P7, P8, P9) */}
        {(isPresentationMode || scenario.showPortainers !== false) &&
          (scenario.portainers ?? DEFAULT_PORTAINERS)
            .filter((p) => isPresentationMode || p.enabled)
            .map((portainer) => {
              const isDragging = dragRef.current?.kind === "portainer" && dragRef.current.id === portainer.id;
              const isHovered = hoveredPortainerId === portainer.id;
              return renderPortainerSvg({
                portainer,
                scale,
                trackStart,
                isHovered,
                isDragging,
                isPresentationMode,
                onPointerDown: (event) => onPortainerPointerDown(event, portainer.id, portainer.position),
                onPointerEnter: () => setHoveredPortainerId(portainer.id),
                onPointerLeave: () => setHoveredPortainerId((curr) => (curr === portainer.id ? null : curr)),
              });
            })}

        {offsets.map((segment, index) => {
          const x = trackStart + segment.start * scale;
          const segmentWidth = segment.length * scale;
          const shade = ["#e6caa5", "#e9d3b5", "#b9cbd0", "#d4e3e3"][index % 4];
          return (
            <g key={segment.id}>
              <rect x={x} y="310" width={segmentWidth} height="43" fill={shade} stroke="#fff" strokeWidth="2" />
              <text
                x={x + segmentWidth / 2}
                y={isPresentationMode ? "336" : "328"}
                textAnchor="middle"
                className="segment-name"
              >
                {segment.name.length > 20 ? `${segment.name.slice(0, 18)}…` : segment.name}
              </text>
              {!isPresentationMode && (
                <text x={x + segmentWidth / 2} y="345" textAnchor="middle" className="segment-length">
                  {segment.length} m · {segment.start}–{segment.end} m
                </text>
              )}
            </g>
          );
        })}
        {!isPresentationMode && (
          <>
            <line x1={trackStart} y1="362" x2={trackEnd} y2="362" stroke="#94a7ad" strokeWidth="1" />
            <text x={trackStart} y="376" className="blueprint-footnote">INÍCIO DO CAIS · coordenadas longitudinais em metros</text>
            <text x={trackEnd} y="376" textAnchor="end" className="blueprint-footnote">{total} m · FIM DO CAIS</text>
          </>
        )}
      </svg>

      {/* Card flutuante com foto real e dados ao passar o mouse pelo cabeço */}
      {!editingBollardId && hoveredDisplay && (() => {
        const hoveredBollard = bollardById.get(hoveredDisplay.id);
        const bType: BollardType = hoveredBollard?.type || hoveredDisplay.type || "duplo";
        const bConfig = BOLLARD_TYPES[bType] || BOLLARD_TYPES["duplo"];
        const bImage = hoveredBollard?.image || hoveredDisplay.image || bConfig.image;
        const bIndex = bollardDisplays.findIndex((b) => b.id === hoveredDisplay.id);
        const nextDisplay = bIndex >= 0 && bIndex < bollardDisplays.length - 1 ? bollardDisplays[bIndex + 1] : null;
        const distToNext = nextDisplay ? Math.abs(nextDisplay.position - hoveredDisplay.position) : null;
        const moored = mooredLinesByBollardId.get(hoveredDisplay.id) ?? [];
        const bollardPixelX = (trackStart + hoveredDisplay.position * scale) * zoom;
        const cardWidth = 270;
        const clampedX = Math.max(cardWidth / 2 + 10, Math.min(width * zoom - cardWidth / 2 - 10, bollardPixelX));
        const arrowOffset = bollardPixelX - clampedX;

        return (
          <div
            className="pointer-events-none absolute z-30 transition-all duration-150 ease-out"
            style={{
              left: clampedX,
              top: (215 - 10) * zoom,
              transform: "translate(-50%, -100%)",
              width: cardWidth,
            }}
          >
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-[#cbd5e1] text-[#1e293b]">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#f1f5f9]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full border shadow-xs shrink-0"
                    style={{ background: bConfig.color, borderColor: bConfig.border }}
                  />
                  <span className="font-extrabold text-sm text-[#0f172a]">Cabeço {hoveredDisplay.id}</span>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-xs shrink-0"
                  style={{ background: bConfig.color }}
                >
                  {bConfig.label}
                </span>
              </div>

              {/* Foto real da infraestrutura portuária */}
              <div className="relative w-full h-36 bg-[#0f172a]/5 rounded-lg overflow-hidden border border-[#e2e8f0] mb-2 shadow-inner flex items-center justify-center">
                <img
                  src={getAssetUrl(bImage)}
                  alt={bConfig.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-medium">
                  Foto real
                </div>
              </div>

              {/* Métricas do alinhamento */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2 bg-[#f8fafc] p-2 rounded-md border border-[#edf2f7]">
                <div>
                  <span className="text-[#64748b] block text-[10px] font-medium">Estação no cais</span>
                  <span className="font-mono font-bold text-[#0f172a]">{hoveredDisplay.position.toFixed(1).replace(".", ",")} m</span>
                </div>
                {distToNext !== null ? (
                  <div>
                    <span className="text-[#64748b] block text-[10px] font-medium">Distância próx. ({nextDisplay?.id})</span>
                    <span className="font-mono font-bold text-[#0f172a]">{distToNext.toFixed(1).replace(".", ",")} m</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-[#64748b] block text-[10px] font-medium">Alinhamento</span>
                    <span className="font-bold text-[#0f172a] text-[11px]">Último cabeço</span>
                  </div>
                )}
              </div>

              {/* Estado de amarração */}
              {moored.length > 0 ? (
                <div className="text-[10px] text-[#0369a1] bg-[#e0f2fe] px-2 py-1 rounded font-semibold border border-[#bae6fd]">
                  ⚓ Amarrado: {moored.map((l) => `${l.vesselName} (${l.lineType})`).join(", ")}
                </div>
              ) : (
                <div className="text-[10px] text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded text-center">
                  Livre para amarração
                </div>
              )}

              <div className="text-[9.5px] text-[#94a3b8] text-center mt-1.5">
                Clique para editar número, tipo ou cota
              </div>

              {/* Triângulo / Seta apontando para o cabeço */}
              <div
                className="absolute -bottom-1.5 w-3 h-3 bg-white border-r border-b border-[#cbd5e1]"
                style={{
                  left: `calc(50% + ${Math.max(-cardWidth / 2 + 16, Math.min(cardWidth / 2 - 16, arrowOffset))}px)`,
                  transform: "translateX(-50%) rotate(45deg)",
                }}
              />
            </div>
          </div>
        );
      })()}
      </div>

      {editingBollardId && (
        <Dialog open={!!editingBollardId} onOpenChange={(open) => !open && setEditingBollardId(null)}>
          <DialogContent className="sm:max-w-md p-6 bg-white border border-[#d8e1e4] rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#102d40] flex items-center gap-2">
                <span>Editar Cabeço</span>
                <span
                  className="px-2 py-0.5 rounded text-white text-xs font-mono font-bold"
                  style={{ background: BOLLARD_TYPES[editType]?.color || "#3a7ebf" }}
                >
                  {editId || editingBollardId}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#71848c]">
                Configure o número, o tipo com sua cor oficial e a distância no cais.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editId.trim();
                if (trimmed && editingBollardId) {
                  const pos = editPosition === "" ? null : Math.max(0, Number(editPosition));
                  onUpdateBollard?.(editingBollardId, {
                    id: trimmed,
                    type: editType,
                    position: pos,
                  });
                  setEditingBollardId(null);
                }
              }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-semibold text-[#507079] block mb-1">
                  Número / Identificação
                </label>
                <input
                  autoFocus
                  className="w-full h-9 px-3 border border-[#cfdadd] rounded-md text-sm font-bold text-[#102d40] focus:outline-none focus:border-[#16869a]"
                  value={editId}
                  onChange={(e) => setEditId(e.target.value)}
                  maxLength={12}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#507079] block mb-1.5">
                  Tipo de Cabeço (Modelo e cor oficial)
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {(Object.keys(BOLLARD_TYPES) as BollardType[]).map((typeKey) => {
                    const cfg = BOLLARD_TYPES[typeKey];
                    const isSelected = editType === typeKey;
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setEditType(typeKey)}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md border text-left text-xs font-semibold transition-all ${
                          isSelected
                            ? "border-[#16869a] bg-[#f0f8f8] text-[#102d40] ring-1 ring-[#16869a]"
                            : "border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]"
                        }`}
                      >
                        <img
                          src={getAssetUrl(cfg.image)}
                          alt={cfg.label}
                          className="w-10 h-10 rounded object-cover border border-[#cbd5e1] shrink-0"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border shadow-xs"
                          style={{ background: cfg.color, borderColor: cfg.border }}
                        />
                        <span className="flex-1 font-medium">{cfg.label}</span>
                        {isSelected && <span className="text-[10px] text-[#16869a] font-bold">✓ Selecionado</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#507079] block mb-1">
                  Posição no cais (em metros desde o início)
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={total}
                    className="w-full h-9 px-3 border border-[#cfdadd] rounded-l-md text-sm font-semibold text-[#102d40] focus:outline-none focus:border-[#16869a]"
                    placeholder="Sem posição (esquemático)"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                  />
                  <span className="h-9 px-3 bg-[#f1f5f9] border border-l-0 border-[#cfdadd] rounded-r-md text-xs font-bold text-[#64748b] flex items-center">
                    m
                  </span>
                </div>
                <p className="text-[11px] text-[#85949a] mt-1">
                  Cais total: {total} m. O cabeço se posicionará na coordenada informada.
                </p>
              </div>

              {(() => {
                const currentIndex = editingBollardId ? scenario.bollards.findIndex((b) => b.id === editingBollardId) : -1;
                const prevBollard = currentIndex > 0 ? scenario.bollards[currentIndex - 1] : null;
                const nextBollard = currentIndex >= 0 && currentIndex < scenario.bollards.length - 1 ? scenario.bollards[currentIndex + 1] : null;
                const currentPos = editPosition === "" ? null : Number(editPosition);

                return (
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-2.5 text-xs text-[#475569] space-y-1.5">
                    <div className="font-semibold text-[#1e293b]">Espaçamento com os cabeços adjacentes:</div>
                    {prevBollard && prevBollard.position !== null && currentPos !== null && (
                      <div className="flex justify-between items-center">
                        <span>Do cabeço anterior (<strong>{prevBollard.id}</strong>):</span>
                        <span className="font-mono font-bold text-[#0f172a] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">
                          {Math.abs(currentPos - prevBollard.position).toFixed(1).replace(".", ",")} m
                        </span>
                      </div>
                    )}
                    {nextBollard && nextBollard.position !== null && currentPos !== null && (
                      <div className="flex justify-between items-center">
                        <span>Para o próximo cabeço (<strong>{nextBollard.id}</strong>):</span>
                        <span className="font-mono font-bold text-[#0f172a] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">
                          {Math.abs(nextBollard.position - currentPos).toFixed(1).replace(".", ",")} m
                        </span>
                      </div>
                    )}
                    {!prevBollard && <div className="text-[11px] text-[#64748b]">Extremidade esquerda do alinhamento.</div>}
                    {!nextBollard && <div className="text-[11px] text-[#64748b]">Extremidade direita do alinhamento.</div>}
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#edf1f2]">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setEditingBollardId(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={!editId.trim()}
                >
                  Salvar alterações
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
