// Modelo de dados do app: valores padrão, validação/sanitização e mesclagem.
// Tudo que vem do localStorage ou de um arquivo importado passa por aqui antes de ser usado.

import { dataValida, novoId } from './util.js';

export const VERSAO_DADOS = 2;
export const PESO_MIN = 20;
export const PESO_MAX = 400;
export const TIPOS_MEDIDA = ['Cintura', 'Peito', 'Ombros', 'Braço', 'Coxa', 'Panturrilha', 'Quadril'];
export const LIMITES = {
  pesos: 5000,
  medidas: 2000,
  rotinas: 50,
  exerciciosPorRotina: 30,
  historico: 1000,
  nome: 40,
  notas: 500,
};

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const booleano = (v, padrao) => (typeof v === 'boolean' ? v : padrao);

export function numero(v, min, max, casas = null) {
  let n;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '') n = Number(v.trim().replace(',', '.'));
  else return null;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return casas === null ? n : Math.round(n * 10 ** casas) / 10 ** casas;
}

export function inteiro(v, min, max) {
  const n = numero(v, min, max);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** Remove caracteres de controle, normaliza espaços e limita o tamanho. Retorna null se ficar vazio. */
export function texto(v, max, multilinha = false) {
  if (typeof v !== 'string') return null;
  let t = multilinha
    ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\r\n?/g, '\n')
    : v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ');
  t = t.trim().slice(0, max);
  return t || null;
}

const idOuNovo = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : novoId());
const copiar = (x) => JSON.parse(JSON.stringify(x));

export function configPadrao() {
  return {
    tema: 'auto',
    som: true,
    vibracao: true,
    notificacao: false,
    telaAcesa: true,
    descansoPadrao: 90,
    descansoAuto: true,
    metaPeso: null,
    timer: { modo: 'simples', min: 1, seg: 0, trabalho: 30, descanso: 15, rounds: 8 },
  };
}

export function estadoPadrao() {
  return {
    versao: VERSAO_DADOS,
    pesos: [],
    medidas: [],
    rotinas: [],
    historico: [],
    sessaoAtiva: null,
    config: configPadrao(),
  };
}

export function sanitizarConfig(c) {
  const p = configPadrao();
  if (!ehObjeto(c)) return p;
  const t = ehObjeto(c.timer) ? c.timer : {};
  return {
    tema: ['auto', 'claro', 'escuro'].includes(c.tema) ? c.tema : p.tema,
    som: booleano(c.som, p.som),
    vibracao: booleano(c.vibracao, p.vibracao),
    notificacao: booleano(c.notificacao, p.notificacao),
    telaAcesa: booleano(c.telaAcesa, p.telaAcesa),
    descansoAuto: booleano(c.descansoAuto, p.descansoAuto),
    descansoPadrao: inteiro(c.descansoPadrao, 5, 900) ?? p.descansoPadrao,
    metaPeso: numero(c.metaPeso, PESO_MIN, PESO_MAX, 1),
    timer: {
      modo: ['simples', 'intervalado'].includes(t.modo) ? t.modo : p.timer.modo,
      min: inteiro(t.min, 0, 999) ?? p.timer.min,
      seg: inteiro(t.seg, 0, 59) ?? p.timer.seg,
      trabalho: inteiro(t.trabalho, 1, 3600) ?? p.timer.trabalho,
      descanso: inteiro(t.descanso, 0, 3600) ?? p.timer.descanso,
      rounds: inteiro(t.rounds, 1, 99) ?? p.timer.rounds,
    },
  };
}

export function sanitizarPesos(lista) {
  if (!Array.isArray(lista)) return [];
  const porData = new Map();
  for (const it of lista.slice(0, LIMITES.pesos * 2)) {
    if (!ehObjeto(it) || !dataValida(it.data)) continue;
    const peso = numero(it.peso, PESO_MIN, PESO_MAX, 1);
    if (peso === null) continue;
    porData.set(it.data, { data: it.data, peso }); // a última entrada do dia prevalece
  }
  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(-LIMITES.pesos);
}

export function sanitizarMedidas(lista) {
  if (!Array.isArray(lista)) return [];
  const ids = new Set();
  const saida = [];
  for (const it of lista.slice(0, LIMITES.medidas * 2)) {
    if (!ehObjeto(it) || !dataValida(it.data) || !TIPOS_MEDIDA.includes(it.tipo)) continue;
    const valor = numero(it.valor, 1, 300, 1);
    if (valor === null) continue;
    const id = idOuNovo(it.id);
    if (ids.has(id)) continue;
    ids.add(id);
    saida.push({ id, data: it.data, tipo: it.tipo, valor });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data)).slice(-LIMITES.medidas);
}

function sanitizarExercicio(e) {
  if (!ehObjeto(e)) return null;
  const nome = texto(e.nome, LIMITES.nome);
  const series = inteiro(e.series, 1, 20);
  const reps = inteiro(e.reps, 1, 100);
  if (!nome || series === null || reps === null) return null;
  return { id: idOuNovo(e.id), nome, series, reps, carga: numero(e.carga, 0, 1000, 2) ?? 0 };
}

export function sanitizarRotinas(lista) {
  if (!Array.isArray(lista)) return [];
  const ids = new Set();
  const saida = [];
  for (const r of lista.slice(0, LIMITES.rotinas * 2)) {
    if (!ehObjeto(r) || !Array.isArray(r.exercicios)) continue;
    const nome = texto(r.nome, LIMITES.nome);
    const exercicios = r.exercicios
      .slice(0, LIMITES.exerciciosPorRotina)
      .map(sanitizarExercicio)
      .filter(Boolean);
    if (!nome || exercicios.length === 0) continue;
    const id = idOuNovo(r.id);
    if (ids.has(id)) continue;
    ids.add(id);
    saida.push({ id, nome, exercicios });
    if (saida.length >= LIMITES.rotinas) break;
  }
  return saida;
}

function sanitizarItemHistorico(it) {
  if (!ehObjeto(it)) return null;
  const nome = texto(it.nome, LIMITES.nome);
  const series = inteiro(it.series, 1, 20);
  if (!nome || series === null) return null;
  return {
    nome,
    series,
    reps: inteiro(it.reps, 1, 100) ?? 1,
    carga: numero(it.carga, 0, 1000, 2) ?? 0,
    feitas: inteiro(it.feitas, 0, series) ?? 0,
  };
}

const dataHoraValida = (s) => typeof s === 'string' && s.length <= 40 && Number.isFinite(Date.parse(s));

export function sanitizarHistorico(lista) {
  if (!Array.isArray(lista)) return [];
  const ids = new Set();
  const saida = [];
  for (const s of lista.slice(0, LIMITES.historico * 2)) {
    if (!ehObjeto(s) || !dataValida(s.data) || !Array.isArray(s.itens)) continue;
    const itens = s.itens.slice(0, LIMITES.exerciciosPorRotina).map(sanitizarItemHistorico).filter(Boolean);
    if (itens.length === 0) continue;
    const id = idOuNovo(s.id);
    if (ids.has(id)) continue;
    ids.add(id);
    saida.push({
      id,
      data: s.data,
      iniciadoEm: dataHoraValida(s.iniciadoEm) ? s.iniciadoEm : null,
      duracaoMin: inteiro(s.duracaoMin, 0, 1440),
      rotinaNome: texto(s.rotinaNome, LIMITES.nome) ?? 'Treino',
      itens,
      notas: texto(s.notas, LIMITES.notas, true) ?? '',
    });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data)).slice(-LIMITES.historico);
}

export function sanitizarSessao(s) {
  if (!ehObjeto(s) || !Array.isArray(s.itens)) return null;
  const itens = s.itens
    .slice(0, LIMITES.exerciciosPorRotina)
    .map((it) => {
      const e = sanitizarExercicio(it);
      if (!e) return null;
      const feitas = Array.isArray(it.feitas) ? it.feitas.slice(0, e.series).map(Boolean) : [];
      while (feitas.length < e.series) feitas.push(false);
      return { ...e, feitas };
    })
    .filter(Boolean);
  if (itens.length === 0) return null;
  return {
    id: idOuNovo(s.id),
    rotinaId: typeof s.rotinaId === 'string' ? s.rotinaId.slice(0, 64) : null,
    rotinaNome: texto(s.rotinaNome, LIMITES.nome) ?? 'Treino',
    iniciadoEm: dataHoraValida(s.iniciadoEm) ? s.iniciadoEm : new Date().toISOString(),
    itens,
    notas: texto(s.notas, LIMITES.notas, true) ?? '',
  };
}

/** Recebe QUALQUER coisa (JSON do localStorage, arquivo importado) e devolve um estado válido. */
export function sanitizar(obj) {
  const o = ehObjeto(obj) ? obj : {};
  return {
    versao: VERSAO_DADOS,
    pesos: sanitizarPesos(o.pesos),
    medidas: sanitizarMedidas(o.medidas),
    rotinas: sanitizarRotinas(o.rotinas),
    historico: sanitizarHistorico(o.historico),
    sessaoAtiva: sanitizarSessao(o.sessaoAtiva),
    config: sanitizarConfig(o.config),
  };
}

/**
 * Mescla dados importados no estado atual sem apagar nada:
 * pesos por data (o importado prevalece), o resto por id (só adiciona o que não existe).
 * Configurações e treino em andamento do aparelho são preservados.
 */
export function mesclar(atual, importado) {
  const base = copiar(atual);
  const resumo = { pesos: 0, medidas: 0, rotinas: 0, treinos: 0 };

  const porData = new Map(base.pesos.map((p) => [p.data, p]));
  for (const p of importado.pesos) {
    const existente = porData.get(p.data);
    if (!existente || existente.peso !== p.peso) {
      porData.set(p.data, { ...p });
      resumo.pesos++;
    }
  }
  base.pesos = [...porData.values()];

  const adicionarPorId = (campo, chave) => {
    const ids = new Set(base[campo].map((i) => i.id));
    for (const item of importado[campo]) {
      if (ids.has(item.id)) continue;
      base[campo].push(copiar(item));
      ids.add(item.id);
      resumo[chave]++;
    }
  };
  adicionarPorId('medidas', 'medidas');
  adicionarPorId('rotinas', 'rotinas');
  adicionarPorId('historico', 'treinos');

  return { estado: sanitizar(base), resumo };
}
