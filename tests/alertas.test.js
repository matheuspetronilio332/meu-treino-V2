import test from 'node:test';
import assert from 'node:assert/strict';
import { agendarSom } from '../js/alertas.js';

// Contexto de áudio falso: só conta o que seria criado e verifica que nada é agendado no passado.
function contextoFalso() {
  const c = { osciladores: 0, ruidos: 0, inicios: [], sampleRate: 22050, currentTime: 0 };
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 });
  const no = () => { const n = { connect: (x) => x ?? n }; return n; };
  c.createOscillator = () => { c.osciladores++; return { ...no(), frequency: param(), start: (t) => c.inicios.push(t), stop() {}, type: '' }; };
  c.createGain = () => ({ ...no(), gain: param() });
  c.createBiquadFilter = () => ({ ...no(), frequency: param(), Q: param(), type: '' });
  c.createBuffer = (_, n) => ({ getChannelData: () => new Float32Array(n) });
  c.createBufferSource = () => { c.ruidos++; return { ...no(), start: (t) => c.inicios.push(t), buffer: null }; };
  return c;
}

test('gongo: uma batida (9 parciais + estalo) e duração longa', () => {
  const c = contextoFalso();
  const dur = agendarSom(c, {}, 'gongo', 'fim', 0);
  assert.equal(c.osciladores, 9);
  assert.equal(c.ruidos, 1);
  assert.ok(dur >= 4);
  assert.ok(agendarSom(contextoFalso(), {}, 'gongo', 'fase', 0) < dur);
});

test('sino de boxe: 3 batidas no fim do round, 1 na troca de fase', () => {
  const fim = contextoFalso();
  agendarSom(fim, {}, 'sino', 'fim', 0);
  assert.equal(fim.ruidos, 3);
  assert.equal(fim.osciladores, 27);
  const fase = contextoFalso();
  agendarSom(fase, {}, 'sino', 'fase', 0);
  assert.equal(fase.ruidos, 1);
});

test('bipe: padrão curto da versão anterior (2 bipes na fase, 3 no fim)', () => {
  const fase = contextoFalso(); agendarSom(fase, {}, 'bipe', 'fase', 0);
  const fim = contextoFalso(); agendarSom(fim, {}, 'bipe', 'fim', 0);
  assert.equal(fase.osciladores, 2);
  assert.equal(fim.osciladores, 3);
});

test('nada é agendado antes do instante pedido', () => {
  const c = contextoFalso();
  agendarSom(c, {}, 'sino', 'fim', 5);
  assert.ok(c.inicios.every((t) => t >= 5));
});
