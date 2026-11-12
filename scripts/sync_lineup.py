#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de sincronização do Lineup oficial (Santos Brasil / Tecon Rio)
e cruzamento com manobras em tempo real da Praticagem RJ.

Fonte:
- Portal Lineup: https://servicosabertosriobrasil.azurewebsites.net/Lineup
- API APIM: https://servicosabertosapim.azure-api.net/lineup/ObterLineupCompleto
- Manobras da Praticagem: client/public/praticagem_live.json
- Catálogo permanente: client/public/vessels_catalog.json

Gera:
- client/public/lineup_live.json (estatísticas, gráficos de serviços/meses/navios e lineup completo)
- client/public/lineup_history.json (histórico acumulado permanente de escalas)
- Atualiza client/public/praticagem_live.json (com campos service, voyage, operator, deadline)
- Atualiza client/public/vessels_catalog.json (com service, voyage, operator)
"""

import sys
import os
import json
import re
import urllib.request
from datetime import datetime, timedelta

# Assegurar saída UTF-8 no Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

LINEUP_API_URL = "https://servicosabertosapim.azure-api.net/lineup/ObterLineupCompleto"
APIM_KEY = "8f6bc3758c2143e99e59d54cc7d1bfe7"

SERVICE_MAPPING = [
    (r"\bTANGO\b", "TANGO", "Hapag-Lloyd / Maersk"),
    (r"\b(CONOSUR|ABAC)\b", "CONOSUR", "Maersk / Sealand / Hapag-Lloyd"),
    (r"\bBRAZEX\b", "BRAZEX", "CMA CGM / COSCO (Slot Maersk - ONE)"),
    (r"\bBRACO\b", "BRACO", "Mercosul (Slot LOG-IN)"),
    (r"\bSEAS\s*1\b", "SEAS 1", "CMA CGM / Evergreen / COSCO / PIL"),
    (r"\b(SEAS\s*2|SX2)\b", "SEAS 2", "CMA CGM / COSCO / Evergreen / PIL / Yang Ming"),
    (r"\b(LUX|ESE\s*2|EEX)\b", "LUX", "COSCO / ONE / OOCL"),
    (r"\bNORCOAST\b", "NORCOAST", "Norcoast"),
    (r"\bFEEDER\b", "FEEDER", "Log-In / Maersk / CMA CGM / Mercosul / ZIM"),
    (r"\bFALCON\b", "FALCON", "MSC / Hapag-Lloyd"),
    (r"\b(ZIM|TOUCAN)\b", "ZIM GULF TOUCAN", "ZIM"),
    (r"\bEXTRA\b", "EXTRA CALL", "Chamada Extra / Oportunidade"),
    (r"\bBREAK\b|\bBULK\b", "BREAK BULK", "Carga Geral / Breakbulk"),
    (r"\bQUIMICO\b", "QUIMICO", "Navio Tanque Químico"),
]

def clean_vessel_name(name):
    if not name:
        return ""
    clean = re.sub(r'[^A-Z0-9]+', '', name.upper())
    return clean

def normalize_service_name(raw):
    if not raw:
        return "OUTROS", "Serviço Não Informado", ""
    raw_clean = raw.strip().upper()
    for pattern, std_name, consortium in SERVICE_MAPPING:
        if re.search(pattern, raw_clean, re.IGNORECASE):
            return std_name, raw.strip(), consortium
    return raw_clean, raw.strip(), ""

def parse_date(date_str):
    if not date_str:
        return None
    d_str = date_str.strip()
    try:
        if "/" in d_str:
            parts = d_str.split(" ")
            d_parts = parts[0].split("/")
            day = int(d_parts[0])
            month = int(d_parts[1])
            year = int(d_parts[2])
            if year < 100:
                year += 2000
            hour, minute = 0, 0
            if len(parts) > 1 and ":" in parts[1]:
                h_parts = parts[1].split(":")
                hour = int(h_parts[0])
                minute = int(h_parts[1])
            return datetime(year, month, day, hour, minute)
        elif "-" in d_str and "T" in d_str:
            return datetime.fromisoformat(d_str.replace("Z", ""))
    except Exception:
        pass
    return None

def fetch_lineup_api():
    now = datetime.now()
    chegada_de = (now - timedelta(days=90)).isoformat()
    chegada_ate = (now + timedelta(days=120)).isoformat()

    payload = {
        "ChegadaDe": chegada_de,
        "ChegadaAte": chegada_ate
    }

    req = urllib.request.Request(
        LINEUP_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": APIM_KEY,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CaisLab/1.0"
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get("success"):
                obj = data.get("responseObject", [{}])[0]
                return obj.get("todos", [])
    except Exception as e:
        print(f"Aviso ao consultar Lineup API: {e}", file=sys.stderr)
    return []

def run_sync_lineup():
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(workspace_root, "client", "public")
    os.makedirs(public_dir, exist_ok=True)

    lineup_live_path = os.path.join(public_dir, "lineup_live.json")
    lineup_hist_path = os.path.join(public_dir, "lineup_history.json")
    praticagem_live_path = os.path.join(public_dir, "praticagem_live.json")
    catalog_path = os.path.join(public_dir, "vessels_catalog.json")

    # 1. Carregar histórico permanente existente
    history_map = {}
    if os.path.exists(lineup_hist_path):
        try:
            with open(lineup_hist_path, "r", encoding="utf-8") as f:
                saved_history = json.load(f)
                for item in saved_history:
                    key = f"{clean_vessel_name(item.get('navio'))}_{item.get('viagem')}"
                    history_map[key] = item
        except Exception as e:
            print(f"Aviso ao carregar histórico existente: {e}", file=sys.stderr)

    # 2. Buscar dados frescos da API do Lineup
    api_items = fetch_lineup_api()
    print(f"Itens recebidos do Lineup API: {len(api_items)}")

    # 3. Mesclar no histórico permanente
    for item in api_items:
        v_name = (item.get("navio") or "").strip().upper()
        voyage = (item.get("viagem") or "").strip().upper()
        if not v_name:
            continue
        key = f"{clean_vessel_name(v_name)}_{voyage}"
        
        std_service, full_service, consortium = normalize_service_name(item.get("serviceName"))

        normalized_item = {
            "rowNum": item.get("rowNum"),
            "navio": v_name,
            "viagem": voyage,
            "joint": item.get("joint"),
            "servico": std_service,
            "servicoCompleto": full_service,
            "consorcio": consortium,
            "operador": item.get("operator") or "",
            "berco": item.get("berco") or "",
            "aberturaGate": item.get("aberturaGate") or "",
            "deadline": item.get("deadline") or "",
            "previsaoChegada": item.get("previsaoChegada") or "",
            "chegada": item.get("chegada") or "",
            "previsaoAtracacao": item.get("previsaoAtracacao") or "",
            "atracacao": item.get("atracacao") or "",
            "inicioOperacao": item.get("inicioOperacao") or "",
            "termino": item.get("termino") or "",
            "previsaoSaida": item.get("previsaoSaida") or "",
            "saida": item.get("saida") or "",
            "cargas": item.get("loads") or 0,
            "descargas": item.get("disch") or 0,
            "remocoes": item.get("shift") or 0,
            "estado": item.get("estado") or "ABERTO",
            "tipoItemLineup": item.get("tipoItemLineup", 0),
            "updatedAt": datetime.now().strftime("%d/%m/%Y %H:%M")
        }
        history_map[key] = normalized_item

    all_lineup_items = list(history_map.values())

    # 4. Calcular estatísticas e agrupamentos para os Gráficos / Analytics
    now = datetime.now()
    cur_year = now.year
    cur_month_str = now.strftime("%Y-%m")

    monthly_stats = {}
    service_stats = {}
    vessel_stats = {}
    operator_stats = {}
    active_items = []

    total_year = 0
    total_month = 0

    for item in all_lineup_items:
        # Pega a melhor data disponível para classificação temporal
        dt = parse_date(item.get("atracacao")) or \
             parse_date(item.get("previsaoAtracacao")) or \
             parse_date(item.get("chegada")) or \
             parse_date(item.get("previsaoChegada"))

        if dt:
            item_year = dt.year
            m_key = dt.strftime("%Y-%m")
            m_label = dt.strftime("%b/%y").capitalize()
        else:
            item_year = cur_year
            m_key = cur_month_str
            m_label = now.strftime("%b/%y").capitalize()

        if item_year == cur_year:
            total_year += 1
            if m_key == cur_month_str:
                total_month += 1

        # Agrupamento mensal
        if m_key not in monthly_stats:
            monthly_stats[m_key] = {
                "month": m_key,
                "label": m_label,
                "total": 0,
                "realizados": 0,
                "esperados": 0
            }
        monthly_stats[m_key]["total"] += 1
        if item.get("atracacao") or item.get("estado") == "FECHADO":
            monthly_stats[m_key]["realizados"] += 1
        else:
            monthly_stats[m_key]["esperados"] += 1

        # Agrupamento por serviço
        svc = item.get("servico") or "OUTROS"
        if svc not in service_stats:
            service_stats[svc] = {
                "service": svc,
                "count": 0,
                "consorcio": item.get("consorcio") or "",
                "operators": set(),
                "vessels": set()
            }
        service_stats[svc]["count"] += 1
        if item.get("operador"):
            service_stats[svc]["operators"].add(item.get("operador"))
        if item.get("navio"):
            service_stats[svc]["vessels"].add(item.get("navio"))

        # Agrupamento por navio (frequência)
        v_name = item.get("navio")
        if v_name:
            if v_name not in vessel_stats:
                vessel_stats[v_name] = {
                    "name": v_name,
                    "count": 0,
                    "service": svc,
                    "operator": item.get("operador") or "",
                    "lastBerth": item.get("berco") or "",
                    "lastDate": item.get("atracacao") or item.get("previsaoChegada") or ""
                }
            vessel_stats[v_name]["count"] += 1
            if item.get("atracacao") or item.get("previsaoChegada"):
                vessel_stats[v_name]["lastDate"] = item.get("atracacao") or item.get("previsaoChegada")
            if svc != "OUTROS":
                vessel_stats[v_name]["service"] = svc
            if item.get("operador"):
                vessel_stats[v_name]["operator"] = item.get("operador")

        # Agrupamento por operador
        op = item.get("operador")
        if op:
            operator_stats[op] = operator_stats.get(op, 0) + 1

        # Navios ativos / esperados para cruzamento rápido
        if item.get("estado") in ["EM OPERACAO", "ABERTO"] or not item.get("saida"):
            active_items.append(item)

    # Ordenações
    sorted_months = sorted(monthly_stats.values(), key=lambda x: x["month"])
    
    total_calls_all = len(all_lineup_items)
    sorted_services = []
    for s in sorted(service_stats.values(), key=lambda x: -x["count"]):
        sorted_services.append({
            "service": s["service"],
            "count": s["count"],
            "percentage": round((s["count"] / max(1, total_calls_all)) * 100, 1),
            "consorcio": s["consorcio"],
            "operators": sorted(list(s["operators"])),
            "vesselsCount": len(s["vessels"])
        })

    sorted_vessels = sorted(vessel_stats.values(), key=lambda x: -x["count"])
    sorted_operators = [{"operator": op, "count": c} for op, c in sorted(operator_stats.items(), key=lambda x: -x[1])]

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    # 5. Salvar lineup_history.json
    with open(lineup_hist_path, "w", encoding="utf-8") as f:
        json.dump(all_lineup_items, f, ensure_ascii=False, indent=2)

    # 6. Salvar lineup_live.json
    lineup_live_data = {
        "updatedAt": now_str,
        "totalYear": total_year,
        "totalMonth": total_month,
        "totalAllTime": total_calls_all,
        "monthlyStats": sorted_months,
        "serviceStats": sorted_services,
        "vesselRanking": sorted_vessels,
        "operatorStats": sorted_operators,
        "activeCount": len(active_items),
        "items": all_lineup_items
    }
    with open(lineup_live_path, "w", encoding="utf-8") as f:
        json.dump(lineup_live_data, f, ensure_ascii=False, indent=2)

    # 7. Indexar histórico e ativos por nome limpo
    items_by_vessel = {}
    for it in all_lineup_items:
        c_name = clean_vessel_name(it.get("navio"))
        if c_name:
            if c_name not in items_by_vessel:
                items_by_vessel[c_name] = []
            items_by_vessel[c_name].append(it)

    # 8. Cruzar com praticagem_live.json
    if os.path.exists(praticagem_live_path):
        try:
            with open(praticagem_live_path, "r", encoding="utf-8") as f:
                prat_data = json.load(f)
            
            maneuvers = prat_data.get("maneuvers", [])
            enriched_count = 0

            for m in maneuvers:
                c_name = clean_vessel_name(m.get("name"))
                matches = items_by_vessel.get(c_name, [])
                if matches:
                    # Preferência: item em operação ou mais recente
                    best = None
                    for candidate in matches:
                        if candidate.get("estado") in ["EM OPERACAO", "ABERTO"]:
                            best = candidate
                            break
                    if not best:
                        best = matches[-1]

                    m["service"] = best.get("servico")
                    m["serviceFull"] = best.get("servicoCompleto")
                    m["consorcio"] = best.get("consorcio")
                    m["voyage"] = best.get("viagem")
                    m["operator"] = best.get("operador")
                    m["deadline"] = best.get("deadline")
                    m["gateOpening"] = best.get("aberturaGate")
                    m["lineupBerth"] = best.get("berco")
                    enriched_count += 1

            prat_data["updatedAt"] = now_str
            with open(praticagem_live_path, "w", encoding="utf-8") as f:
                json.dump(prat_data, f, ensure_ascii=False, indent=2)
            print(f"Manobras da Praticagem enriquecidas com serviços: {enriched_count} de {len(maneuvers)}")
        except Exception as e:
            print(f"Erro ao enriquecer praticagem_live.json: {e}", file=sys.stderr)

    # Navios Salvos (catálogo permanente) não armazenam serviço fixo,
    # pois o mesmo navio altera de serviço entre diferentes viagens/afretamentos.
    # O serviço é mantido exclusivamente nas escalas ativas (Praticagem RJ / Lineup)
    # para cálculo dos gráficos e analytics.

    print(json.dumps({
        "status": "success",
        "totalYear": total_year,
        "totalMonth": total_month,
        "totalHistory": total_calls_all,
        "servicesCount": len(sorted_services),
        "vesselsCount": len(sorted_vessels),
        "updatedAt": now_str
    }))

if __name__ == "__main__":
    run_sync_lineup()
