import React from "react";
import {
  AlertTriangle,
  Ship,
  Ruler,
  ShieldAlert,
  ArrowRight,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PortainerIncompatibility } from "@/lib/berth-model";

interface PortainerAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  incompatibility: PortainerIncompatibility | null;
}

export default function PortainerAlertModal({
  isOpen,
  onClose,
  incompatibility,
}: PortainerAlertModalProps) {
  if (!incompatibility) return null;

  const {
    portainer,
    vessel,
    deficit,
    boomOutreach,
    vesselBeam,
    heightDeficit,
    requiredHeight,
    boomHeight,
  } = incompatibility;

  const isSuperPostPanamax = portainer.category === "super-post-panamax";

  // Determina as alternativas de portêineres disponíveis no cais
  const getRecommendation = () => {
    if (vesselBeam <= 60) {
      return {
        title: "Recomendação Operacional do Terminal:",
        text: `Aloque os portêineres P6 / P7 (lança de 60 m, Post-Panamax) ou P8 / P9 (lança de 65 m, Super Post-Panamax) para garantir 100% de cobertura operacional sobre todas as baias.`,
        suggestedCranes: ["P6 (60m)", "P7 (60m)", "P8 (65m)", "P9 (65m)"],
      };
    } else if (vesselBeam <= 65) {
      return {
        title: "Recomendação Operacional do Terminal:",
        text: `Aloque exclusivamente os portêineres P8 ou P9 (lança de 65 m, Super Post-Panamax) para atender a boca de ${vesselBeam.toFixed(1)} m desta embarcação.`,
        suggestedCranes: ["P8 (65m)", "P9 (65m)"],
      };
    } else {
      return {
        title: "Atenção Crítica de Atracação:",
        text: `A boca de ${vesselBeam.toFixed(1)} m excede o alcance útil do maior portêiner do terminal (P8/P9 com 65 m). A operação exigirá guindastes de bordo, giro da embarcação (mudança de bordo) ou autorização operacional especial.`,
        suggestedCranes: [],
      };
    }
  };

  const recommendation = getRecommendation();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-white border border-red-200 shadow-2xl rounded-2xl">
        {/* Faixa superior de alerta crítico */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30 shadow-inner animate-pulse">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-red-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-300 animate-ping inline-block" />
                Alerta Operacional de Atracação
              </div>
              <h2 className="text-lg font-black text-white leading-tight">
                Incompatibilidade de Portêiner
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-white/20 px-2.5 py-1 rounded-full border border-white/25">
            Portêiner {portainer.name}
          </span>
        </div>

        <div className="p-6 space-y-4">
          {/* Card Principal de Destaque da Lança Curta */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-300/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm md:text-base font-black text-red-900 tracking-tight flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>
                    Atenção: Lança curta — faltam{" "}
                    <span className="text-red-700 underline decoration-red-400 font-extrabold">
                      {deficit.toFixed(1)} m
                    </span>{" "}
                    na boca do navio
                  </span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  O portêiner <strong>{portainer.name}</strong> possui alcance de lança de{" "}
                  <strong>{boomOutreach} m</strong> sobre a água, insuficiente para cobrir toda a
                  boca de <strong>{vesselBeam.toFixed(1)} m</strong> do{" "}
                  <strong>{vessel.name}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Comparativo Lança vs Boca */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Card Portêiner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: portainer.color || "#65a30d" }}
                  />
                  Portêiner {portainer.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Estação {Math.round(portainer.position)} m
                </span>
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Alcance da lança:</span>
                  <strong className="text-slate-900 font-mono text-sm">{boomOutreach} m</strong>
                </div>
                <div className="flex justify-between">
                  <span>Categoria:</span>
                  <span className="font-medium text-slate-800">
                    {isSuperPostPanamax ? "Super Post-Panamax" : "Post-Panamax"}
                  </span>
                </div>
                {boomHeight && (
                  <div className="flex justify-between">
                    <span>Gabarito livre:</span>
                    <span className="font-mono">{boomHeight} m</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Navio */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
                  <Ship className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{vessel.name}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  LOA {vessel.loa} m
                </span>
              </div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Boca do navio:</span>
                  <strong className="text-red-700 font-mono text-sm">
                    {vesselBeam.toFixed(1)} m
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Calado:</span>
                  <span className="font-mono">{vessel.draft > 0 ? `${vessel.draft} m` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cota cais:</span>
                  <span className="font-mono text-[11px]">
                    {Math.round(vessel.position)}–{Math.round(vessel.position + vessel.loa)} m
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Alerta secundário de altura livre sob a lança (se aplicável) */}
          {heightDeficit && heightDeficit > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção ao gabarito vertical sob a lança:</strong> Faltam ~
                {heightDeficit.toFixed(1)} m de altura livre para acomodar a pilha estimada no
                convés (necessário ~{requiredHeight?.toFixed(1)} m; altura do portêiner:{" "}
                {boomHeight} m).
              </div>
            </div>
          )}

          {/* Recomendações e Alternativas */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{recommendation.title}</span>
            </div>
            <p className="text-xs text-blue-900 leading-relaxed">{recommendation.text}</p>
            {recommendation.suggestedCranes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-blue-700 font-semibold">Portêineres aptos:</span>
                {recommendation.suggestedCranes.map((crane) => (
                  <span
                    key={crane}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {crane}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com botão de confirmação */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
          >
            <span>Entendido / Ciente do Alerta</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
