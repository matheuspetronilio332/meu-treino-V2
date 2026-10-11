import test from 'node:test';
import assert from 'node:assert/strict';
import { comVariacao, filtrarPeriodo, mediaMovel, registrarPeso, resumo } from '../js/peso.js';
import { ErroValidacao } from '../js/util.js';

const HOJE = '2025-10-24';

test('registrarPeso valida e mantém um registro por dia', () => {
  let r = registrarPeso([], { data: '2025-10-20', peso: '72,46' }, HOJE);
  assert.deepEqual(r.pesos, [{ data: '2025-10-20', peso: 72.5 }]);
  assert.equal(r.substituiu, false);
  r = registrarPeso(r.pesos, { data: '2025-10-20', peso: 71 }, HOJE);
  assert.equal(r.pesos.length, 1);
  assert.equal(r.substituiu, true);
  assert.equal(r.anterior, 72.5);
  r = registrarPeso(r.pesos, { data: '2025-10-10', peso: 74 }, HOJE);
  assert.deepEqual(r.pesos.map((p) => p.data), ['2025-10-10', '2025-10-20']);
});

test('registrarPeso rejeita valores absurdos, datas inválidas e futuras', () => {
  for (const peso of [0, -3, 5, 500, '', 'abc', null]) {
    assert.throws(() => registrarPeso([], { data: HOJE, peso }, HOJE), ErroValidacao);
  }
  assert.throws(() => registrarPeso([], { data: '2025-10-25', peso: 70 }, HOJE), /futuro/);
  assert.throws(() => registrarPeso([], { data: '2025-02-30', peso: 70 }, HOJE), ErroValidacao);
});

test('média móvel usa janela de dias corridos', () => {
  const p = [
    { data: '2025-10-01', peso: 80 },
    { data: '2025-10-05', peso: 78 },
    { data: '2025-10-07', peso: 76 },
    { data: '2025-10-20', peso: 70 },
  ];
  const m = mediaMovel(p, 7).map((x) => x.valor);
  assert.deepEqual(m, [80, 79, 78, 70]); // o dia 20 não enxerga os de 1 a 7
});

test('resumo calcula variações, extremos e distância da meta', () => {
  const p = [
    { data: '2025-10-01', peso: 80 },
    { data: '2025-10-10', peso: 78.5 },
    { data: '2025-10-20', peso: 77.2 },
  ];
  const r = resumo(p, 75);
  assert.equal(r.atual.peso, 77.2);
  assert.equal(r.variacaoUltimo, -1.3);
  assert.equal(r.variacaoTotal, -2.8);
  assert.equal(r.minimo, 77.2);
  assert.equal(r.maximo, 80);
  assert.equal(r.faltaMeta, 2.2);
  assert.equal(resumo([], 75), null);
  assert.equal(resumo([p[0]]).variacaoUltimo, null);
});

test('filtrarPeriodo e comVariacao', () => {
  const p = [
    { data: '2025-08-01', peso: 82 },
    { data: '2025-10-10', peso: 80 },
    { data: '2025-10-24', peso: 79 },
  ];
  assert.equal(filtrarPeriodo(p, 30, HOJE).length, 2);
  assert.equal(filtrarPeriodo(p, null, HOJE).length, 3);
  assert.deepEqual(comVariacao(p).map((x) => x.delta), [null, -2, -1]);
});
