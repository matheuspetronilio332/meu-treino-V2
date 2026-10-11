// Persistência no localStorage, com tolerância a falhas:
// dados corrompidos viram backup (não derrubam o app) e erros de gravação são reportados.

import { estadoPadrao, sanitizar } from './modelo.js';
import { converterDataBR } from './util.js';

const CHAVE = 'treino:v2';
const CHAVE_CORROMPIDO = 'treino:v2:corrompido';
const CHAVE_LEGADA = 'pesoCorporal'; // versão 1 do app

let estado = estadoPadrao();
let gravacaoOk = true;

function migrarLegado() {
  try {
    const bruto = localStorage.getItem(CHAVE_LEGADA);
    if (!bruto) return null;
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return null;
    const pesos = lista.map((i) => ({ data: converterDataBR(i?.data) ?? i?.data, peso: i?.peso }));
    const migrado = estadoPadrao();
    migrado.pesos = sanitizar({ pesos }).pesos;
    return migrado.pesos.length ? migrado : null;
  } catch {
    return null;
  }
}

/** Carrega os dados. Retorna { origem: 'novo' | 'v2' | 'migrado' | 'corrompido', pesos? }. */
export function carregar() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {
    gravacaoOk = false; // localStorage bloqueado (ex.: modo restrito): o app roda só em memória
  }

  if (bruto) {
    try {
      estado = sanitizar(JSON.parse(bruto));
      return { origem: 'v2' };
    } catch {
      try {
        localStorage.setItem(CHAVE_CORROMPIDO, bruto);
      } catch {
        /* sem espaço: segue sem backup */
      }
      estado = estadoPadrao();
      return { origem: 'corrompido' };
    }
  }

  const migrado = migrarLegado();
  if (migrado) {
    estado = migrado;
    salvar();
    return { origem: 'migrado', pesos: migrado.pesos.length };
  }
  return { origem: 'novo' };
}

export const obter = () => estado;
export const gravacaoFunciona = () => gravacaoOk;

export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    gravacaoOk = true;
    return true;
  } catch {
    gravacaoOk = false;
    return false;
  }
}

export function substituir(novoEstado) {
  estado = novoEstado;
  return salvar();
}

export function apagarTudo() {
  estado = estadoPadrao();
  try {
    localStorage.removeItem(CHAVE);
    localStorage.removeItem(CHAVE_CORROMPIDO);
    localStorage.removeItem(CHAVE_LEGADA);
  } catch {
    /* ignora */
  }
}
