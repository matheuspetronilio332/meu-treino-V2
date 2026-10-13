// Aba "Ajustes": aparência, alertas, dados (backup/importação) e instalação do app.

import { el } from '../ui.js';
import { ErroValidacao, VERSAO_APP, hojeISO } from '../util.js';
import { mesclar } from '../modelo.js';
import {
  LIMITE_IMPORTACAO, baixarArquivo, gerarCSVPesos, gerarCSVTreinos, gerarJSON, lerImportacao,
} from '../exportacao.js';
import { ouvirSom, pedirPermissaoNotificacao } from '../alertas.js';
import * as pwa from '../pwa.js';

export function montarAjustes({ painel, store, relogio, toast, persistir, aplicarTema, atualizarTudo }) {
  const cfg = () => store.obter().config;
  let cancelarInstalacao = null;

  function interruptor(id, rotulo, descricao, valor, aoMudar) {
    const caixa = el('input', { id, type: 'checkbox', class: 'chave-input', checked: valor });
    caixa.addEventListener('change', () => aoMudar(caixa.checked, caixa));
    return el('div', { class: 'ajuste' },
      el('div', { class: 'ajuste-texto' }, el('label', { for: id }, rotulo), descricao ? el('span', { class: 'suave' }, descricao) : null),
      el('span', { class: 'chave' }, caixa, el('span', { class: 'chave-trilho', 'aria-hidden': 'true' })));
  }

  function renderizar() {
    const c = cfg();

    // aparência
    const tema = el('select', { id: 'ajuste-tema' },
      [['auto', 'Automático (segue o aparelho)'], ['escuro', 'Escuro'], ['claro', 'Claro']].map(([v, r]) => el('option', { value: v, selected: c.tema === v }, r)));
    tema.addEventListener('change', () => { cfg().tema = tema.value; persistir(); aplicarTema(); });

    // som do alerta
    const estiloSom = el('select', { id: 'ajuste-som-estilo' },
      [['gongo', 'Gongo de luta'], ['sino', 'Sino de boxe (3 batidas no fim)'], ['bipe', 'Bipe simples'], ['arquivo', 'Meu arquivo (sounds/alerta.mp3)']]
        .map(([v, r]) => el('option', { value: v, selected: c.somAlerta === v }, r)));
    const botaoOuvir = el('button', {
      type: 'button', class: 'botao botao-sec',
      onClick: async () => {
        const r = await ouvirSom(cfg().somAlerta);
        if (r.usouFallback) toast('Não encontrei o arquivo em sounds/. Toquei o gongo no lugar. Veja sounds/LEIA-ME.md.', { duracao: 7000 });
      },
    }, 'Ouvir');
    estiloSom.addEventListener('change', () => { cfg().somAlerta = estiloSom.value; persistir(); botaoOuvir.click(); });
    const linhaSom = el('div', { class: 'linha-som' },
      el('div', { class: 'campo' }, el('label', { for: 'ajuste-som-estilo' }, 'Som do alerta'), estiloSom), botaoOuvir);

    // descanso
    const descanso = el('input', { id: 'ajuste-descanso', type: 'number', inputmode: 'numeric', min: 5, max: 900, step: 5, value: c.descansoPadrao });
    descanso.addEventListener('change', () => {
      const v = Math.floor(Number(descanso.value));
      cfg().descansoPadrao = Number.isFinite(v) ? Math.min(900, Math.max(5, v)) : 90;
      descanso.value = cfg().descansoPadrao;
      persistir();
    });

    // arquivos
    const arquivo = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'Escolher arquivo de backup' });
    arquivo.addEventListener('change', async () => {
      const f = arquivo.files?.[0];
      arquivo.value = '';
      if (!f) return;
      try {
        if (f.size > LIMITE_IMPORTACAO) throw new ErroValidacao('Arquivo grande demais (limite de 5 MB).');
        const importado = lerImportacao(await f.text());
        const { estado, resumo } = mesclar(store.obter(), importado);
        if (!store.substituir(estado)) toast('Não foi possível salvar os dados importados neste navegador.');
        atualizarTudo();
        const partes = [
          resumo.pesos && `${resumo.pesos} pesos`,
          resumo.medidas && `${resumo.medidas} medidas`,
          resumo.rotinas && `${resumo.rotinas} rotinas`,
          resumo.treinos && `${resumo.treinos} treinos`,
        ].filter(Boolean);
        toast(partes.length ? `Importado: ${partes.join(', ')}.` : 'Nada novo para importar: esses dados já estavam aqui.', { duracao: 6000 });
      } catch (e) {
        if (e instanceof ErroValidacao) toast(e.message, { duracao: 6000 });
        else { console.error(e); toast('Não foi possível ler o arquivo.'); }
      }
    });

    const estadoInstalacao = el('div', { class: 'ajuste-bloco' });
    const desenharInstalacao = () => {
      if (pwa.jaInstalado()) {
        estadoInstalacao.replaceChildren(el('p', { class: 'suave' }, 'O app já está instalado neste aparelho.'));
      } else if (pwa.podeInstalar()) {
        estadoInstalacao.replaceChildren(
          el('button', { type: 'button', class: 'botao botao-sec botao-bloco', onClick: () => pwa.instalar() }, 'Instalar o app'),
          el('p', { class: 'dica' }, 'Abre em tela cheia e funciona sem internet.'));
      } else if (pwa.ehIOS()) {
        estadoInstalacao.replaceChildren(el('p', { class: 'dica' }, 'No iPhone ou iPad: toque em Compartilhar e depois em "Adicionar à Tela de Início".'));
      } else {
        estadoInstalacao.replaceChildren(el('p', { class: 'dica' }, 'Para instalar, use a opção "Instalar app" ou "Adicionar à tela inicial" do menu do navegador.'));
      }
    };
    desenharInstalacao();
    cancelarInstalacao?.();
    cancelarInstalacao = pwa.aoMudarInstalacao(desenharInstalacao);

    const armazenamento = el('p', { class: 'dica' }, '');
    pwa.armazenamentoPersistente().then((r) => {
      armazenamento.textContent = r === 'sim'
        ? 'Armazenamento protegido: o navegador não apaga seus dados automaticamente.'
        : r === 'nao'
          ? 'Os dados ficam só neste navegador e podem ser apagados se faltar espaço. Faça backups.'
          : 'Os dados ficam só neste navegador. Faça backups.';
    });

    painel.replaceChildren(
      el('h2', { tabindex: '-1' }, 'Ajustes'),

      el('div', { class: 'bloco' }, el('h3', {}, 'Aparência'),
        el('div', { class: 'campo' }, el('label', { for: 'ajuste-tema' }, 'Tema'), tema)),

      el('div', { class: 'bloco' }, el('h3', {}, 'Timer e alertas'),
        interruptor('aj-som', 'Som', 'Toca um aviso a cada fase e no fim.', c.som, (v) => { cfg().som = v; persistir(); }),
        linhaSom,
        interruptor('aj-vib', 'Vibração', 'Funciona em celulares Android.', c.vibracao, (v) => { cfg().vibracao = v; persistir(); }),
        interruptor('aj-notif', 'Notificação', 'Avisa quando o app está em segundo plano.', c.notificacao, async (v, caixa) => {
          if (!v) { cfg().notificacao = false; persistir(); return; }
          const r = await pedirPermissaoNotificacao();
          if (r === 'granted') { cfg().notificacao = true; persistir(); return; }
          caixa.checked = false;
          cfg().notificacao = false;
          persistir();
          toast(r === 'indisponivel'
            ? 'Este navegador não oferece notificações.'
            : 'Permissão negada. Libere as notificações nas configurações do navegador.', { duracao: 6000 });
        }),
        interruptor('aj-tela', 'Manter a tela ligada', 'Enquanto o timer estiver rodando.', c.telaAcesa, (v) => { cfg().telaAcesa = v; persistir(); }),
        interruptor('aj-auto', 'Descanso automático', 'Ao concluir uma série no treino, o descanso começa sozinho.', c.descansoAuto, (v) => { cfg().descansoAuto = v; persistir(); }),
        el('div', { class: 'campo' }, el('label', { for: 'ajuste-descanso' }, 'Duração do descanso automático (segundos)'), descanso)),

      el('div', { class: 'bloco' }, el('h3', {}, 'Seus dados'),
        el('p', { class: 'dica' }, 'Tudo fica salvo neste aparelho. Exporte um backup de vez em quando.'),
        el('div', { class: 'botoes-coluna' },
          el('button', { type: 'button', class: 'botao botao-sec', onClick: () => baixarArquivo(`meu-treino-backup-${hojeISO()}.json`, gerarJSON(store.obter()), 'application/json') }, 'Exportar backup completo (JSON)'),
          el('button', { type: 'button', class: 'botao botao-sec', onClick: () => baixarArquivo(`meu-treino-pesos-${hojeISO()}.csv`, gerarCSVPesos(store.obter().pesos), 'text/csv;charset=utf-8') }, 'Exportar pesos (CSV)'),
          el('button', { type: 'button', class: 'botao botao-sec', onClick: () => baixarArquivo(`meu-treino-treinos-${hojeISO()}.csv`, gerarCSVTreinos(store.obter().historico), 'text/csv;charset=utf-8') }, 'Exportar treinos (CSV)'),
          el('button', { type: 'button', class: 'botao botao-sec', onClick: () => arquivo.click() }, 'Importar backup (JSON)'),
          arquivo),
        el('p', { class: 'dica' }, 'Importar mescla com o que já existe: nada é apagado.'),
        armazenamento,
        el('button', {
          type: 'button', class: 'botao-texto perigo',
          onClick: () => {
            if (!confirm('Apagar TODOS os dados deste aparelho (pesos, medidas, rotinas e histórico)? Essa ação não pode ser desfeita. Exporte um backup antes se quiser guardar.')) return;
            relogio.zerar();
            store.apagarTudo();
            store.salvar();
            aplicarTema();
            atualizarTudo();
            toast('Todos os dados foram apagados.');
          },
        }, 'Apagar todos os dados')),

      el('div', { class: 'bloco' }, el('h3', {}, 'Aplicativo'), estadoInstalacao,
        el('p', { class: 'suave versao' }, `Meu treino, versão ${VERSAO_APP}`)),
    );
  }

  renderizar();
  return { renderizar };
}
