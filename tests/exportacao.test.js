import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarCSVPesos, gerarCSVTreinos, gerarJSON, lerImportacao } from '../js/exportacao.js';
import { estadoPadrao, sanitizar } from '../js/modelo.js';
import { ErroValidacao } from '../js/util.js';

test('CSV de pesos usa ; e vírgula decimal, com BOM', () => {
  const csv = gerarCSVPesos([{ data: '2025-10-01', peso: 72.4 }]);
  assert.ok(csv.startsWith('\uFEFFdata;peso_kg'));
  assert.ok(csv.includes('2025-10-01;72,4'));
});

test('CSV de treinos escapa aspas e neutraliza fórmulas', () => {
  const csv = gerarCSVTreinos([
    { data: '2025-10-01', rotinaNome: 'A;B', itens: [{ nome: '=SOMA(1;1)', series: 3, reps: 10, carga: 22.5, feitas: 3 }, { nome: 'Rosca "x"', series: 1, reps: 1, carga: 0, feitas: 1 }] },
  ]);
  assert.ok(csv.includes('"A;B"'));
  assert.ok(csv.includes("\"'=SOMA(1;1)\""));
  assert.ok(csv.includes('"Rosca ""x"""'));
  assert.ok(csv.includes(';22,5'));
});

test('exportar e importar de volta preserva os dados', () => {
  const e = estadoPadrao();
  e.pesos = [{ data: '2025-10-01', peso: 70 }];
  e.rotinas = [{ id: 'r1', nome: 'A', exercicios: [{ id: 'e1', nome: 'S', series: 3, reps: 10, carga: 20 }] }];
  const volta = lerImportacao(gerarJSON(e));
  assert.deepEqual(volta.pesos, e.pesos);
  assert.deepEqual(volta.rotinas, e.rotinas);
});

test('importação rejeita arquivos inválidos, vazios ou enormes', () => {
  assert.throws(() => lerImportacao('isso não é json'), ErroValidacao);
  assert.throws(() => lerImportacao('[1,2,3]'), ErroValidacao);
  assert.throws(() => lerImportacao('{"dados":{"pesos":[]}}'), /Nenhum dado/);
  assert.throws(() => lerImportacao('x'.repeat(6 * 1024 * 1024)), /grande/);
});

test('importação é resistente a conteúdo malicioso', () => {
  const sujo = JSON.stringify({
    dados: {
      pesos: [{ data: '2025-10-01', peso: 70, __proto__: { x: 1 } }],
      rotinas: [{ nome: '<img src=x onerror=alert(1)>', exercicios: [{ nome: '<script>', series: 1, reps: 1 }] }],
      config: { __proto__: { admin: true }, tema: 'claro' },
    },
  });
  const e = lerImportacao(sujo);
  assert.equal(e.config.admin, undefined);
  assert.equal({}.admin, undefined);
  // o texto é mantido como TEXTO (a interface usa textContent, então não vira HTML)
  assert.equal(e.rotinas[0].nome, '<img src=x onerror=alert(1)>');
});

test('sanitizar(JSON antigo da v1) via migração de datas é coberto no teste de store', () => {
  assert.equal(sanitizar({ pesos: [{ data: '2025-10-01', peso: 70 }] }).pesos.length, 1);
});
