// Regras de treino (sem DOM): validação de rotinas, sessão em andamento, histórico e recordes.

import { ErroValidacao, hojeISO, normalizarNome, novoId } from './util.js';
import { LIMITES, inteiro, numero, texto } from './modelo.js';

export function validarRotina({ nome, exercicios }) {
  const nomeRotina = texto(nome, LIMITES.nome);
  if (!nomeRotina) throw new ErroValidacao('Dê um nome para a rotina.');
  if (!Array.isArray(exercicios) || exercicios.length === 0) {
    throw new ErroValidacao('Adicione ao menos um exercício.');
  }
  if (exercicios.length > LIMITES.exerciciosPorRotina) {
    throw new ErroValidacao(`Use no máximo ${LIMITES.exerciciosPorRotina} exercícios por rotina.`);
  }
  const lista = exercicios.map((e, i) => {
    const nomeEx = texto(e.nome, LIMITES.nome);
    if (!nomeEx) throw new ErroValidacao(`Exercício ${i + 1}: informe o nome.`);
    const series = inteiro(e.series, 1, 20);
    if (series === null) throw new ErroValidacao(`${nomeEx}: use de 1 a 20 séries.`);
    const reps = inteiro(e.reps, 1, 100);
    if (reps === null) throw new ErroValidacao(`${nomeEx}: use de 1 a 100 repetições.`);
    const semCarga = e.carga === '' || e.carga == null;
    const carga = semCarga ? 0 : numero(e.carga, 0, 1000, 2);
    if (carga === null) throw new ErroValidacao(`${nomeEx}: a carga deve ficar entre 0 e 1000 kg.`);
    return { id: e.id || novoId(), nome: nomeEx, series, reps, carga };
  });
  return { nome: nomeRotina, exercicios: lista };
}

export function criarSessao(rotina, agora = new Date()) {
  return {
    id: novoId(),
    rotinaId: rotina.id,
    rotinaNome: rotina.nome,
    iniciadoEm: agora.toISOString(),
    itens: rotina.exercicios.map((e) => ({
      id: e.id,
      nome: e.nome,
      series: e.series,
      reps: e.reps,
      carga: e.carga,
      feitas: Array(e.series).fill(false),
    })),
    notas: '',
  };
}

/** Marca/desmarca uma série. Retorna o novo valor (true = concluída) ou null se o índice for inválido. */
export function alternarSerie(sessao, indiceItem, indiceSerie) {
  const item = sessao.itens[indiceItem];
  if (!item || indiceSerie < 0 || indiceSerie >= item.feitas.length) return null;
  item.feitas[indiceSerie] = !item.feitas[indiceSerie];
  return item.feitas[indiceSerie];
}

export function ajustarItem(sessao, indiceItem, { carga, reps } = {}) {
  const item = sessao.itens[indiceItem];
  if (!item) return;
  if (carga !== undefined) {
    const c = numero(carga, 0, 1000, 2);
    if (c !== null) item.carga = c;
  }
  if (reps !== undefined) {
    const r = inteiro(reps, 1, 100);
    if (r !== null) item.reps = r;
  }
}

export function progressoSessao(sessao) {
  let total = 0;
  let feitas = 0;
  for (const it of sessao.itens) {
    total += it.feitas.length;
    feitas += it.feitas.filter(Boolean).length;
  }
  return { total, feitas, completa: total > 0 && feitas === total };
}

/** Maior carga já usada por exercício (considera só séries realmente feitas e carga > 0). */
export function recordesPorExercicio(historico) {
  const mapa = new Map();
  for (const sessao of historico) {
    for (const it of sessao.itens) {
      if (!(it.feitas > 0) || !(it.carga > 0)) continue;
      const chave = normalizarNome(it.nome);
      const atual = mapa.get(chave);
      if (!atual || it.carga > atual.carga) {
        mapa.set(chave, { nome: it.nome, carga: it.carga, reps: it.reps, data: sessao.data });
      }
    }
  }
  return mapa;
}

/**
 * Converte a sessão em registro de histórico e detecta recordes.
 * Um recorde só existe quando há um recorde anterior para superar (a 1ª vez é a linha de base).
 */
export function finalizarSessao(sessao, historico, agora = new Date()) {
  const itens = sessao.itens
    .map((it) => ({
      nome: it.nome,
      series: it.series,
      reps: it.reps,
      carga: it.carga,
      feitas: it.feitas.filter(Boolean).length,
    }))
    .filter((it) => it.feitas > 0);
  if (itens.length === 0) throw new ErroValidacao('Marque ao menos uma série concluída antes de finalizar.');

  const anteriores = recordesPorExercicio(historico);
  const recordes = [];
  for (const it of itens) {
    const anterior = anteriores.get(normalizarNome(it.nome));
    if (anterior && it.carga > anterior.carga) {
      recordes.push({ nome: it.nome, carga: it.carga, anterior: anterior.carga });
    }
  }

  const inicio = Date.parse(sessao.iniciadoEm);
  const duracaoMin = Number.isFinite(inicio)
    ? Math.min(1440, Math.max(0, Math.round((agora.getTime() - inicio) / 60000)))
    : null;

  return {
    registro: {
      id: sessao.id || novoId(),
      data: hojeISO(agora),
      iniciadoEm: sessao.iniciadoEm,
      duracaoMin,
      rotinaNome: sessao.rotinaNome,
      itens,
      notas: sessao.notas || '',
    },
    recordes,
  };
}
