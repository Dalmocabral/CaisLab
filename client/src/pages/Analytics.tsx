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
  TrendingUp,
  RefreshCw,
  ArrowLeft,
  Compass,
  Clock,
  AlertCircle,
  PieChart as PieIcon,
} from "lucide-react";
import {
  fetchLineupLive,
  type LineupLiveResponse,
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

const TYPE_COLORS: Record<string, string> = {
  "Porta-Contêineres": "#0284c7", // azul
  "Carga Geral / Breakbulk": "#f59e0b", // âmbar
  "Navio Tanque Químico": "#8b5cf6", // roxo
  "Apoio Marítimo / Offshore": "#10b981", // esmeralda
};

export default function AnalyticsPage() {
  const [data, setData] = useState<LineupLiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Toggle do gráfico em rosca: Mensal vs Anual
  const [typePeriod, setTypePeriod] = useState<"mensal" | "anual">("anual");

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

  // Sincroniza em tempo real conectando à API do Lineup
  async function handleRefreshLive() {
    setSyncing(true);
    setErrorMsg(null);
    try {
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
          await loadData();
          setSyncing(false);
          return;
        }
      }
    } catch {
      // fallback
    }

    await loadData();
    setSyncing(false);
  }

  // Agrupamento por Tipo de Navio (Mensal / Anual)
  const vesselTypeData = useMemo(() => {
    if (!data?.items) return [];

    const now = new Date();
    const curMonth = String(now.getMonth() + 1).padStart(2, "0");
    const curYear = String(now.getFullYear()).slice(-2);
    const monthPattern = `/${curMonth}/${curYear}`;

    const counts: Record<string, number> = {
      "Porta-Contêineres": 0,
      "Carga Geral / Breakbulk": 0,
      "Navio Tanque Químico": 0,
      "Apoio Marítimo / Offshore": 0,
    };

    data.items.forEach((item) => {
      // Filtro de mês
      if (typePeriod === "mensal") {
        const dt = item.atracacao || item.previsaoAtracacao || item.chegada || item.previsaoChegada || "";
        if (!dt.includes(monthPattern) && !dt.includes(`/${curMonth}/`) && !dt.includes(`-${curMonth}-`)) {
          return;
        }
      }

      const svc = (item.servico || "").toUpperCase();
      const navio = (item.navio || "").toUpperCase();

      let tipo = "Porta-Contêineres";
      if (svc.includes("QUIMICO")) {
        tipo = "Navio Tanque Químico";
      } else if (svc.includes("BREAK") || svc.includes("BULK")) {
        tipo = "Carga Geral / Breakbulk";
      } else if (navio.includes("DEEP") || navio.includes("OFFSHORE") || navio.includes("PLSV")) {
        tipo = "Apoio Marítimo / Offshore";
      }

      counts[tipo] = (counts[tipo] || 0) + 1;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
        color: TYPE_COLORS[name] || "#64748b",
      }));
  }, [data, typePeriod]);

  const totalTypesCount = useMemo(() => {
    return vesselTypeData.reduce((acc, curr) => acc + curr.value, 0);
  }, [vesselTypeData]);

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
                    Estatísticas & Gráficos do Terminal
                  </h1>
                  <p className="text-[11px] text-[#637882] font-medium mt-0.5">
                    Santos Brasil / Tecon Rio — Volume de atracações e frequência de navios
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

        {/* 1. Summary Cards (KPIs) - Total de Navios do Mês e do Ano */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Card 1: Navios do Mês */}
          <div className="bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#627680] uppercase tracking-wider">
                Total de Navios no Mês
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl font-extrabold text-[#102d40]">
                {loading ? "…" : data?.totalMonth || 0}
              </span>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Mês Atual ({new Date().toLocaleString("pt-BR", { month: "long" })})
              </span>
            </div>
            <p className="mt-2 text-xs text-[#71858e]">
              Atracações programadas e realizadas no terminal durante o mês corrente
            </p>
          </div>

          {/* Card 2: Total Navios do Ano */}
          <div className="bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#627680] uppercase tracking-wider">
                Total de Navios no Ano
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Ship className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl font-extrabold text-[#102d40]">
                {loading ? "…" : data?.totalYear || 0}
              </span>
              <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                Ano {new Date().getFullYear()}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#71858e]">
              Volume total acumulado de navios atracados no cais em {new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* 2. Visual Charts Row 1: Volume Mensal + Distribuição por Tipo de Navio (Rosca) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Volume Mensal de Navios (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Volume Mensal de Navios</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Evolução mês a mês das atracações no cais
                </p>
              </div>
            </div>

            <div className="h-[290px] w-full mt-2">
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
                        name === "realizados" ? "Realizados" : "Esperados",
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

          {/* Chart 2: Gráfico em Rosca (Distribuição por Tipo de Navio) (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-sky-600" />
                  <span>Distribuição por Tipo de Navio</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Porta-contêineres, carga geral, químico e apoio
                </p>
              </div>

              {/* Seletor Mensal / Anual */}
              <div className="flex items-center gap-1 bg-[#f0f5f7] p-1 rounded-lg border border-[#d6e4e8] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTypePeriod("mensal")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    typePeriod === "mensal"
                      ? "bg-white text-[#102d40] shadow-xs"
                      : "text-[#627780] hover:text-[#102d40]"
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setTypePeriod("anual")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    typePeriod === "anual"
                      ? "bg-white text-[#102d40] shadow-xs"
                      : "text-[#627780] hover:text-[#102d40]"
                  }`}
                >
                  Anual
                </button>
              </div>
            </div>

            {/* Conteúdo do Donut Chart */}
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 mt-1">
              <div className="relative w-[190px] h-[190px] shrink-0">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">
                    Carregando...
                  </div>
                ) : vesselTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val} navios`, name]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #dce6eb",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        }}
                      />
                      <Pie
                        data={vesselTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {vesselTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">
                    Sem dados.
                  </div>
                )}

                {/* Centro da Rosca */}
                {!loading && totalTypesCount > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-[#102d40] leading-none">
                      {totalTypesCount}
                    </span>
                    <span className="text-[10px] font-bold text-[#71858e] uppercase tracking-wider mt-0.5">
                      {typePeriod === "mensal" ? "No Mês" : "No Ano"}
                    </span>
                  </div>
                )}
              </div>

              {/* Legenda Lateral com Percentuais */}
              <div className="flex-1 w-full space-y-2">
                {loading ? (
                  <div className="text-xs text-gray-400">Carregando categorias...</div>
                ) : (
                  vesselTypeData.map((t) => (
                    <div
                      key={t.name}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#f8fafb] border border-[#e8eff2]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="font-semibold text-[#1f3845] truncate text-[11px]" title={t.name}>
                          {t.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <strong className="text-[#102d40] font-bold">{t.value}</strong>
                        <span className="text-[10px] text-gray-400 ml-1">({t.percentage}%)</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Row 2: Quais Serviços têm Mais Quantidade + Ranking de Frequência de Navios */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 3: Quais Serviços têm Mais Quantidade (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  <span>Quais Serviços têm Mais Quantidade</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Ranking e volume de escalas por linha/serviço
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] pr-2 space-y-3 mt-2">
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
                          <strong className="text-[#102d40] font-bold text-sm">{svc.count}</strong>
                          <span className="text-[10px] text-gray-400 ml-1">({svc.percentage}%)</span>
                        </div>
                      </div>
                      {/* Bar indicator */}
                      <div className="w-full bg-[#f1f5f7] rounded-full h-2.5 overflow-hidden">
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

          {/* Ranking de Frequência de Navios (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#dce6eb] shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#102d40] flex items-center gap-2">
                  <Ship className="w-4 h-4 text-teal-600" />
                  <span>Quantas Vezes Cada Navio Aparece</span>
                </h2>
                <p className="text-xs text-[#71858e]">
                  Frequência de escalas por embarcação no terminal
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {data?.vesselRanking?.length || 0} navios
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] border border-[#e5edf0] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#f8fafb] z-10">
                  <tr className="border-b border-[#e5edf0] text-[11px] font-bold text-[#627780] uppercase tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Nome do Navio</th>
                    <th className="py-2.5 px-3">Serviço</th>
                    <th className="py-2.5 px-3 text-center">Escalas</th>
                    <th className="py-2.5 px-3">Última Atracação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f5] text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">
                        Carregando ranking de navios...
                      </td>
                    </tr>
                  ) : data?.vesselRanking && data.vesselRanking.length > 0 ? (
                    data.vesselRanking.map((v, idx) => {
                      const badgeColor = getServiceBadgeColor(v.service);
                      return (
                        <tr key={v.name} className="hover:bg-[#f8fafb] transition-colors">
                          <td className="py-2.5 px-3 font-bold text-[#869aa3]">
                            {idx + 1}º
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-extrabold text-[#102d40] text-sm">{v.name}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {v.service ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border}`}
                              >
                                {v.service}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2.5 py-0.5 bg-teal-50 text-teal-800 font-extrabold rounded-full text-xs border border-teal-200">
                              {v.count}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#556d77] font-medium text-xs">
                            {v.lastDate || "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">
                        Nenhum navio encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
