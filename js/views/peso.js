// Aba "Peso": registro, resumo, meta, gráfico, histórico e medidas corporais.

import { el } from '../ui.js';
import { ErroValidacao, formatarData, formatarDelta, formatarNumero, hojeISO, novoId } from '../util.js';
import { PESO_MAX, PESO_MIN, TIPOS_MEDIDA, numero } from '../modelo.js';
import { comVariacao, filtrarPeriodo, mediaMovel, registrarPeso, resumo } from '../peso.js';
import { desenharGrafico } from '../grafico.js';

const PERIODOS = [[30, '30 dias'], [90, '90 dias'], [null, 'Tudo']];

export function montarPeso({ painel, store, toast, persistir }) {
  const estado = () => store.obter();
  let periodo = 90;
  let mostrarTudo = false;

  function renderizar() {
    painel.replaceChildren(
      el('h2', { tabindex: '-1' }, 'Peso e medidas'),
      blocoRegistro(),
      blocoResumo(),
      blocoGrafico(),
      blocoHistorico(),
      blocoMedidas(),
    );
  }

  // ----- registro -----
  function blocoRegistro() {
    const data = el('input', { id: 'peso-data', type: 'date', value: hojeISO(), max: hojeISO(), required: true });
    const peso = el('input', { id: 'peso-valor', type: 'number', inputmode: 'decimal', step: 0.1, min: PESO_MIN, max: PESO_MAX, placeholder: 'Ex.: 72,4', required: true });
    const form = el('form', { class: 'formulario', novalidate: true },
      el('div', { class: 'grade-2' },
        el('div', { class: 'campo' }, el('label', { for: 'peso-valor' }, 'Peso (kg)'), peso),
        el('div', { class: 'campo' }, el('label', { for: 'peso-data' }, 'Data'), data)),
      el('button', { type: 'submit', class: 'botao botao-bloco' }, 'Registrar peso'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      try {
        const r = registrarPeso(estado().pesos, { data: data.value, peso: peso.value });
        estado().pesos = r.pesos;
        persistir();
        renderizar();
        toast(r.substituiu ? `Peso de ${formatarData(data.value)} atualizado.` : 'Peso registrado.');
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e;
        toast(e.message);
        peso.focus();
      }
    });
    return el('div', { class: 'bloco' }, el('h3', {}, 'Registrar peso'), form,
      el('p', { class: 'dica' }, 'Há um registro por dia: registrar de novo na mesma data atualiza o valor.'));
  }

  // ----- resumo e meta -----
  function blocoResumo() {
    const { pesos, config } = estado();
    const r = resumo(pesos, config.metaPeso);
    const bloco = el('div', { class: 'bloco' }, el('h3', {}, 'Resumo'));

    if (!r) {
      bloco.append(el('p', { class: 'vazio' }, 'Registre seu primeiro peso para ver a evolução.'));
    } else {
      const linha = (rotulo, valor, detalhe) =>
        el('div', { class: 'resumo-item' }, el('dt', {}, rotulo), el('dd', {}, el('span', { class: 'resumo-valor' }, valor), detalhe ? el('span', { class: 'suave' }, detalhe) : null));
      let metaTexto = null;
      if (r.faltaMeta !== null) {
        metaTexto = Math.abs(r.faltaMeta) < 0.05 ? 'Meta atingida' : `Faltam ${formatarNumero(Math.abs(r.faltaMeta))} kg`;
      }
      bloco.append(el('dl', { class: 'resumo' },
        linha('Peso atual', `${formatarNumero(r.atual.peso)} kg`, `em ${formatarData(r.atual.data)}`),
        r.variacaoUltimo !== null ? linha('Desde o registro anterior', formatarDelta(r.variacaoUltimo)) : null,
        linha('Média de 7 dias', `${formatarNumero(r.media7)} kg`),
        r.variacaoTotal !== null ? linha('Desde o primeiro registro', formatarDelta(r.variacaoTotal), `${formatarNumero(r.minimo)} a ${formatarNumero(r.maximo)} kg no período`) : null,
        metaTexto ? linha('Meta', `${formatarNumero(config.metaPeso)} kg`, metaTexto) : null));
    }

    const meta = el('input', { id: 'peso-meta', type: 'number', inputmode: 'decimal', step: 0.1, min: PESO_MIN, max: PESO_MAX, placeholder: 'Sem meta', value: config.metaPeso ?? '' });
    const formMeta = el('form', { class: 'formulario linha-meta', novalidate: true },
      el('div', { class: 'campo' }, el('label', { for: 'peso-meta' }, 'Meta de peso (kg)'), meta),
      el('button', { type: 'submit', class: 'botao botao-sec' }, 'Salvar meta'));
    formMeta.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (meta.value.trim() === '') {
        estado().config.metaPeso = null;
      } else {
        const v = numero(meta.value, PESO_MIN, PESO_MAX, 1);
        if (v === null) { toast(`Informe uma meta entre ${PESO_MIN} e ${PESO_MAX} kg.`); return; }
        estado().config.metaPeso = v;
      }
      persistir();
      renderizar();
      toast(estado().config.metaPeso === null ? 'Meta removida.' : 'Meta salva.');
    });
    bloco.append(formMeta);
    return bloco;
  }

  // ----- gráfico -----
  function blocoGrafico() {
    const { pesos, config } = estado();
    const bloco = el('div', { class: 'bloco' }, el('h3', {}, 'Evolução'));
    const botoes = el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Período do gráfico' },
      PERIODOS.map(([dias, rotulo]) =>
        el('button', { type: 'button', class: 'segmento', 'aria-pressed': String(periodo === dias), onClick: () => { periodo = dias; renderizar(); } }, rotulo)));
    bloco.append(botoes);

    const visiveis = filtrarPeriodo(pesos, periodo);
    if (visiveis.length < 2) {
      bloco.append(el('p', { class: 'vazio' }, pesos.length < 2
        ? 'Registre ao menos 2 pesos para ver o gráfico.'
        : 'Há menos de 2 registros neste período. Escolha um período maior.'));
      return bloco;
    }
    // A média móvel é calculada com todo o histórico, para não "começar do zero" na borda do período.
    const inicio = visiveis[0].data;
    const media = mediaMovel(pesos, 7).filter((m) => m.data >= inicio);
    bloco.append(
      desenharGrafico(visiveis, { media, meta: config.metaPeso }),
      el('p', { class: 'legenda' },
        el('span', { class: 'leg leg-linha' }, 'Peso'),
        el('span', { class: 'leg leg-media' }, 'Média de 7 dias'),
        config.metaPeso != null ? el('span', { class: 'leg leg-meta' }, 'Meta') : null));
    return bloco;
  }

  // ----- histórico -----
  function blocoHistorico() {
    const { pesos } = estado();
    const bloco = el('div', { class: 'bloco' }, el('h3', {}, 'Histórico de peso'));
    if (!pesos.length) {
      bloco.append(el('p', { class: 'vazio' }, 'Nenhum registro ainda.'));
      return bloco;
    }
    const todos = comVariacao(pesos).reverse();
    const lista = mostrarTudo ? todos : todos.slice(0, 10);
    bloco.append(el('ul', { class: 'lista' }, lista.map((p) =>
      el('li', { class: 'linha-peso' },
        el('span', { class: 'linha-data' }, formatarData(p.data)),
        el('span', { class: 'linha-valor' }, `${formatarNumero(p.peso)} kg`),
        el('span', { class: 'suave linha-delta' }, p.delta === null ? '' : formatarDelta(p.delta)),
        el('button', { type: 'button', class: 'botao-icone', 'aria-label': `Apagar registro de ${formatarData(p.data)}`, onClick: () => apagarPeso(p) }, '×')))));
    if (todos.length > 10) {
      bloco.append(el('button', { type: 'button', class: 'botao botao-sec botao-bloco', onClick: () => { mostrarTudo = !mostrarTudo; renderizar(); } },
        mostrarTudo ? 'Mostrar só os 10 mais recentes' : `Mostrar todos (${todos.length})`));
    }
    return bloco;
  }

  function apagarPeso(p) {
    const removido = estado().pesos.find((x) => x.data === p.data);
    if (!removido) return;
    estado().pesos = estado().pesos.filter((x) => x.data !== p.data);
    persistir();
    renderizar();
    toast(`Registro de ${formatarData(p.data)} apagado.`, {
      acao: {
        rotulo: 'Desfazer',
        aoClicar: () => {
          estado().pesos.push(removido);
          estado().pesos.sort((a, b) => a.data.localeCompare(b.data));
          persistir();
          renderizar();
        },
      },
    });
  }

  // ----- medidas -----
  function blocoMedidas() {
    const { medidas } = estado();
    const bloco = el('div', { class: 'bloco' }, el('h3', {}, 'Medidas corporais'));

    const tipo = el('select', { id: 'medida-tipo' }, TIPOS_MEDIDA.map((t) => el('option', { value: t }, t)));
    const valor = el('input', { id: 'medida-valor', type: 'number', inputmode: 'decimal', step: 0.1, min: 1, max: 300, placeholder: 'Ex.: 82', required: true });
    const form = el('form', { class: 'formulario', novalidate: true },
      el('div', { class: 'grade-2' },
        el('div', { class: 'campo' }, el('label', { for: 'medida-tipo' }, 'Medida'), tipo),
        el('div', { class: 'campo' }, el('label', { for: 'medida-valor' }, 'Valor (cm)'), valor)),
      el('button', { type: 'submit', class: 'botao botao-sec botao-bloco' }, 'Registrar medida'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = numero(valor.value, 1, 300, 1);
      if (v === null) { toast('Informe um valor entre 1 e 300 cm.'); valor.focus(); return; }
      estado().medidas.push({ id: novoId(), data: hojeISO(), tipo: tipo.value, valor: v });
      persistir();
      renderizar();
      toast(`${tipo.value} registrada.`);
    });
    bloco.append(form);

    if (medidas.length === 0) {
      bloco.append(el('p', { class: 'vazio' }, 'Registre cintura, braço e outras medidas para acompanhar além da balança.'));
      return bloco;
    }

    const resumoTipos = TIPOS_MEDIDA.map((t) => {
      const regs = medidas.filter((m) => m.tipo === t);
      if (!regs.length) return null;
      const ultimo = regs.at(-1);
      const anterior = regs.length > 1 ? regs.at(-2) : null;
      return el('li', { class: 'linha-peso' },
        el('span', { class: 'linha-data' }, t),
        el('span', { class: 'linha-valor' }, `${formatarNumero(ultimo.valor)} cm`),
        el('span', { class: 'suave linha-delta' }, anterior ? formatarDelta(Math.round((ultimo.valor - anterior.valor) * 10) / 10, 'cm') : ''),
        el('span', { class: 'suave' }, formatarData(ultimo.data)));
    }).filter(Boolean);
    bloco.append(el('ul', { class: 'lista' }, resumoTipos));

    bloco.append(el('details', { class: 'detalhes-medidas' },
      el('summary', {}, `Todos os registros (${medidas.length})`),
      el('ul', { class: 'lista' }, [...medidas].reverse().map((m) =>
        el('li', { class: 'linha-peso' },
          el('span', { class: 'linha-data' }, `${m.tipo}`),
          el('span', { class: 'linha-valor' }, `${formatarNumero(m.valor)} cm`),
          el('span', { class: 'suave linha-delta' }, formatarData(m.data)),
          el('button', { type: 'button', class: 'botao-icone', 'aria-label': `Apagar ${m.tipo} de ${formatarData(m.data)}`, onClick: () => apagarMedida(m) }, '×'))))));
    return bloco;
  }

  function apagarMedida(m) {
    const lista = estado().medidas;
    const i = lista.findIndex((x) => x.id === m.id);
    if (i < 0) return;
    lista.splice(i, 1);
    persistir();
    renderizar();
    toast(`${m.tipo} de ${formatarData(m.data)} apagada.`, {
      acao: { rotulo: 'Desfazer', aoClicar: () => { lista.splice(Math.min(i, lista.length), 0, m); persistir(); renderizar(); } },
    });
  }

  renderizar();
  return { renderizar };
}
