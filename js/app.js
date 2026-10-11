// Ponto de entrada: carrega os dados, monta as abas e liga tudo.

import * as store from './store.js';
import { criarRelogio } from './relogio.js';
import { criarNavegacao, el, mostrarToast } from './ui.js';
import { formatarTempo } from './timer.js';
import { montarTimer } from './views/timer.js';
import { montarTreinos } from './views/treinos.js';
import { montarPeso } from './views/peso.js';
import { montarAjustes } from './views/ajustes.js';
import { armazenamentoPersistente, iniciarPWA, pedirArmazenamentoPersistente } from './pwa.js';

const TITULO = 'Meu treino';
const ABAS = [
  { id: 'timer', rotulo: 'Timer', icone: 'timer' },
  { id: 'treinos', rotulo: 'Treinos', icone: 'treinos' },
  { id: 'peso', rotulo: 'Peso', icone: 'peso' },
  { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
];

const resultado = store.carregar();
const toast = mostrarToast;

let avisouErroGravacao = 0;
function persistir() {
  if (store.salvar()) return true;
  if (Date.now() - avisouErroGravacao > 15000) {
    avisouErroGravacao = Date.now();
    toast('Não foi possível salvar. O armazenamento do navegador está bloqueado ou cheio. Exporte um backup.', { duracao: 8000 });
  }
  return false;
}

// ---------- tema ----------
const consultaClaro = window.matchMedia?.('(prefers-color-scheme: light)');
function aplicarTema() {
  const preferido = store.obter().config.tema;
  const claro = preferido === 'claro' || (preferido === 'auto' && consultaClaro?.matches);
  document.documentElement.dataset.tema = claro ? 'claro' : 'escuro';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', claro ? '#f2f7f5' : '#0d1613');
}
consultaClaro?.addEventListener?.('change', aplicarTema);
aplicarTema();

// ---------- relógio e telas ----------
const relogio = criarRelogio({ obterConfig: () => store.obter().config });
const painel = (id) => document.getElementById(`aba-${id}`);

let navegacao = null;
const irPara = (id) => navegacao.irPara(id);
const telas = {};

function atualizarTudo() {
  Object.values(telas).forEach((t) => t.renderizar());
}

const contexto = { store, relogio, toast, persistir, irPara, aplicarTema, atualizarTudo };
telas.timer = montarTimer({ painel: painel('timer'), ...contexto });
telas.treinos = montarTreinos({ painel: painel('treinos'), ...contexto });
telas.peso = montarPeso({ painel: painel('peso'), ...contexto });
telas.ajustes = montarAjustes({ painel: painel('ajustes'), ...contexto });

// ---------- mini-barra do timer (visível fora da aba Timer) ----------
const mini = document.getElementById('mini-timer');
const miniTempo = el('span', { class: 'mini-tempo' }, '00:00');
const miniRotulo = el('span', { class: 'mini-rotulo' }, '');
const miniBarra = el('i', {});
mini.append(miniTempo, miniRotulo, el('span', { class: 'mini-barra', 'aria-hidden': 'true' }, miniBarra));
mini.addEventListener('click', () => irPara('timer'));

let fimExpirou = false;
let fimTimeout = null;
let ultimoStatus = 'ocioso';

function atualizarMini(s) {
  if (s.status === 'finalizado' && ultimoStatus !== 'finalizado') {
    fimExpirou = false;
    fimTimeout = setTimeout(() => { fimExpirou = true; atualizarMini(relogio.snapshot()); }, 10000);
  }
  if (s.status !== 'finalizado') {
    clearTimeout(fimTimeout);
    fimExpirou = false;
  }
  ultimoStatus = s.status;

  const naAbaTimer = navegacao?.atual() === 'timer';
  const visivel = s.status !== 'ocioso' && !naAbaTimer && !(s.status === 'finalizado' && fimExpirou);
  mini.hidden = !visivel;

  // O título da janela também mostra o tempo (útil no computador e ao alternar de aba).
  if (s.status === 'rodando' || s.status === 'pausado') {
    document.title = `${formatarTempo(s.restanteMs)} ${s.fase.rotulo} - ${TITULO}`;
  } else {
    document.title = s.status === 'finalizado' ? `Concluído - ${TITULO}` : TITULO;
  }
  if (!visivel) return;

  const concluido = s.status === 'finalizado';
  miniTempo.textContent = concluido ? '00:00' : formatarTempo(s.restanteMs);
  miniRotulo.textContent = concluido ? 'Concluído' : s.status === 'pausado' ? `${s.fase.rotulo}, pausado` : s.fase.rotulo;
  miniBarra.style.width = `${Math.round((concluido ? 0 : s.fracao) * 100)}%`;
  mini.className = `mini-timer fase-${concluido ? 'fim' : s.fase.tipo}`;
  mini.setAttribute('aria-label', `Timer em andamento: ${miniTempo.textContent}, ${miniRotulo.textContent}. Abrir o timer.`);
}
relogio.assinar(atualizarMini);

// Avisos do timer para leitores de tela (só quando a fase muda, não a cada segundo).
const anuncios = document.getElementById('anuncios');
relogio.ouvirEventos((mensagem) => { anuncios.textContent = mensagem; });

// ---------- navegação ----------
const params = new URLSearchParams(location.search);
const inicial = params.get('aba') || location.hash.slice(1) || 'timer';
navegacao = criarNavegacao({
  nav: document.getElementById('navegacao'),
  abas: ABAS,
  inicial,
  aoMudar: () => atualizarMini(relogio.snapshot()),
});

// Se havia um treino em andamento, vai direto para ele ao abrir o app sem aba específica.
if (store.obter().sessaoAtiva && !params.get('aba') && !location.hash) irPara('treinos');

// ---------- avisos de carregamento ----------
if (resultado.origem === 'migrado') {
  toast(`${resultado.pesos} registros de peso da versão anterior foram trazidos para cá.`, { duracao: 8000 });
} else if (resultado.origem === 'corrompido') {
  toast('Os dados salvos estavam corrompidos. Uma cópia foi guardada no navegador e o app começou vazio.', { duracao: 0 });
}
if (!store.gravacaoFunciona()) {
  toast('O armazenamento do navegador está bloqueado: seus dados não serão salvos. Saia do modo privado, se estiver nele.', { duracao: 0 });
}

// ---------- PWA ----------
iniciarPWA({
  aoHaAtualizacao: (aplicar) =>
    toast('Há uma nova versão do app.', { duracao: 0, acao: { rotulo: 'Atualizar', aoClicar: aplicar } }),
});
// Depois que o usuário já usou o app, pede para o navegador não apagar os dados.
armazenamentoPersistente().then((r) => { if (r === 'nao' && store.obter().pesos.length) pedirArmazenamentoPersistente(); });
