import React, { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Ship,
  Calendar,
  Anchor,
  TrendingUp,
  RefreshCw,
  ArrowLeft,
  Search,
  Filter,
  Download,
  Layers,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Boxes,
} from "lucide-react";
import {
  fetchLineupLive,
  type LineupLiveResponse,
  type LineupItem,
  type MonthlyStat,
  type ServiceStat,
  type VesselRankingItem,
  getServiceBadgeColor,
} from "@/lib/vessel-catalog";

const SERVICE_COLORS = [
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#f97316", // orange
  "#14b8a6", // teal
  "#64748b", // slate
];

export default function AnalyticsPage() {
  const [data, setData] = useState<LineupLiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedService, setSelectedService] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetchLineupLive();
      setData(res);
    } catch (err: any) {
      console.error("Erro ao carregar dados do Lineup:", err);
      setErrorMsg("Não foi possível carregar os dados consolidados do Lineup.");
    } finally {
      setLoading(false);
    }
  }

  // Tenta sincronizar em tempo real conectando diretamente à APIM ou disparando re-fetch
  async function handleRefreshLive() {
    setSyncing(true);
    setErrorMsg(null);
    try {
      // Tentar fetch direto da API APIM no browser se CORS permitir
      const now = new Date();
      const chegadaDe = new Date(now.getFullYear(), 0, 1).toISOString();
      const chegadaAte = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

      const response = await fetch("https://servicosabertosapim.azure-api.net/lineup/ObterLineupCompleto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": "8f6bc3758c2143e99e59d54cc7d1bfe7",
        },
        body: JSON.stringify({
          ChegadaDe: chegadaDe,
          ChegadaAte: chegadaAte,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.success && json?.responseObject?.[0]?.todos) {
          // Atualiza dados locais com a resposta direta
          await loadData();
          setSyncing(false);
          return;
        }
      }
    } catch {
      // Se CORS ou rede falhar, recarrega o lineup_live.json do Pages
    }

    await loadData();
    setSyncing(false);
  }

  // Itens filtrados para a tabela
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((item) => {
      // Filtro de texto
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = item.navio?.toLowerCase().includes(q);
        const matchVoy = item.viagem?.toLowerCase().includes(q);
        const matchSvc = item.servico?.toLowerCase().includes(q);
        const matchOp = item.operador?.toLowerCase().includes(q);
        const matchBerth = item.berco?.toLowerCase().includes(q);
        if (!matchName && !matchVoy && !matchSvc && !matchOp && !matchBerth) {
          return false;
        }
      }

      // Filtro de mês
      if (selectedMonth !== "all") {
        const dateStr = item.atracacao || item.previsaoAtracacao || item.chegada || item.previsaoChegada || "";
        if (!dateStr.includes(selectedMonth)) {
          return false;
        }
      }

      // Filtro de serviço
      if (selectedService !== "all") {
        if (item.servico !== selectedService) {
          return false;
        }
      }

      // Filtro de status
      if (selectedStatus !== "all") {
        if (item.estado !== selectedStatus) {
          return false;
        }
      }

      return true;
    });
  }, [data, searchQuery, selectedMonth, selectedService, selectedStatus]);

  // Lista única de serviços para o dropdown
  const uniqueServices = useMemo(() => {
    if (!data?.serviceStats) return [];
    return data.serviceStats.map((s) => s.service);
  }, [data]);

  // Exportar para CSV
  function exportToCsv() {
    if (!filteredItems.length) return;
    const headers = [
      "Navio",
      "Viagem",
      "Servico",
      "Consorcio",
      "Operador",
      "Berco",
      "Previsao_Chegada",
      "Chegada",
      "Atracacao",
      "Saida",
      "Cargas",
      "Descargas",
      "Deadline",
      "Estado",
    ];

    const rows = filteredItems.map((item) => [
      `"${item.navio || ""}"`,
      `"${item.viagem || ""}"`,
      `"${item.servico || ""}"`,
      `"${item.consorcio || ""}"`,
      `"${item.operador || ""}"`,
      `"${item.berco || ""}"`,
      `"${item.previsaoChegada || ""}"`,
      `"${item.chegada || ""}"`,
      `"${item.atracacao || ""}"`,
      `"${item.saida || ""}"`,
      item.cargas || 0,
      item.descargas || 0,
      `"${item.deadline || ""}"`,
      `"${item.estado || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lineup_tecon_rio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-[#f3f7f9] text-[#132c38] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-[#dce6eb] px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 bg-[#f0f5f7] hover:bg-[#e4edf0] text-[#126f7f] rounded-lg transition-colors border border-[#d2e0e5] flex items-center gap-2 text-xs font-bold"
              title="Voltar ao Simulador de Atracação"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Simulador</span>
            </Link>

            <div className="h-6 w-[1px] bg-gray-200 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-700 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold text-[#102d40] leading-none">
                    Analytics & Lineup do Terminal
                  </h1>
                  <p className="text-[11px] text-[#637882] font-medium mt-0.5">
                    Santos Brasil / Tecon Rio — Cruzamento em tempo real com Praticagem RJ
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {data?.updatedAt && (
              <span className="text-xs text-[#637882] flex items-center gap-1.5 font-medium whitespace-nowrap bg-[#f8fafb] px-3 py-1.5 rounded-lg border border-[#e2eaed]">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                Atualizado: <strong className="text-[#102d40]">{data.updatedAt}</strong>
              </span>
            )}

            <button
              type="button"
              onClick={handleRefreshLive}
              disabled={syncing}
              className="px-3.5 py-2 bg-[#126f7f] hover:bg-[#0e5c6a] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Atualizando..." : "Sincronizar Lineup"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col gap-6">
        {errorMsg && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Summary Cards (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Navios do Mês */}
          <div className="bg-white p-5 rounded-2xl border border-[#dce6eb] shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#627680] uppercase tracking-wider">
                Navios no Mês
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#102d40]">
                {loading ? "…" : data?.totalMonth || 0}
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                Mês Atual
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#71858e]">
              Escalas programadas e realizadas em {new Date().toLocaleString("pt-BR", { month: "long" })}
            </p>
          </div>

          {/* Card 2: Total Navios do Ano */}
          <div className="bg-white p-5 rounded-2xl border border-[#dce6eb] shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#627680] uppercase tracking-wider">
                Navios no Ano
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Ship className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#102d40]">
                {loading ? "…" : data?.totalYear || 0}
              </span>
              <span className="text-xs text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full">
                Ano {new Date().getFullYear()}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#71858e]">
              Total de atracações cadastradas no Lineup oficial
            </p>
          </div>

          {/* Card 3: Escalas Ativas / Esperadas */}
          <div className="bg-white p-5 rounded-2xl border border-[#dce6eb] shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#627680] uppercase tracking-wider">
                Ativos / Esperados
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Anchor className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#102d40]">
                {loading ? "…" : data?.activeCount || 0}
              </span>
              <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                Em Carteira
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#71858e]">
              Navios atracados agora ou previstos para os próximos dias
            </p>
          </div>

          {/* Card 4: Serviços Regulares */}
          <div className="bg-white p-5 rounded-2xl border border-[#dce6eb] shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#627680] uppercase tracking-wider">
                Serviços de Linha
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#102d40]">
                {loading ? "…" : data?.serviceStats?.length || 0}
              </span>
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                Serviços Ativos
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[#71858e]">
              Consórcios e rotas de navegação operando no Tecon Rio
            </p>
          </div>
        </div>

        {/* 2. Visual Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Volume Mensal de Atracações (8 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Volume Mensal de Navios</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Distribuição de atracações mês a mês (Realizados vs Esperados)
                </p>
              </div>
            </div>

            <div className="h-[280px] w-full mt-2">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  Carregando gráfico mensal...
                </div>
              ) : data?.monthlyStats && data.monthlyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyStats} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f4" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#637882" }} axisLine={{ stroke: "#e2eaed" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#637882" }} axisLine={{ stroke: "#e2eaed" }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `${val} navios`,
                        name === "realizados" ? "Realizados / Fechados" : "Esperados / Em Aberto",
                      ]}
                      labelFormatter={(label) => `Mês: ${label}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #dce6eb",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                      formatter={(value) => (value === "realizados" ? "Realizados" : "Esperados")}
                    />
                    <Bar dataKey="realizados" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="esperados" fill="#0284c7" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  Nenhum dado mensal disponível.
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Distribuição por Serviço de Linha (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  <span>Distribuição por Serviço</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Participação de cada serviço no volume do cais
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3 mt-2">
              {loading ? (
                <div className="p-8 text-center text-xs text-gray-400">Carregando serviços...</div>
              ) : data?.serviceStats && data.serviceStats.length > 0 ? (
                data.serviceStats.map((svc, idx) => {
                  const badgeColor = getServiceBadgeColor(svc.service);
                  const maxCount = data.serviceStats[0]?.count || 1;
                  const barWidth = Math.max(8, Math.round((svc.count / maxCount) * 100));

                  return (
                    <div key={svc.service} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-bold px-2 py-0.5 rounded border text-[11px] ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}
                          >
                            {svc.service}
                          </span>
                          {svc.consorcio && (
                            <span className="text-[10px] text-[#788d97] truncate max-w-[170px]" title={svc.consorcio}>
                              {svc.consorcio}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <strong className="text-[#102d40] font-bold">{svc.count}</strong>
                          <span className="text-[10px] text-gray-400 ml-1">({svc.percentage}%)</span>
                        </div>
                      </div>
                      {/* Bar indicator */}
                      <div className="w-full bg-[#f1f5f7] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: SERVICE_COLORS[idx % SERVICE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-gray-400">Nenhum serviço registrado.</div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Vessel Rankings & Shipping Lines Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Most Frequent Vessels (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Ship className="w-4 h-4 text-teal-600" />
                  <span>Ranking de Frequência de Navios</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Navios que mais atracaram no terminal neste período
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                Top {Math.min(10, data?.vesselRanking?.length || 0)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5edf0] text-[11px] font-bold text-[#627780] uppercase tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Navio</th>
                    <th className="py-2.5 px-3">Serviço</th>
                    <th className="py-2.5 px-3">Armador</th>
                    <th className="py-2.5 px-3 text-right">Escalas</th>
                    <th className="py-2.5 px-3">Última Atracação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f5] text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        Carregando ranking de navios...
                      </td>
                    </tr>
                  ) : data?.vesselRanking && data.vesselRanking.length > 0 ? (
                    data.vesselRanking.slice(0, 10).map((v, idx) => {
                      const badgeColor = getServiceBadgeColor(v.service);
                      return (
                        <tr key={v.name} className="hover:bg-[#f8fafb] transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[#869aa3]">
                            {idx + 1}º
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#102d40]">{v.name}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {v.service ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}
                              >
                                {v.service}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[#526a75] font-medium">
                            {v.operator || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-block px-2.5 py-0.5 bg-teal-50 text-teal-800 font-extrabold rounded-full text-xs">
                              {v.count}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#647c87] text-[11px]">
                            {v.lastDate || "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        Nenhum navio encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operator breakdown (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  <span>Participação por Armador</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Operadores de carga e linhas de navegação
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1">
              {loading ? (
                <div className="col-span-2 p-8 text-center text-xs text-gray-400">
                  Carregando armadores...
                </div>
              ) : data?.operatorStats && data.operatorStats.length > 0 ? (
                data.operatorStats.slice(0, 10).map((op) => (
                  <div
                    key={op.operator}
                    className="p-3 bg-[#f8fafb] border border-[#e5edf0] rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <span className="font-extrabold text-sm text-[#102d40] block">
                        {op.operator}
                      </span>
                      <span className="text-[10px] text-[#71858e]">Armador / Operador</span>
                    </div>
                    <span className="text-base font-extrabold text-[#126f7f] bg-[#eef7f9] px-2.5 py-0.5 rounded-lg border border-[#d7e9ed]">
                      {op.count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-8 text-center text-xs text-gray-400">
                  Nenhum armador cadastrado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Complete Searchable Lineup Table */}
        <div className="bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" />
                <span>Lineup Completo do Terminal ({filteredItems.length} escalas)</span>
              </h2>
              <p className="text-xs text-[#71858e]">
                Todas as escalas de navios com serviços, horários e deadlines
              </p>
            </div>

            <button
              type="button"
              onClick={exportToCsv}
              className="px-3 py-1.5 bg-[#f0f6f8] hover:bg-[#e2edf1] text-[#126f7f] border border-[#cfdfe4] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start md:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#edf3f5]">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar navio, viagem, berço..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#cfdce0] rounded-lg focus:outline-none focus:border-teal-500 bg-white"
              />
            </div>

            {/* Service filter */}
            <div>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#cfdce0] rounded-lg focus:outline-none focus:border-teal-500 bg-white"
              >
                <option value="all">Todos os Serviços</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>
                    Serviço: {svc}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#cfdce0] rounded-lg focus:outline-none focus:border-teal-500 bg-white"
              >
                <option value="all">Todos os Estados</option>
                <option value="EM OPERACAO">Em Operação</option>
                <option value="ABERTO">Em Aberto / Previsto</option>
                <option value="FECHADO">Fechado / Concluído</option>
                <option value="CANCELADO">Cancelado / Omitido</option>
              </select>
            </div>

            {/* Clear filters */}
            {(searchQuery || selectedService !== "all" || selectedStatus !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedService("all");
                  setSelectedStatus("all");
                }}
                className="text-xs text-[#126f7f] hover:underline font-semibold self-center"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-[#e5edf0] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f7fafb] border-b border-[#e5edf0] text-[11px] font-bold text-[#556c76] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Navio / Viagem</th>
                  <th className="py-3 px-3">Serviço</th>
                  <th className="py-3 px-3">Armador</th>
                  <th className="py-3 px-3">Berço</th>
                  <th className="py-3 px-3">Atracação</th>
                  <th className="py-3 px-3">Saída / Término</th>
                  <th className="py-3 px-3">Movimento</th>
                  <th className="py-3 px-3">Deadline Gate</th>
                  <th className="py-3 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf3f5]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      Carregando escalas...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      Nenhuma escala encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const badgeColor = getServiceBadgeColor(item.servico);
                    const isClosed = item.estado === "FECHADO";
                    const isOperating = item.estado === "EM OPERACAO";
                    const isCancelled = item.estado === "CANCELADO";

                    return (
                      <tr key={`${item.navio}-${item.viagem}-${idx}`} className="hover:bg-[#f8fafb] transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-bold text-[#102d40] block">{item.navio}</span>
                          <span className="text-[10px] text-gray-400 font-mono">Viagem: {item.viagem}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-bold px-2 py-0.5 rounded border text-[10px] inline-block ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}
                          >
                            {item.servico}
                          </span>
                          {item.consorcio && (
                            <span className="text-[10px] text-[#71858e] block mt-0.5 truncate max-w-[140px]" title={item.consorcio}>
                              {item.consorcio}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#304854]">
                          {item.operador || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-[#f0f6f8] text-[#1a4a5d] px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-[#d6e5ea]">
                            {item.berco || "A definir"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#445d68]">
                          {item.atracacao ? (
                            <span className="font-bold text-emerald-800">{item.atracacao}</span>
                          ) : item.previsaoAtracacao ? (
                            <span className="text-gray-600">Prev: {item.previsaoAtracacao}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#445d68]">
                          {item.saida || item.termino ? (
                            <span>{item.saida || item.termino}</span>
                          ) : item.previsaoSaida ? (
                            <span className="text-gray-500">Prev: {item.previsaoSaida}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#445d68]">
                          {(item.cargas || item.descargas) ? (
                            <span className="text-[11px] font-medium">
                              <span className="text-emerald-700">+{item.cargas || 0}</span> /{" "}
                              <span className="text-blue-700">-{item.descargas || 0}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#647c87] font-medium text-[11px]">
                          {item.deadline || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              isOperating
                                ? "bg-emerald-100 text-emerald-800 animate-pulse"
                                : isClosed
                                ? "bg-slate-100 text-slate-700"
                                : isCancelled
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
