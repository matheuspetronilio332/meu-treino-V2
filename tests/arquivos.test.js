import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { VERSAO_APP } from '../js/util.js';

const raiz = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sw = readFileSync(join(raiz, 'service-worker.js'), 'utf8');
const lista = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]).filter((n) => n !== './');

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const caminho = join(dir, n);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

test('todo arquivo do cache do service worker existe (senão a instalação falha)', () => {
  for (const nome of lista) assert.ok(existsSync(join(raiz, nome)), `faltando: ${nome}`);
});

test('todo js/css/ícone do app está no cache offline', () => {
  const esperados = ['js', 'css', 'icons'].flatMap((d) => arquivos(join(raiz, d))).map((f) => relative(raiz, f).replaceAll('\\', '/'));
  for (const f of esperados) assert.ok(lista.includes(f), `fora do cache offline: ${f}`);
});

test('versão do service worker acompanha VERSAO_APP', () => {
  assert.ok(sw.includes(`'meu-treino-v${VERSAO_APP}'`));
  assert.equal(JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version, VERSAO_APP);
});

test('manifest: ícones existem e start_url/scope são relativos (funciona em subpasta do GitHub Pages)', () => {
  const m = JSON.parse(readFileSync(join(raiz, 'manifest.json'), 'utf8'));
  for (const i of m.icons) assert.ok(existsSync(join(raiz, i.src)), i.src);
  assert.ok(m.start_url.startsWith('.'));
  assert.ok(m.scope.startsWith('.'));
  assert.equal(m.id, undefined);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

test('nenhum módulo usa innerHTML nem recursos externos', () => {
  for (const f of arquivos(join(raiz, 'js'))) {
    // ignora comentários: eles podem citar essas palavras para explicar a regra
    const codigo = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(codigo), `HTML dinâmico em ${f}`);
    // o namespace do SVG é só um identificador, não uma requisição de rede
    assert.ok(!/https?:\/\//.test(codigo.replaceAll('http://www.w3.org/2000/svg', '')), `URL externa em ${f}`);
  }
});
