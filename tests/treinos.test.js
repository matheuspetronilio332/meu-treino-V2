import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ajustarItem, alternarSerie, criarSessao, finalizarSessao, progressoSessao, recordesPorExercicio, validarRotina,
} from '../js/treinos.js';
import { ErroValidacao } from '../js/util.js';

const rotina = validarRotina({
  nome: 'Treino A',
  exercicios: [
    { nome: 'Supino reto', series: 3, reps: 10, carga: '40' },
    { nome: 'Remada', series: 2, reps: 12, carga: '' },
  ],
});

test('validarRotina normaliza e rejeita dados ruins', () => {
  assert.equal(rotina.exercicios[1].carga, 0);
  assert.ok(rotina.exercicios[0].id);
  assert.throws(() => validarRotina({ nome: ' ', exercicios: [{ nome: 'A', series: 1, reps: 1 }] }), ErroValidacao);
  assert.throws(() => validarRotina({ nome: 'A', exercicios: [] }), ErroValidacao);
  assert.throws(() => validarRotina({ nome: 'A', exercicios: [{ nome: 'B', series: 0, reps: 1 }] }), /séries/);
  assert.throws(() => validarRotina({ nome: 'A', exercicios: [{ nome: 'B', series: 1, reps: 101 }] }), /repetições/);
  assert.throws(() => validarRotina({ nome: 'A', exercicios: [{ nome: 'B', series: 1, reps: 1, carga: -1 }] }), /carga/);
});

test('sessão: marcar séries, ajustar carga e progresso', () => {
  const s = criarSessao({ id: 'r', ...rotina });
  assert.equal(progressoSessao(s).total, 5);
  assert.equal(alternarSerie(s, 0, 0), true);
  assert.equal(alternarSerie(s, 0, 0), false);
  assert.equal(alternarSerie(s, 0, 9), null);
  alternarSerie(s, 0, 1);
  ajustarItem(s, 0, { carga: '42,5', reps: 8 });
  ajustarItem(s, 0, { carga: 'lixo', reps: 0 }); // inválidos são ignorados
  assert.equal(s.itens[0].carga, 42.5);
  assert.equal(s.itens[0].reps, 8);
  assert.equal(progressoSessao(s).feitas, 1);
  assert.equal(progressoSessao(s).completa, false);
});

test('finalizar exige ao menos uma série e grava só o que foi feito', () => {
  const s = criarSessao({ id: 'r', ...rotina }, new Date('2025-10-24T10:00:00'));
  assert.throws(() => finalizarSessao(s, []), ErroValidacao);
  alternarSerie(s, 0, 0);
  alternarSerie(s, 0, 1);
  const { registro, recordes } = finalizarSessao(s, [], new Date('2025-10-24T10:47:00'));
  assert.equal(registro.itens.length, 1);
  assert.equal(registro.itens[0].feitas, 2);
  assert.equal(registro.duracaoMin, 47);
  assert.equal(registro.data, '2025-10-24');
  assert.deepEqual(recordes, []); // 1ª vez: linha de base, não é recorde
});

test('recordes: só quando supera um recorde anterior; ignora acento/caixa', () => {
  const hist = [{ data: '2025-10-01', itens: [{ nome: 'Supino Réto', series: 3, reps: 10, carga: 40, feitas: 3 }] }];
  assert.equal(recordesPorExercicio(hist).get('supino reto').carga, 40);

  let s = criarSessao({ id: 'r', ...rotina });
  alternarSerie(s, 0, 0);
  ajustarItem(s, 0, { carga: 45 });
  let r = finalizarSessao(s, hist);
  assert.deepEqual(r.recordes, [{ nome: 'Supino reto', carga: 45, anterior: 40 }]);

  s = criarSessao({ id: 'r', ...rotina });
  alternarSerie(s, 0, 0);
  ajustarItem(s, 0, { carga: 40 }); // empate não é recorde
  assert.deepEqual(finalizarSessao(s, hist).recordes, []);

  // série não feita não conta como recorde nem entra no mapa
  const so0 = [{ data: '2025-10-01', itens: [{ nome: 'X', series: 3, reps: 10, carga: 99, feitas: 0 }] }];
  assert.equal(recordesPorExercicio(so0).size, 0);
});
