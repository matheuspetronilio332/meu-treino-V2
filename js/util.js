// Utilitários pequenos, sem dependências e sem acesso ao DOM (testáveis no Node).

export const VERSAO_APP = '2.1.0';

export class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroValidacao';
  }
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** Data local no formato AAAA-MM-DD (não usa UTC, para não "virar o dia" à noite). */
export function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  if (a < 1900 || a > 2100) return false;
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatarData(iso) {
  if (!dataValida(iso)) return String(iso);
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataCurta(iso) {
  if (!dataValida(iso)) return String(iso);
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Número de dias desde 1970 (para comparar/espaçar datas sem fuso horário). */
export function numeroDoDia(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86400000;
}

/** Converte "24/10/2025" (formato da versão antiga) para "2025-10-24". */
export function converterDataBR(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const iso = `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return dataValida(iso) ? iso : null;
}

export function novoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function formatarNumero(n, casas = 1) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

/** "+0,4 kg", "−1 kg" (com o sinal de menos tipográfico) ou "0 kg". */
export function formatarDelta(n, unidade = 'kg', casas = 1) {
  if (!n) return `0 ${unidade}`;
  const sinal = n > 0 ? '+' : '−';
  return `${sinal}${formatarNumero(Math.abs(n), casas)} ${unidade}`;
}

/** Minúsculas, sem acentos e sem espaços repetidos: "Supino  Réto" → "supino reto". */
export function normalizarNome(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
