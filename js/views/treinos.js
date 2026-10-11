// Aba "Treinos": rotinas, treino em andamento, histórico e recordes.

import { el } from '../ui.js';
import { ErroValidacao, formatarData, formatarNumero, novoId } from '../util.js';
import {
  ajustarItem, alternarSerie, criarSessao, finalizarSessao, progressoSessao, recordesPorExercicio, validarRotina,
} from '../treinos.js';
import { LIMITES } from '../modelo.js';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function montarTreinos({ painel, store, relogio, toast, persistir }) {
  const estado = () => store.obter();
  let limiteHistorico = 15;

  const dialogo = criarDialogoRotina();
  document.body.append(dialogo.elemento);

  // ---------- estrutura geral ----------
  function renderizar() {
    painel.replaceChildren(
      el('h2', { tabindex: '-1' }, 'Treinos'),
      estado().sessaoAtiva ? vistaSessao() : vistaRotinas(),
    );
  }

  // ---------- lista de rotinas, histórico e recordes ----------
  function vistaRotinas() {
    const { rotinas, historico } = estado();
    const raiz = el('div', {});

    const bloco = el('div', { class: 'bloco' }, el('h3', {}, 'Minhas rotinas'));
    if (rotinas.length === 0) {
      bloco.append(
        el('p', { class: 'vazio' }, 'Crie uma rotina, como "Treino A", e liste os exercícios com séries, repetições e carga. Depois é só iniciar o treino e marcar cada série.'),
      );
    } else {
      bloco.append(
        el('ul', { class: 'lista' }, rotinas.map((r) =>
          el('li', { class: 'rotina' },
            el('div', { class: 'rotina-info' },
              el('strong', {}, r.nome),
              el('span', { class: 'suave' }, `${plural(r.exercicios.length, 'exercício', 'exercícios')}: ${r.exercicios.map((e) => e.nome).join(', ')}`)),
            el('div', { class: 'rotina-acoes' },
              el('button', { type: 'button', class: 'botao', onClick: () => iniciarTreino(r) }, 'Iniciar treino'),
              el('button', { type: 'button', class: 'botao botao-sec', onClick: () => editarRotina(r) }, 'Editar'))))),
      );
    }
    if (rotinas.length < LIMITES.rotinas) {
      bloco.append(el('button', { type: 'button', class: 'botao botao-sec botao-bloco', onClick: () => editarRotina(null) }, 'Nova rotina'));
    }
    raiz.append(bloco);

    // histórico
    const blocoHist = el('div', { class: 'bloco' }, el('h3', {}, 'Histórico'));
    if (historico.length === 0) {
      blocoHist.append(el('p', { class: 'vazio' }, 'Os treinos finalizados aparecem aqui.'));
    } else {
      const recentes = [...historico].reverse();
      blocoHist.append(
        el('ul', { class: 'lista lista-historico' }, recentes.slice(0, limiteHistorico).map(itemHistorico)),
      );
      if (recentes.length > limiteHistorico) {
        blocoHist.append(el('button', {
          type: 'button', class: 'botao botao-sec botao-bloco',
          onClick: () => { limiteHistorico += 15; renderizar(); },
        }, `Mostrar mais (${recentes.length - limiteHistorico} restantes)`));
      }
    }
    raiz.append(blocoHist);

    // recordes
    const recordes = [...recordesPorExercicio(historico).values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (recordes.length) {
      raiz.append(
        el('details', { class: 'bloco' },
          el('summary', {}, `Recordes de carga (${recordes.length})`),
          el('ul', { class: 'lista' }, recordes.map((r) =>
            el('li', { class: 'linha-recorde' },
              el('span', {}, r.nome),
              el('span', { class: 'suave' }, `${formatarNumero(r.carga, 2)} kg em ${formatarData(r.data)}`)))))
      );
    }
    return raiz;
  }

  function itemHistorico(s) {
    const feitas = s.itens.reduce((n, it) => n + it.feitas, 0);
    const duracao = s.duracaoMin != null ? `, ${s.duracaoMin} min` : '';
    return el('li', { class: 'item-historico' },
      el('details', {},
        el('summary', {},
          el('span', { class: 'hist-titulo' }, s.rotinaNome),
          el('span', { class: 'suave' }, `${formatarData(s.data)}, ${plural(feitas, 'série', 'séries')}${duracao}`)),
        el('ul', { class: 'lista-simples' }, s.itens.map((it) =>
          el('li', {}, `${it.nome}: ${it.feitas} de ${it.series} séries, ${it.reps} repetições${it.carga > 0 ? `, ${formatarNumero(it.carga, 2)} kg` : ''}`))),
        s.notas ? el('p', { class: 'notas' }, s.notas) : null,
        el('button', { type: 'button', class: 'botao-texto perigo', onClick: () => apagarTreino(s) }, 'Apagar treino')));
  }

  function apagarTreino(s) {
    const lista = estado().historico;
    const indice = lista.findIndex((x) => x.id === s.id);
    if (indice < 0) return;
    lista.splice(indice, 1);
    persistir();
    renderizar();
    toast(`Treino de ${formatarData(s.data)} apagado.`, {
      acao: { rotulo: 'Desfazer', aoClicar: () => { lista.splice(Math.min(indice, lista.length), 0, s); persistir(); renderizar(); } },
    });
  }

  // ---------- treino em andamento ----------
  function iniciarTreino(rotina) {
    estado().sessaoAtiva = criarSessao(rotina);
    persistir();
    renderizar();
    window.scrollTo(0, 0);
  }

  function vistaSessao() {
    const sessao = estado().sessaoAtiva;
    const inicio = new Date(sessao.iniciadoEm);
    const hora = Number.isNaN(inicio.getTime()) ? '' : inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const contador = el('span', { class: 'suave' }, '');
    const atualizarContador = () => {
      const p = progressoSessao(sessao);
      contador.textContent = `${p.feitas} de ${p.total} séries${hora ? `, iniciado às ${hora}` : ''}`;
    };
    atualizarContador();

    const cartoes = sessao.itens.map((item, i) => {
      const botoesSerie = item.feitas.map((feita, j) => {
        const b = el('button', {
          type: 'button', class: 'serie', 'aria-pressed': String(feita),
          'aria-label': `Série ${j + 1} de ${item.nome}`,
        }, `Série ${j + 1}`);
        b.addEventListener('click', () => {
          const concluida = alternarSerie(sessao, i, j);
          if (concluida === null) return;
          b.setAttribute('aria-pressed', String(concluida));
          persistir();
          atualizarContador();
          const { completa } = progressoSessao(sessao);
          if (concluida && estado().config.descansoAuto && !completa) {
            relogio.iniciarSimples(estado().config.descansoPadrao, 'Descanso', 'descanso');
          }
        });
        return b;
      });

      const campoCarga = el('input', { id: `carga-${i}`, type: 'number', inputmode: 'decimal', min: 0, max: 1000, step: 0.5, value: item.carga });
      const campoReps = el('input', { id: `reps-${i}`, type: 'number', inputmode: 'numeric', min: 1, max: 100, step: 1, value: item.reps });
      campoCarga.addEventListener('change', () => { ajustarItem(sessao, i, { carga: campoCarga.value }); campoCarga.value = item.carga; persistir(); });
      campoReps.addEventListener('change', () => { ajustarItem(sessao, i, { reps: campoReps.value }); campoReps.value = item.reps; persistir(); });

      return el('li', { class: 'exercicio-sessao' },
        el('div', { class: 'exercicio-cabecalho' },
          el('strong', {}, item.nome),
          el('span', { class: 'suave' }, `Planejado: ${item.series} × ${item.reps}`)),
        el('div', { class: 'grade-2' },
          el('div', { class: 'campo' }, el('label', { for: `carga-${i}` }, 'Carga (kg)'), campoCarga),
          el('div', { class: 'campo' }, el('label', { for: `reps-${i}` }, 'Repetições'), campoReps)),
        el('div', { class: 'series' }, botoesSerie));
    });

    const notas = el('textarea', { id: 'notas-sessao', rows: 3, maxlength: LIMITES.notas, placeholder: 'Como foi o treino? (opcional)' });
    notas.value = sessao.notas;
    notas.addEventListener('change', () => { sessao.notas = notas.value.slice(0, LIMITES.notas); persistir(); });

    return el('div', {},
      el('div', { class: 'bloco bloco-sessao' },
        el('h3', {}, sessao.rotinaNome), contador,
        el('p', { class: 'dica' }, estado().config.descansoAuto
          ? `Ao concluir uma série, o descanso de ${estado().config.descansoPadrao} s começa sozinho.`
          : 'O descanso automático está desligado nos Ajustes.')),
      el('ul', { class: 'lista-cartoes' }, cartoes),
      el('div', { class: 'bloco' },
        el('div', { class: 'campo' }, el('label', { for: 'notas-sessao' }, 'Anotações'), notas)),
      el('div', { class: 'controles' },
        el('button', { type: 'button', class: 'botao botao-grande', onClick: () => finalizar(notas) }, 'Finalizar treino'),
        el('button', { type: 'button', class: 'botao botao-sec botao-grande', onClick: descartar }, 'Descartar')));
  }

  function finalizar(campoNotas) {
    const sessao = estado().sessaoAtiva;
    sessao.notas = campoNotas.value.slice(0, LIMITES.notas);
    try {
      const { registro, recordes } = finalizarSessao(sessao, estado().historico);
      estado().historico.push(registro);
      estado().sessaoAtiva = null;
      persistir();
      relogio.zerar();
      renderizar();
      window.scrollTo(0, 0);
      if (recordes.length === 0) {
        toast('Treino salvo no histórico.');
      } else {
        const detalhe = recordes.map((r) => `${r.nome}: ${formatarNumero(r.carga, 2)} kg (antes ${formatarNumero(r.anterior, 2)} kg)`).join('; ');
        toast(`Treino salvo. ${recordes.length === 1 ? 'Novo recorde em' : 'Novos recordes:'} ${detalhe}.`, { duracao: 9000 });
      }
    } catch (e) {
      if (e instanceof ErroValidacao) toast(e.message);
      else throw e;
    }
  }

  function descartar() {
    if (!confirm('Descartar o treino em andamento? As séries marcadas serão perdidas.')) return;
    estado().sessaoAtiva = null;
    persistir();
    relogio.zerar();
    renderizar();
  }

  // ---------- edição de rotinas ----------
  function editarRotina(rotina) {
    dialogo.abrir(rotina, {
      aoSalvar(dados) {
        const lista = estado().rotinas;
        if (rotina) {
          const i = lista.findIndex((r) => r.id === rotina.id);
          if (i >= 0) lista[i] = { id: rotina.id, ...dados };
        } else {
          lista.push({ id: novoId(), ...dados });
        }
        persistir();
        renderizar();
        toast(rotina ? 'Rotina atualizada.' : 'Rotina criada.');
      },
      aoApagar() {
        const lista = estado().rotinas;
        const i = lista.findIndex((r) => r.id === rotina.id);
        if (i < 0) return;
        const [removida] = lista.splice(i, 1);
        persistir();
        renderizar();
        toast(`Rotina "${removida.nome}" apagada.`, {
          acao: { rotulo: 'Desfazer', aoClicar: () => { lista.splice(Math.min(i, lista.length), 0, removida); persistir(); renderizar(); } },
        });
      },
    });
  }

  renderizar();
  return { renderizar };
}

// ---------- diálogo de criar/editar rotina ----------
function criarDialogoRotina() {
  const dialogo = el('dialog', { class: 'dialogo', 'aria-labelledby': 'titulo-rotina' });
  let linhas = [];
  let nomeRotina = '';
  let editando = null;
  let callbacks = null;

  function desenhar(focoNaUltima = false) {
    const erro = el('p', { class: 'erro', role: 'alert' }, '');
    const campoNome = el('input', { id: 'rotina-nome', type: 'text', maxlength: LIMITES.nome, autocomplete: 'off', placeholder: 'Ex.: Treino A', value: nomeRotina });
    campoNome.addEventListener('input', () => { nomeRotina = campoNome.value; });

    const itens = linhas.map((l, i) => {
      const nome = el('input', { type: 'text', maxlength: LIMITES.nome, autocomplete: 'off', placeholder: 'Nome do exercício', 'aria-label': `Nome do exercício ${i + 1}`, value: l.nome });
      const series = el('input', { type: 'number', inputmode: 'numeric', min: 1, max: 20, 'aria-label': `Séries do exercício ${i + 1}`, value: l.series });
      const reps = el('input', { type: 'number', inputmode: 'numeric', min: 1, max: 100, 'aria-label': `Repetições do exercício ${i + 1}`, value: l.reps });
      const carga = el('input', { type: 'number', inputmode: 'decimal', min: 0, max: 1000, step: 0.5, 'aria-label': `Carga em kg do exercício ${i + 1}`, value: l.carga });
      nome.addEventListener('input', () => { l.nome = nome.value; });
      series.addEventListener('input', () => { l.series = series.value; });
      reps.addEventListener('input', () => { l.reps = reps.value; });
      carga.addEventListener('input', () => { l.carga = carga.value; });
      l.refNome = nome;
      return el('li', { class: 'exercicio-edicao' },
        nome,
        el('div', { class: 'grade-3 compacta' },
          el('label', {}, el('span', { class: 'rotulo-mini' }, 'Séries'), series),
          el('label', {}, el('span', { class: 'rotulo-mini' }, 'Reps'), reps),
          el('label', {}, el('span', { class: 'rotulo-mini' }, 'Carga (kg)'), carga)),
        linhas.length > 1
          ? el('button', { type: 'button', class: 'botao-texto perigo', onClick: () => { linhas.splice(i, 1); desenhar(); } }, `Remover exercício ${i + 1}`)
          : null);
    });

    const formulario = el('form', { class: 'dialogo-corpo', novalidate: true },
      el('h3', { id: 'titulo-rotina' }, editando ? 'Editar rotina' : 'Nova rotina'),
      el('div', { class: 'campo' }, el('label', { for: 'rotina-nome' }, 'Nome da rotina'), campoNome),
      el('h4', {}, 'Exercícios'),
      el('ul', { class: 'lista-simples' }, itens),
      linhas.length < LIMITES.exerciciosPorRotina
        ? el('button', { type: 'button', class: 'botao botao-sec botao-bloco', onClick: () => { linhas.push(linhaVazia()); desenhar(true); } }, 'Adicionar exercício')
        : null,
      erro,
      el('div', { class: 'controles' },
        el('button', { type: 'submit', class: 'botao botao-grande' }, 'Salvar rotina'),
        el('button', { type: 'button', class: 'botao botao-sec botao-grande', onClick: () => dialogo.close() }, 'Cancelar')),
      editando
        ? el('button', {
          type: 'button', class: 'botao-texto perigo',
          onClick: () => {
            if (!confirm(`Apagar a rotina "${editando.nome}"? Você poderá desfazer logo em seguida.`)) return;
            dialogo.close();
            callbacks.aoApagar();
          },
        }, 'Apagar rotina')
        : null);

    formulario.addEventListener('submit', (ev) => {
      ev.preventDefault();
      try {
        const dados = validarRotina({
          nome: nomeRotina,
          exercicios: linhas.map(({ id, nome, series, reps, carga }) => ({ id, nome, series, reps, carga })),
        });
        dialogo.close();
        callbacks.aoSalvar(dados);
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e;
        erro.textContent = e.message;
      }
    });

    dialogo.replaceChildren(formulario);
    if (focoNaUltima) linhas.at(-1)?.refNome?.focus();
  }

  const linhaVazia = () => ({ id: undefined, nome: '', series: 3, reps: 10, carga: '' });

  return {
    elemento: dialogo,
    abrir(rotina, cb) {
      editando = rotina;
      callbacks = cb;
      nomeRotina = rotina?.nome ?? '';
      linhas = rotina ? rotina.exercicios.map((e) => ({ ...e })) : [linhaVazia()];
      desenhar();
      dialogo.showModal();
    },
  };
}
