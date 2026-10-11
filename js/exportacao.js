// Backup e importação: JSON completo e CSVs (abrem direto no Excel/Planilhas em português).

import { ErroValidacao } from './util.js';
import { sanitizar } from './modelo.js';

export const LIMITE_IMPORTACAO = 5 * 1024 * 1024; // 5 MB

export function gerarJSON(estado, agora = new Date()) {
  const { pesos, medidas, rotinas, historico, config } = estado;
  return JSON.stringify(
    { app: 'meu-treino', formato: 2, exportadoEm: agora.toISOString(), dados: { pesos, medidas, rotinas, historico, config } },
    null,
    2,
  );
}

// Texto de usuário vai para CSV: neutraliza "injeção de fórmula" (=, +, -, @) e aspas/; internos.
function celulaTexto(valor) {
  let s = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
const celulaNumero = (n) => (n == null ? '' : String(n).replace('.', ','));

// Separador ";" e decimal "," é o que o Excel em português espera; o BOM garante os acentos.
export function gerarCSVPesos(pesos) {
  const linhas = ['data;peso_kg', ...pesos.map((p) => `${p.data};${celulaNumero(p.peso)}`)];
  return `\uFEFF${linhas.join('\r\n')}\r\n`;
}

export function gerarCSVTreinos(historico) {
  const linhas = ['data;rotina;exercicio;series_planejadas;series_feitas;repeticoes;carga_kg'];
  for (const s of historico) {
    for (const it of s.itens) {
      linhas.push(
        [s.data, celulaTexto(s.rotinaNome), celulaTexto(it.nome), it.series, it.feitas, it.reps, celulaNumero(it.carga)].join(';'),
      );
    }
  }
  return `\uFEFF${linhas.join('\r\n')}\r\n`;
}

/** Lê o texto de um arquivo de backup e devolve um estado válido (ou lança ErroValidacao). */
export function lerImportacao(textoArquivo) {
  if (typeof textoArquivo !== 'string' || textoArquivo.length > LIMITE_IMPORTACAO) {
    throw new ErroValidacao('Arquivo grande demais (limite de 5 MB).');
  }
  let obj;
  try {
    obj = JSON.parse(textoArquivo.replace(/^\uFEFF/, ''));
  } catch {
    throw new ErroValidacao('O arquivo não é um backup JSON válido.');
  }
  const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const dados = ehObj(obj) && ehObj(obj.dados) ? obj.dados : obj;
  if (!ehObj(dados)) throw new ErroValidacao('O arquivo não parece ser um backup do Meu treino.');

  const estado = sanitizar(dados);
  const total = estado.pesos.length + estado.medidas.length + estado.rotinas.length + estado.historico.length;
  if (total === 0) throw new ErroValidacao('Nenhum dado reconhecido neste arquivo.');
  return estado;
}

export function baixarArquivo(nome, conteudo, mime) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
