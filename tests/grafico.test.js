import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularGrafico } from '../js/grafico.js';

test('gráfico: pontos dentro da área, eixos coerentes e meta incluída na escala', () => {
  const pesos = [
    { data: '2025-10-01', peso: 80 },
    { data: '2025-10-15', peso: 78 },
    { data: '2025-10-30', peso: 77 },
  ];
  const g = calcularGrafico(pesos, { meta: 70, media: [{ data: '2025-10-30', valor: 77.5 }] });
  assert.equal(g.pontos.length, 3);
  for (const p of g.pontos) {
    assert.ok(p.x >= g.margem.esq && p.x <= g.largura - g.margem.dir);
    assert.ok(p.y >= g.margem.topo && p.y <= g.altura - g.margem.base);
  }
  assert.ok(g.pontos[0].x < g.pontos[2].x);
  assert.ok(g.pontos[0].y < g.pontos[2].y); // 80 kg fica mais alto (y menor) que 77 kg
  assert.ok(g.yMeta > g.pontos[2].y); // meta 70 está abaixo de 77
  assert.equal(g.rotuloInicio, '01/10');
  assert.equal(g.rotuloFim, '30/10');
  assert.ok(g.linha.startsWith('M'));
});

test('gráfico não quebra com 2 pontos no mesmo valor nem no mesmo dia', () => {
  const g = calcularGrafico([{ data: '2025-10-01', peso: 70 }, { data: '2025-10-02', peso: 70 }]);
  assert.ok(Number.isFinite(g.pontos[0].y));
  const h = calcularGrafico([{ data: '2025-10-01', peso: 70 }]);
  assert.ok(Number.isFinite(h.pontos[0].x));
});
