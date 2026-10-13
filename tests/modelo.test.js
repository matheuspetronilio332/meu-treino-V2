import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoPadrao, mesclar, sanitizar } from '../js/modelo.js';
import { converterDataBR, dataValida, normalizarNome } from '../js/util.js';

test('datas: validação e conversão do formato antigo', () => {
  assert.equal(dataValida('2025-02-29'), false);
  assert.equal(dataValida('2024-02-29'), true);
  assert.equal(dataValida('2025-13-01'), false);
  assert.equal(dataValida('25-01-01'), false);
  assert.equal(converterDataBR('24/10/2025'), '2025-10-24');
  assert.equal(converterDataBR('1/2/2025'), '2025-02-01');
  assert.equal(converterDataBR('31/02/2025'), null);
  assert.equal(converterDataBR('lixo'), null);
});

test('normalizarNome ignora acento, caixa e espaços', () => {
  assert.equal(normalizarNome('  Supino   RÉTO '), 'supino reto');
});

test('sanitizar descarta lixo e mantém o que é válido', () => {
  const e = sanitizar({
    pesos: [
      { data: '2025-10-01', peso: 80.04 },
      { data: '2025-10-01', peso: '79,5' }, // mesmo dia: o último prevalece
      { data: '2025-10-02', peso: -5 },
      { data: '2025-10-03', peso: 5000 },
      { data: 'ontem', peso: 70 },
      null,
      'texto',
      { data: '2025-09-30', peso: 81 },
    ],
    rotinas: [
      { nome: '  Treino   A ', exercicios: [{ nome: 'Supino', series: 4, reps: 10, carga: '20,5' }, { nome: '', series: 1, reps: 1 }] },
      { nome: 'Vazia', exercicios: [] },
      { nome: 'X', exercicios: [{ nome: 'Y', series: 99, reps: 1 }] },
    ],
    config: { tema: 'rosa', descansoPadrao: 99999, timer: { seg: 75, rounds: 0 }, som: 'sim' },
  });
  assert.deepEqual(e.pesos, [{ data: '2025-09-30', peso: 81 }, { data: '2025-10-01', peso: 79.5 }]);
  assert.equal(e.rotinas.length, 1);
  assert.equal(e.rotinas[0].nome, 'Treino A');
  assert.equal(e.rotinas[0].exercicios.length, 1);
  assert.equal(e.rotinas[0].exercicios[0].carga, 20.5);
  assert.equal(e.config.tema, 'auto');
  assert.equal(e.config.descansoPadrao, 90);
  assert.equal(e.config.timer.seg, 0);
  assert.equal(e.config.timer.rounds, 8);
  assert.equal(e.config.som, true);
});

test('sanitizar aceita qualquer entrada sem lançar erro', () => {
  for (const x of [undefined, null, 1, 'a', [], {}, { pesos: 'x', rotinas: {}, historico: 5, config: [] }]) {
    const e = sanitizar(x);
    assert.deepEqual(e.pesos, []);
    assert.equal(e.versao, 2);
  }
});

test('sanitizar remove caracteres de controle e limita tamanhos', () => {
  const e = sanitizar({ rotinas: [{ nome: 'A\u0000B\n' + 'x'.repeat(100), exercicios: [{ nome: 'E', series: 1, reps: 1 }] }] });
  assert.ok(!/[\u0000-\u001f]/.test(e.rotinas[0].nome));
  assert.ok(e.rotinas[0].nome.length <= 40);
});

test('sessão ativa é normalizada (feitas completa até o nº de séries)', () => {
  const e = sanitizar({ sessaoAtiva: { rotinaNome: 'A', itens: [{ nome: 'S', series: 3, reps: 8, carga: 10, feitas: [true] }] } });
  assert.deepEqual(e.sessaoAtiva.itens[0].feitas, [true, false, false]);
  assert.equal(sanitizar({ sessaoAtiva: { itens: [] } }).sessaoAtiva, null);
});

test('mesclar: pesos por data, demais por id, sem apagar nada', () => {
  const atual = estadoPadrao();
  atual.pesos = [{ data: '2025-10-01', peso: 80 }];
  atual.config.tema = 'claro';
  atual.rotinas = [{ id: 'r1', nome: 'A', exercicios: [{ id: 'e1', nome: 'S', series: 3, reps: 10, carga: 0 }] }];
  const imp = sanitizar({
    pesos: [{ data: '2025-10-01', peso: 79 }, { data: '2025-10-02', peso: 78 }],
    rotinas: [
      { id: 'r1', nome: 'A (outra)', exercicios: [{ nome: 'S', series: 3, reps: 10 }] },
      { id: 'r2', nome: 'B', exercicios: [{ nome: 'T', series: 3, reps: 10 }] },
    ],
    config: { tema: 'escuro' },
  });
  const { estado, resumo } = mesclar(atual, imp);
  assert.deepEqual(estado.pesos.map((p) => p.peso), [79, 78]);
  assert.deepEqual(estado.rotinas.map((r) => r.id), ['r1', 'r2']);
  assert.equal(estado.rotinas[0].nome, 'A'); // existente preservada
  assert.equal(estado.config.tema, 'claro'); // configuração local preservada
  assert.deepEqual(resumo, { pesos: 2, medidas: 0, rotinas: 1, treinos: 0 });
  assert.equal(mesclar(estado, imp).resumo.rotinas, 0); // idempotente
});

test('som do alerta: padrão é o gongo e valores inválidos voltam ao padrão', () => {
  assert.equal(estadoPadrao().config.somAlerta, 'gongo');
  assert.equal(sanitizar({ config: { somAlerta: 'sino' } }).config.somAlerta, 'sino');
  assert.equal(sanitizar({ config: { somAlerta: 'arquivo' } }).config.somAlerta, 'arquivo');
  assert.equal(sanitizar({ config: { somAlerta: 'javascript:alert(1)' } }).config.somAlerta, 'gongo');
  assert.equal(sanitizar({ config: {} }).config.somAlerta, 'gongo'); // quem já usava a v2.0 ganha o gongo
});
