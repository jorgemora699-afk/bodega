const CLAVE_PREFERENCIA = "pa_notif_sonido_activo";

let utteranceActual = null; // referencia persistente — evita que Chrome la recolecte a mitad de camino
let vozDesbloqueada = false;

/* =========================
   PREFERENCIA GUARDADA
   ========================= */

export function sonidoActivoGuardado() {
  try {
    return localStorage.getItem(CLAVE_PREFERENCIA) === "1";
  } catch {
    return false;
  }
}

export function guardarPreferenciaSonido(activo) {
  try {
    localStorage.setItem(CLAVE_PREFERENCIA, activo ? "1" : "0");
  } catch {
    // se ignora
  }
}

/**
 * Desbloquea la síntesis de voz del navegador para el resto de esta
 * sesión de página. Debe llamarse dentro de un evento de clic/toque real
 * del usuario — sin eso, speak() llamado después desde un setInterval
 * puede no sonar nunca en algunos navegadores (sobre todo Chrome).
 *
 * `anunciar = true` dice en voz alta "Sonido activado" (para cuando el
 * usuario toca el botón a propósito). `anunciar = false` desbloquea en
 * silencio (para el desbloqueo automático con el primer toque en
 * cualquier parte de la pantalla, donde no queremos sorprender a nadie
 * con una voz inesperada).
 */
export function desbloquearVoz(anunciar = true) {
  try {
    if (!window.speechSynthesis || vozDesbloqueada) return;

    const texto = anunciar ? "Sonido activado" : " ";
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "es-CO";
    utterance.volume = anunciar ? 0.8 : 0;

    window.speechSynthesis.speak(utterance);
    vozDesbloqueada = true;
  } catch {
    // se ignora
  }
}

/* =========================
   NOTIFICACIÓN DE PEDIDO NUEVO
   ========================= */

export function reproducirNotificacion() {
  if (!sonidoActivoGuardado()) return; // el usuario lo tiene silenciado

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