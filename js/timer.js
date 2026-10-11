// Motor do cronômetro. Não toca no DOM e recebe o relógio por injeção (testável).
//
// Diferença para a versão 1: em vez de subtrair 1 a cada setInterval (que atrasa e é pausado
// pelo celular com a tela bloqueada), guardamos o HORÁRIO em que a fase termina e calculamos
// o tempo restante a partir do relógio do sistema. Assim o valor fica certo mesmo se o
// navegador atrasar ou suspender os "ticks".

import { pad2 } from './util.js';

export function montarFasesSimples(totalSeg, rotulo = 'Tempo', tipo = 'trabalho') {
  if (!(totalSeg > 0)) return [];
  return [{ tipo, rotulo, duracaoMs: Math.round(totalSeg * 1000), round: 1, rounds: 1 }];
}

/** Trabalho → descanso, repetido por N rodadas (sem descanso depois da última). */
export function montarFasesIntervalo({ trabalho, descanso, rounds }) {
  const fases = [];
  if (!(trabalho > 0) || !(rounds > 0)) return fases;
  for (let r = 1; r <= rounds; r++) {
    fases.push({ tipo: 'trabalho', rotulo: 'Trabalho', duracaoMs: trabalho * 1000, round: r, rounds });
    if (descanso > 0 && r < rounds) {
      fases.push({ tipo: 'descanso', rotulo: 'Descanso', duracaoMs: descanso * 1000, round: r, rounds });
    }
  }
  return fases;
}

/** mm:ss arredondando para cima: mostra 00:01 até o tempo realmente acabar. */
export function formatarTempo(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export class Temporizador {
  constructor({ agora = () => Date.now() } = {}) {
    this.agora = agora;
    this.fases = [];
    this.indice = 0;
    this.status = 'ocioso'; // 'ocioso' | 'rodando' | 'pausado' | 'finalizado'
    this.fimFase = 0;
    this.restanteMs = 0;
    this.onFase = null; // (fase) => void — chamado quando entra numa nova fase
    this.onFim = null; // () => void
  }

  configurar(fases) {
    this.fases = fases;
    this.indice = 0;
    this.status = 'ocioso';
    this.restanteMs = fases[0]?.duracaoMs ?? 0;
  }

  iniciar() {
    if (!this.fases.length) return false;
    this.indice = 0;
    this.status = 'rodando';
    this.fimFase = this.agora() + this.fases[0].duracaoMs;
    this.restanteMs = this.fases[0].duracaoMs;
    return true;
  }

  /** Avança o estado com base no relógio. Seguro de chamar quantas vezes quiser. */
  tick() {
    if (this.status !== 'rodando') return;
    const agora = this.agora();
    let restante = this.fimFase - agora;
    let mudouDeFase = false;

    while (restante <= 0) {
      const proxima = this.indice + 1;
      if (proxima >= this.fases.length) {
        this.status = 'finalizado';
        this.restanteMs = 0;
        this.onFim?.();
        return;
      }
      this.indice = proxima;
      this.fimFase += this.fases[proxima].duracaoMs;
      restante = this.fimFase - agora;
      mudouDeFase = true;
    }

    this.restanteMs = restante;
    // Se o app ficou em segundo plano e várias fases passaram, avisa só da fase atual.
    if (mudouDeFase) this.onFase?.(this.fases[this.indice]);
  }

  pausar() {
    if (this.status !== 'rodando') return;
    this.tick();
    if (this.status !== 'rodando') return;
    this.restanteMs = Math.max(0, this.fimFase - this.agora());
    this.status = 'pausado';
  }

  retomar() {
    if (this.status !== 'pausado') return;
    this.fimFase = this.agora() + this.restanteMs;
    this.status = 'rodando';
  }

  zerar() {
    this.status = 'ocioso';
    this.indice = 0;
    this.restanteMs = this.fases[0]?.duracaoMs ?? 0;
  }

  snapshot() {
    const fase = this.fases[this.indice] ?? null;
    let restante = this.restanteMs;
    if (this.status === 'rodando') restante = Math.max(0, this.fimFase - this.agora());
    return {
      status: this.status,
      fase,
      restanteMs: restante,
      indice: this.indice,
      totalFases: this.fases.length,
      fracao: fase ? Math.min(1, restante / fase.duracaoMs) : 0,
    };
  }
}
