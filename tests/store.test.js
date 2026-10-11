import test from 'node:test';
import assert from 'node:assert/strict';

// localStorage falso, só para este teste
function instalarStorage(inicial = {}, { falhaAoGravar = false } = {}) {
  const dados = { ...inicial };
  globalThis.localStorage = {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { if (falhaAoGravar) throw new Error('cheio'); dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
  return dados;
}

async function novoStore() {
  return import(`../js/store.js?${Math.random()}`); // módulo novo a cada teste (estado isolado)
}

test('migra os pesos da versão 1 (datas dd/mm/aaaa) sem apagar a chave antiga', async () => {
  const dados = instalarStorage({
    pesoCorporal: JSON.stringify([
      { data: '24/10/2025', peso: 72.4 },
      { data: '01/10/2025', peso: 73 },
      { data: 'lixo', peso: 70 },
      { data: '02/10/2025', peso: 0 },
    ]),
  });
  const store = await novoStore();
  const r = store.carregar();
  assert.equal(r.origem, 'migrado');
  assert.equal(r.pesos, 2);
  assert.deepEqual(store.obter().pesos, [{ data: '2025-10-01', peso: 73 }, { data: '2025-10-24', peso: 72.4 }]);
  assert.ok(dados.pesoCorporal, 'a chave antiga continua lá como segurança');
  assert.ok(dados['treino:v2']);
  assert.equal((await novoStore()).carregar().origem, 'v2');
});

test('dados corrompidos viram backup e o app começa vazio (sem quebrar)', async () => {
  const dados = instalarStorage({ 'treino:v2': '{isso não é json' });
  const store = await novoStore();
  assert.equal(store.carregar().origem, 'corrompido');
  assert.deepEqual(store.obter().pesos, []);
  assert.equal(dados['treino:v2:corrompido'], '{isso não é json');
});

test('falha ao gravar é reportada, não lançada', async () => {
  instalarStorage({}, { falhaAoGravar: true });
  const store = await novoStore();
  store.carregar();
  assert.equal(store.salvar(), false);
  assert.equal(store.gravacaoFunciona(), false);
});

test('localStorage bloqueado: o app roda em memória', async () => {
  globalThis.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() {} };
  const store = await novoStore();
  assert.equal(store.carregar().origem, 'novo');
  assert.equal(store.gravacaoFunciona(), false);
});

test('apagarTudo remove inclusive a chave antiga (não migra de novo)', async () => {
  const dados = instalarStorage({ pesoCorporal: JSON.stringify([{ data: '01/10/2025', peso: 70 }]) });
  const store = await novoStore();
  store.carregar();
  store.apagarTudo();
  assert.equal(dados.pesoCorporal, undefined);
  assert.equal((await novoStore()).carregar().origem, 'novo');
});
