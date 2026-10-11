// Gráfico de linha em SVG, sem biblioteca. A parte de cálculo (calcularGrafico) é pura e testável;
// desenharGrafico só transforma o resultado em elementos SVG.

import { formatarDataCurta, numeroDoDia } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');

export function calcularGrafico(pesosAsc, { media = [], meta = null, largura = 340, altura = 190 } = {}) {
  const m = { esq: 40, dir: 12, topo: 14, base: 26 };
  const area = { w: largura - m.esq - m.dir, h: altura - m.topo - m.base };

  const dias = pesosAsc.map((p) => numeroDoDia(p.data));
  let xmin = Math.min(...dias);
  let xmax = Math.max(...dias);
  if (xmin === xmax) {
    xmin -= 1;
    xmax += 1;
  }

  const valores = [...pesosAsc.map((p) => p.peso), ...media.map((p) => p.valor)];
  if (meta != null) valores.push(meta);
  let ymin = Math.floor(Math.min(...valores) - 0.5);
  let ymax = Math.ceil(Math.max(...valores) + 0.5);
  if (ymax - ymin < 2) {
    ymin -= 1;
    ymax += 1;
  }

  const x = (dia) => m.esq + ((dia - xmin) / (xmax - xmin)) * area.w;
  const y = (v) => m.topo + (1 - (v - ymin) / (ymax - ymin)) * area.h;
  const caminho = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const pontos = pesosAsc.map((p) => ({ x: x(numeroDoDia(p.data)), y: y(p.peso), data: p.data, valor: p.peso }));
  const pontosMedia = media.map((p) => ({ x: x(numeroDoDia(p.data)), y: y(p.valor) }));
  const ticks = [0, 1, 2].map((i) => {
    const v = ymin + ((ymax - ymin) * i) / 2;
    return { y: y(v), rotulo: fmt(v) };
  });

  return {
    largura,
    altura,
    margem: m,
    pontos,
    linha: caminho(pontos),
    linhaMedia: pontosMedia.length > 1 ? caminho(pontosMedia) : '',
    yMeta: meta != null ? y(meta) : null,
    ticks,
    rotuloInicio: formatarDataCurta(pesosAsc[0].data),
    rotuloFim: formatarDataCurta(pesosAsc.at(-1).data),
  };
}

function criar(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function desenharGrafico(pesosAsc, opcoes = {}) {
  const g = calcularGrafico(pesosAsc, opcoes);
  const svg = criar('svg', {
    viewBox: `0 0 ${g.largura} ${g.altura}`,
    class: 'grafico',
    role: 'img',
    'aria-label': `Gráfico de peso de ${g.rotuloInicio} a ${g.rotuloFim}, com ${g.pontos.length} registros.`,
  });

  for (const t of g.ticks) {
    svg.append(criar('line', { class: 'g-grade', x1: g.margem.esq, x2: g.largura - g.margem.dir, y1: t.y, y2: t.y }));
    const rot = criar('text', { class: 'g-eixo', x: g.margem.esq - 6, y: t.y + 3.5, 'text-anchor': 'end' });
    rot.textContent = t.rotulo;
    svg.append(rot);
  }
  if (g.yMeta != null) {
    svg.append(criar('line', { class: 'g-meta', x1: g.margem.esq, x2: g.largura - g.margem.dir, y1: g.yMeta, y2: g.yMeta }));
  }
  if (g.linhaMedia) svg.append(criar('path', { class: 'g-media', d: g.linhaMedia }));
  svg.append(criar('path', { class: 'g-linha', d: g.linha }));
  if (g.pontos.length <= 60) {
    for (const p of g.pontos) svg.append(criar('circle', { class: 'g-ponto', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3 }));
  }

  const ini = criar('text', { class: 'g-eixo', x: g.margem.esq, y: g.altura - 6, 'text-anchor': 'start' });
  ini.textContent = g.rotuloInicio;
  const fim = criar('text', { class: 'g-eixo', x: g.largura - g.margem.dir, y: g.altura - 6, 'text-anchor': 'end' });
  fim.textContent = g.rotuloFim;
  svg.append(ini, fim);
  return svg;
}
