let utteranceActual = null; // referencia persistente — evita que Chrome la recolecte a mitad de camino
let vozDesbloqueada = false;

/**
 * Debe llamarse una sola vez, dentro de un evento de clic/toque real del
 * usuario (por ejemplo, al entrar a la pantalla y tocar "Activar sonido").
 * Esto "desbloquea" la síntesis de voz en Chrome para el resto de la sesión —
 * sin esto, speak() llamado después desde un setInterval puede no sonar nunca.
 */
export function desbloquearVoz() {
  try {
    if (!window.speechSynthesis || vozDesbloqueada) return;

    // Decir un mensaje corto para que el usuario sepa que la voz ya funciona
    const utterance = new SpeechSynthesisUtterance("Sonido activado");
    utterance.lang = "es-CO";
    utterance.volume = 0.8;
    
    window.speechSynthesis.speak(utterance);
    vozDesbloqueada = true;
  } catch {
    // se ignora
  }
}

export function reproducirNotificacion() {
  reproducirTono();
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
      window.speechSynthesis.cancel(); // limpia cualquier cola atascada de un intento anterior

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-CO";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voces = window.speechSynthesis.getVoices();
      const vozEnEspanol = voces.find((v) => v.lang?.toLowerCase().startsWith("es"));
      if (vozEnEspanol) utterance.voice = vozEnEspanol;

      utterance.onerror = (e) => console.warn("Error al reproducir voz:", e.error);

      utteranceActual = utterance; // mantiene viva la referencia mientras habla
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      hablar();
    } else {
      window.speechSynthesis.onvoiceschanged = hablar;
    }
  } catch {
    // se ignora
  }
}