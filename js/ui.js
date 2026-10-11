// Ajudantes de interface. Todo conteúdo dinâmico é inserido com textContent/createTextNode
// (nunca innerHTML), então nada digitado pelo usuário vira HTML.

const NS_SVG = 'http://www.w3.org/2000/svg';

/** el('button', { class: 'botao', onClick: fn, 'aria-pressed': 'false' }, 'Texto', outroNo) */
export function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props ?? {})) {
    if (valor == null || valor === false) continue;
    if (chave === 'class') no.className = valor;
    else if (chave.startsWith('on') && typeof valor === 'function') no.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (valor === true) no.setAttribute(chave, '');
    else no.setAttribute(chave, valor);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    no.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return no;
}

export function svgEl(tag, attrs = {}) {
  const no = document.createElementNS(NS_SVG, tag);
  for (const [k, v] of Object.entries(attrs)) no.setAttribute(k, v);
  return no;
}

const ICONES = {
  timer: [['circle', { cx: 12, cy: 13.5, r: 7.5 }], ['path', { d: 'M12 13.5V9.5M9.5 2.5h5' }]],
  treinos: [['path', { d: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11' }]],
  peso: [['path', { d: 'M3 17l6-6 4 4 8-9' }], ['path', { d: 'M3 21h18' }]],
  ajustes: [['path', { d: 'M4 7h9M19 7h1M4 17h1M11 17h9' }], ['circle', { cx: 16, cy: 7, r: 2.5 }], ['circle', { cx: 8, cy: 17, r: 2.5 }]],
};

export function icone(nome) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    class: 'icone',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  for (const [tag, attrs] of ICONES[nome] ?? []) svg.append(svgEl(tag, attrs));
  return svg;
}

/** Aviso temporário no topo. duracao = 0 mantém até o usuário agir ou fechar. */
export function mostrarToast(mensagem, { acao = null, duracao = 4500 } = {}) {
  const area = document.getElementById('toasts');
  if (!area) return () => {};
  const caixa = el('div', { class: 'toast' }, el('span', { class: 'toast-texto' }, mensagem));
  const remover = () => caixa.remove();
  // Avisos simples substituem o anterior (não empilham e não cobrem a tela).
  // Os que têm ação (ex.: "Desfazer") ou ficam fixos são preservados.
  const fixo = Boolean(acao) || duracao === 0;
  if (fixo) caixa.dataset.fixo = '1';
  for (const antigo of [...area.children]) if (!antigo.dataset.fixo) antigo.remove();
  if (acao) {
    caixa.append(
      el('button', { type: 'button', class: 'toast-acao', onClick: () => { acao.aoClicar(); remover(); } }, acao.rotulo),
    );
  }
  if (duracao === 0) {
    caixa.append(el('button', { type: 'button', class: 'toast-fechar', 'aria-label': 'Fechar aviso', onClick: remover }, '×'));
  }
  area.append(caixa);
  while (area.children.length > 3) area.firstElementChild.remove();
  if (duracao > 0) setTimeout(remover, acao ? Math.max(duracao, 7000) : duracao);
  return remover;
}

export function criarNavegacao({ nav, abas, inicial, aoMudar }) {
  const botoes = new Map();
  let atual = null;

  function irPara(id, { mover = true } = {}) {
    if (!botoes.has(id)) id = abas[0].id;
    atual = id;
    for (const a of abas) {
      const painel = document.getElementById(`aba-${a.id}`);
      if (painel) painel.hidden = a.id !== id;
      const botao = botoes.get(a.id);
      if (a.id === id) botao.setAttribute('aria-current', 'page');
      else botao.removeAttribute('aria-current');
    }
    try {
      history.replaceState(null, '', `#${id}`);
    } catch {
      /* ambiente sem History API */
    }
    window.scrollTo(0, 0);
    if (mover) document.querySelector(`#aba-${id} h2`)?.focus({ preventScroll: true });
    aoMudar?.(id);
  }

  for (const a of abas) {
    const botao = el('button', { type: 'button', class: 'nav-item', onClick: () => irPara(a.id) }, icone(a.icone), el('span', {}, a.rotulo));
    botoes.set(a.id, botao);
    nav.append(botao);
  }
  irPara(inicial, { mover: false });
  return { irPara, atual: () => atual };
}
