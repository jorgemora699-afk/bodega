/**
 * Avisa de un pedido nuevo con un tono de dos notas (más largo y notorio
 * que un beep simple) seguido de un anuncio por voz ("Nuevo pedido de
 * Arte Frío"). Ninguna de las dos partes depende de un archivo de audio,
 * así que no hay ningún asset que pueda faltar.
 *
 * Si el navegador bloquea el audio por falta de interacción previa del
 * usuario, o no soporta alguna de las dos APIs, simplemente no suena —
 * nunca rompe el resto de la pantalla.
 */
export function reproducirNotificacion() {
  reproducirTono();

  // Pequeño retraso para que la voz empiece justo cuando termina el tono,
  // en vez de solaparse con él.
  setTimeout(() => anunciarVoz("Nuevo pedido de Arte Frío"), 400);
}

function reproducirTono() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const notas = [660, 880]; // dos tonos ascendentes — más perceptible que uno solo

    notas.forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = frecuencia;

      const inicio = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.35, inicio + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(inicio);
      osc.stop(inicio + 0.32);
    });

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Se ignora — el tono es un extra, nunca debe bloquear la pantalla.
  }
}

function anunciarVoz(texto) {
  try {
    if (!window.speechSynthesis) return;

    const hablar = () => {
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-CO";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voces = window.speechSynthesis.getVoices();
      const vozEnEspanol = voces.find((v) => v.lang?.toLowerCase().startsWith("es"));
      if (vozEnEspanol) utterance.voice = vozEnEspanol;

      window.speechSynthesis.speak(utterance);
    };

    // En algunos navegadores (sobre todo Chrome, la primera vez que se usa)
    // las voces se cargan de forma asíncrona — si todavía no están listas,
    // se espera al evento antes de intentar hablar.
    if (window.speechSynthesis.getVoices().length > 0) {
      hablar();
    } else {
      window.speechSynthesis.onvoiceschanged = hablar;
    }
  } catch {
    // Se ignora — el anuncio por voz es un extra, nunca debe bloquear la pantalla.
  }
}