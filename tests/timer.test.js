import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporizador, formatarTempo, montarFasesIntervalo, montarFasesSimples } from '../js/timer.js';

function criar() {
  let agora = 1_000_000;
  const t = new Temporizador({ agora: () => agora });
  return { t, avancar: (ms) => { agora += ms; }, eventos: { fases: [], fim: 0 } };
}

test('formatarTempo arredonda para cima e nunca fica negativo', () => {
  assert.equal(formatarTempo(60000), '01:00');
  assert.equal(formatarTempo(59001), '01:00');
  assert.equal(formatarTempo(1), '00:01');
  assert.equal(formatarTempo(0), '00:00');
  assert.equal(formatarTempo(-500), '00:00');
  assert.equal(formatarTempo(125 * 60 * 1000), '125:00');
});

test('fases: simples ignora tempo zero; intervalo não termina com descanso', () => {
  assert.deepEqual(montarFasesSimples(0), []);
  const f = montarFasesIntervalo({ trabalho: 30, descanso: 10, rounds: 3 });
  assert.deepEqual(f.map((x) => x.tipo), ['trabalho', 'descanso', 'trabalho', 'descanso', 'trabalho']);
  assert.equal(montarFasesIntervalo({ trabalho: 30, descanso: 0, rounds: 3 }).length, 3);
});

test('o tempo restante vem do relógio, não de contagem de ticks (sem drift)', () => {
  const { t, avancar } = criar();
  t.configurar(montarFasesSimples(60));
  t.iniciar();
  avancar(37_000); // o navegador "dormiu" 37 s sem nenhum tick
  assert.equal(t.snapshot().restanteMs, 23_000);
  t.tick();
  assert.equal(t.status, 'rodando');
});

test('termina uma única vez e chama onFim', () => {
  const { t, avancar } = criar();
  let fim = 0;
  t.onFim = () => fim++;
  t.configurar(montarFasesSimples(10));
  t.iniciar();
  avancar(9_999);
  t.tick();
  assert.equal(t.status, 'rodando');
  avancar(5_000);
  t.tick();
  t.tick();
  assert.equal(t.status, 'finalizado');
  assert.equal(fim, 1);
  assert.equal(t.snapshot().restanteMs, 0);
});

test('pausar congela e retomar continua de onde parou', () => {
  const { t, avancar } = criar();
  t.configurar(montarFasesSimples(60));
  t.iniciar();
  avancar(20_000);
  t.pausar();
  avancar(500_000);
  assert.equal(t.snapshot().restanteMs, 40_000);
  t.retomar();
  avancar(10_000);
  assert.equal(t.snapshot().restanteMs, 30_000);
});

test('intervalado alterna fases e avisa só da fase atual após longa suspensão', () => {
  const { t, avancar } = criar();
  const avisos = [];
  t.onFase = (f) => avisos.push(`${f.tipo}${f.round}`);
  t.configurar(montarFasesIntervalo({ trabalho: 10, descanso: 5, rounds: 3 }));
  t.iniciar();
  avancar(10_500);
  t.tick();
  assert.deepEqual(avisos, ['descanso1']);
  assert.equal(Math.round(t.snapshot().restanteMs), 4_500);
  // Linha do tempo: T1 0-10, D1 10-15, T2 15-25, D2 25-30, T3 30-40. Agora estamos em 10,5 s.
  avancar(20_000); // vai para 30,5 s sem nenhum tick: passou por T2 e D2 e caiu no 3º trabalho
  t.tick();
  assert.deepEqual(avisos, ['descanso1', 'trabalho3']); // um único aviso, da fase atual
  assert.equal(t.snapshot().fase.round, 3);
  assert.equal(Math.round(t.snapshot().restanteMs), 9_500);
});

test('iniciar sem fases (tempo zero) é recusado', () => {
  const { t } = criar();
  t.configurar([]);
  assert.equal(t.iniciar(), false);
});

test('zerar volta ao ocioso com a duração inicial', () => {
  const { t, avancar } = criar();
  t.configurar(montarFasesSimples(45));
  t.iniciar();
  avancar(5000);
  t.zerar();
  assert.equal(t.status, 'ocioso');
  assert.equal(t.snapshot().restanteMs, 45_000);
});
