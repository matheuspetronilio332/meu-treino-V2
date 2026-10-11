// Controlador do timer: liga o motor (timer.js) aos efeitos (som, vibração, tela ligada)
// e avisa quem estiver ouvindo (tela do Timer, mini-barra, treinos).

import { Temporizador, montarFasesSimples, montarFasesIntervalo } from './timer.js';
import * as alertas from './alertas.js';
import * as tela from './tela-acesa.js';

export function criarRelogio({ obterConfig }) {
  const motor = new Temporizador();
  const ouvintes = new Set();
  const ouvintesEvento = new Set();
  let laco = null;

  const emitir = () => {
    const s = motor.snapshot();
    ouvintes.forEach((f) => f(s));
  };
  const evento = (mensagem) => ouvintesEvento.forEach((f) => f(mensagem));

  const ligarLaco = () => {
    if (laco) return;
    laco = setInterval(() => {
      motor.tick();
      emitir();
    }, 250);
  };
  const desligarLaco = () => {
    clearInterval(laco);
    laco = null;
  };
  const telaLigada = () => tela.manter(obterConfig().telaAcesa);

  motor.onFase = (fase) => {
    const detalhe = fase.rounds > 1 ? `Rodada ${fase.round} de ${fase.rounds}` : 'Hora de continuar';
    alertas.avisar('fase', { config: obterConfig(), titulo: fase.rotulo, corpo: detalhe });
    evento(fase.rounds > 1 ? `${fase.rotulo}, rodada ${fase.round} de ${fase.rounds}` : fase.rotulo);
  };
  motor.onFim = () => {
    desligarLaco();
    tela.manter(false);
    alertas.avisar('fim', { config: obterConfig(), titulo: 'Tempo concluído', corpo: 'Seu timer terminou.' });
    evento('Tempo concluído');
  };

  function iniciar(fases) {
    if (!fases.length) return false;
    alertas.destravar();
    motor.configurar(fases);
    motor.iniciar();
    ligarLaco();
    telaLigada();
    evento('Timer iniciado');
    emitir();
    return true;
  }

  // Ao voltar para o app (ex.: desbloquear o celular) recalcula na hora, sem esperar o próximo tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      motor.tick();
      emitir();
    }
  });

  return {
    iniciarSimples: (segundos, rotulo = 'Tempo', tipo = 'trabalho') => iniciar(montarFasesSimples(segundos, rotulo, tipo)),
    iniciarIntervalado: (cfg) => iniciar(montarFasesIntervalo(cfg)),
    pausar() {
      motor.pausar();
      desligarLaco();
      tela.manter(false);
      evento('Timer pausado');
      emitir();
    },
    retomar() {
      alertas.destravar();
      motor.retomar();
      ligarLaco();
      telaLigada();
      evento('Timer retomado');
      emitir();
    },
    zerar() {
      motor.zerar();
      desligarLaco();
      tela.manter(false);
      evento('Timer zerado');
      emitir();
    },
    snapshot: () => motor.snapshot(),
    assinar(f) {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    ouvirEventos(f) {
      ouvintesEvento.add(f);
      return () => ouvintesEvento.delete(f);
    },
  };
}
