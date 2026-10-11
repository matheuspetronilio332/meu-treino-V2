// Regras do controle de peso (sem DOM): validação, resumo, média móvel.

import { ErroValidacao, dataValida, hojeISO, numeroDoDia } from './util.js';
import { PESO_MAX, PESO_MIN, numero } from './modelo.js';

export const arred1 = (n) => Math.round(n * 10) / 10;

/**
 * Registra um peso. Só existe um registro por dia: registrar de novo no mesmo dia atualiza o valor.
 * Retorna { pesos (ordem crescente de data), substituiu, anterior }.
 */
export function registrarPeso(pesos, { data, peso }, hoje = hojeISO()) {
  if (!dataValida(data)) throw new ErroValidacao('Informe uma data válida.');
  if (data > hoje) throw new ErroValidacao('A data não pode ser no futuro.');
  const valor = numero(peso, PESO_MIN, PESO_MAX, 1);
  if (valor === null) throw new ErroValidacao(`Informe um peso entre ${PESO_MIN} e ${PESO_MAX} kg.`);

  const existente = pesos.find((p) => p.data === data);
  const lista = pesos.filter((p) => p.data !== data);
  lista.push({ data, peso: valor });
  lista.sort((a, b) => a.data.localeCompare(b.data));
  return { pesos: lista, substituiu: Boolean(existente), anterior: existente?.peso ?? null };
}

/** Média dos registros dos últimos `dias` dias (janela móvel, contada em dias corridos). */
export function mediaMovel(pesosAsc, dias = 7) {
  return pesosAsc.map((p, i) => {
    const fim = numeroDoDia(p.data);
    const inicio = fim - (dias - 1);
    let soma = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (numeroDoDia(pesosAsc[j].data) < inicio) break;
      soma += pesosAsc[j].peso;
      n++;
    }
    return { data: p.data, valor: arred1(soma / n) };
  });
}

export function filtrarPeriodo(pesosAsc, dias, hoje = hojeISO()) {
  if (!dias) return pesosAsc;
  const limite = numeroDoDia(hoje) - (dias - 1);
  return pesosAsc.filter((p) => numeroDoDia(p.data) >= limite);
}

export function resumo(pesosAsc, meta = null) {
  if (!pesosAsc.length) return null;
  const atual = pesosAsc.at(-1);
  const anterior = pesosAsc.length > 1 ? pesosAsc.at(-2) : null;
  const primeiro = pesosAsc[0];
  const pesos = pesosAsc.map((p) => p.peso);
  return {
    atual,
    variacaoUltimo: anterior ? arred1(atual.peso - anterior.peso) : null,
    variacaoTotal: pesosAsc.length > 1 ? arred1(atual.peso - primeiro.peso) : null,
    primeiro,
    media7: mediaMovel(pesosAsc, 7).at(-1).valor,
    minimo: Math.min(...pesos),
    maximo: Math.max(...pesos),
    /** Diferença até a meta (positivo = ainda acima da meta). null se não há meta. */
    faltaMeta: meta == null ? null : arred1(atual.peso - meta),
  };
}

/** Variação de cada registro em relação ao anterior (para a lista do histórico). */
export function comVariacao(pesosAsc) {
  return pesosAsc.map((p, i) => ({ ...p, delta: i > 0 ? arred1(p.peso - pesosAsc[i - 1].peso) : null }));
}
