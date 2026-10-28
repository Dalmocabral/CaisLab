import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Award,
  Lock,
  Copy,
  Check,
  Scale,
  FileCode2,
  Calendar,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getSystemIntegrityCertificate,
  type SystemIntegrityCertificate,
} from "@/lib/berth-model";

interface SystemIntegrityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemIntegrityModal({
  isOpen,
  onClose,
}: SystemIntegrityModalProps) {
  const [cert, setCert] = useState<SystemIntegrityCertificate | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const data = getSystemIntegrityCertificate();
        setCert(data);

        // Emite registro formal no DevTools console com fé de integridade
        console.group(
          "%c🛡️ CAISLAB — CERTIFICADO DE AUTORIA ORIGINAL & INTEGRIDADE",
          "color: #0284c7; font-weight: bold; font-size: 14px;"
        );
        console.info(`%cAutor Original:%c ${data.author}`, "font-weight: bold;", "color: #059669;");
        console.info(`%cSoftware:%c ${data.project}`, "font-weight: bold;", "color: #0f172a;");
        console.info(`%cAno de Concepção:%c ${data.initialYear}`, "font-weight: bold;", "");
        console.info(`%cIdentificador Único:%c ${data.fingerprint}`, "font-weight: bold;", "color: #7c3aed;");
        console.info(`%cHash SHA-256 da Obra:%c ${data.signatureSha256}`, "font-weight: bold;", "font-family: monospace;");
        console.info(`%cAmparo Legal:%c ${data.legalBasis}`, "font-weight: bold;", "");
        console.groupEnd();
      } catch (err) {
        console.error("Falha na validação de integridade do sistema:", err);
      }
    }
  }, [isOpen]);

  if (!isOpen || !cert) return null;

  const handleCopy = async () => {
    const timestamp = new Date().toLocaleString("pt-BR");
    const reportText = `================================================================================
CERTIDÃO DE AUTORIA E PROPRIEDADE INTELECTUAL DE SOFTWARE
================================================================================
Obra / Software: ${cert.project}
Autor e Desenvolvedor Original: ${cert.author}
Ano Inicial de Concepção: ${cert.initialYear}
Jurisdição: ${cert.jurisdiction}
Amparo Legal: ${cert.legalBasis}

Identificador Único (Fingerprint): ${cert.fingerprint}
Assinatura Criptográfica (SHA-256): ${cert.signatureSha256}
Data da Verificação Local: ${timestamp}

DECLARAÇÃO DE DIREITOS E ADVERTÊNCIA LEGAL:
${cert.notice}

Status da Verificação: INTEGRIDADE E AUTORIA VALIDADAS COM SUCESSO.
================================================================================`;

    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback para cópia
      const el = document.createElement("textarea");
      el.value = reportText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-950 text-slate-100 border-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Faixa decorativa superior com gradiente de segurança */}
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Cabeçalho */}
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/80 border border-sky-500/30 text-sky-400">
                <ShieldCheck size={13} className="text-sky-400" /> Prova de Autoria Digital
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
                <Lock size={11} className="text-emerald-400" /> Criptografia Ativa
              </span>
            </div>

            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Award className="text-amber-400 shrink-0" size={26} />
              Certidão de Autoria e Propriedade Intelectual
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Registro pericial embutido no código-fonte para comprovação formal de autoria e integridade.
            </DialogDescription>
          </DialogHeader>

          {/* Grid de Informações Oficiais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Autor */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={13} className="text-emerald-400" /> Autor Original
              </span>
              <p className="text-sm font-bold text-emerald-300">{cert.author}</p>
            </div>

            {/* Obra */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode2 size={13} className="text-sky-400" /> Obra / Software
              </span>
              <p className="text-sm font-semibold text-sky-200 truncate" title={cert.project}>
                {cert.project}
              </p>
            </div>

            {/* Ano / Jurisdição */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-amber-400" /> Ano de Criação / Foro
              </span>
              <p className="text-slate-200 font-medium">
                {cert.initialYear} • {cert.jurisdiction}
              </p>
            </div>

            {/* Amparo Legal */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Scale size={13} className="text-indigo-400" /> Amparo Legal
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Leis Federais nº 9.609/98 e 9.610/98
              </p>
            </div>
          </div>

          {/* Assinatura Criptográfica SHA-256 e Fingerprint */}
          <div className="p-3.5 rounded-lg bg-slate-900/95 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">
                Fingerprint de Autoria
              </span>
              <span className="font-mono text-purple-400 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
                {cert.fingerprint}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold block">
                Hash SHA-256 do Registro:
              </span>
              <div className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 break-all select-all">
                {cert.signatureSha256}
              </div>
            </div>
          </div>

          {/* Notificação Legal */}
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-200/90 text-[11px] leading-relaxed">
            <strong className="text-amber-300 font-semibold block mb-0.5">
              Declaração de Exclusividade e Propriedade Intelectual:
            </strong>
            {cert.notice}
          </div>

          {/* Rodapé / Ações */}
          <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors shadow-sm"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-300" />
                  <span>Certidão Copiada com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar Certidão de Prova</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Fechar
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
