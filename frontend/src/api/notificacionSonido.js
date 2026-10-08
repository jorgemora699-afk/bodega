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

/**
 * Diagnóstico: revisa si el dispositivo tiene algún motor de voz instalado.
 */
function diagnosticarVoces() {
  try {
    if (!window.speechSynthesis) {
      console.warn("[notificacionSonido] Este navegador no soporta speechSynthesis en absoluto.");
      return;
    }
    const voces = window.speechSynthesis.getVoices();
    console.info(
      `[notificacionSonido] Voces disponibles en este dispositivo: ${voces.length}`,
      voces.map((v) => `${v.name} (${v.lang})`)
    );
    if (voces.length === 0) {
      console.warn(
        "[notificacionSonido] Este dispositivo no tiene ningún motor de texto a voz instalado. " +
          "El anuncio por voz nunca va a sonar aquí — revisa la configuración de accesibilidad " +
          "del sistema (Texto a voz / Text-to-Speech) e instala un paquete de voces."
      );
    }
  } catch {
    // se ignora
  }
}

/* =========================
   NOTIFICACIÓN DE PEDIDO NUEVO
   ========================= */

export function reproducirNotificacion() {
  if (!sonidoActivoGuardado()) return; // el usuario lo tiene silenciado

  // La sirena NO depende de ningún motor de voz — suena igual en
  // cualquier dispositivo, es la alerta principal y confiable.
  const duracionSirenaMs = reproducirSirena();

  // El anuncio por voz es un extra, empieza justo cuando termina la sirena.
  setTimeout(() => anunciarVoz("Nuevo pedido de Arte Frío"), duracionSirenaMs + 200);
}

/**
 * Alerta larga hecha solo con tonos (sin depender de ningún motor de voz
 * del sistema): una secuencia de tres notas que se repite varias veces,
 * subiendo de tono en cada repetición para transmitir urgencia creciente.
 * Dura unos 7-8 segundos en total — pensada para notarse incluso con
 * ruido de cocina de fondo. Devuelve la duración total en milisegundos.
 */
function reproducirSirena() {
  const REPETICIONES = 6;
  const NOTAS_BASE = [523, 659, 784]; // Do-Mi-Sol
  const DURACION_NOTA = 0.22;
  const ESPACIADO_NOTA = DURACION_NOTA * 0.85;
  const PAUSA_ENTRE_REPETICIONES = 0.28;
  const DURACION_CICLO = NOTAS_BASE.length * ESPACIADO_NOTA + PAUSA_ENTRE_REPETICIONES;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return 0;

    const ctx = new AudioContextClass();

    for (let rep = 0; rep < REPETICIONES; rep++) {
      // Cada repetición sube medio tono, para que suene cada vez más urgente
      // en vez de repetitivo y monótono.
      const factorTono = 1 + rep * 0.03;
      const offsetBase = rep * DURACION_CICLO;

      NOTAS_BASE.forEach((frecuencia, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square"; // más penetrante que "sine", se nota más con ruido de fondo
        osc.frequency.value = frecuencia * factorTono;

        const inicio = ctx.currentTime + offsetBase + i * ESPACIADO_NOTA;
        gain.gain.setValueAtTime(0.0001, inicio);
        gain.gain.exponentialRampToValueAtTime(0.3, inicio + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, inicio + DURACION_NOTA);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(inicio);
        osc.stop(inicio + DURACION_NOTA + 0.02);
      });
    }

    const duracionTotalSegundos = REPETICIONES * DURACION_CICLO;
    setTimeout(() => ctx.close(), duracionTotalSegundos * 1000 + 300);

    return duracionTotalSegundos * 1000;
  } catch {
    // Se ignora — el tono es un extra, nunca debe bloquear la pantalla.
    return 0;
  }
}

function anunciarVoz(texto) {
  try {
    if (!window.speechSynthesis) return;

    diagnosticarVoces();

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

      utteranceActual = utterance;
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      hablar();
      return;
    }

    let intentos = 0;
    const intervalo = setInterval(() => {
      intentos += 1;
      const voces = window.speechSynthesis.getVoices();

      if (voces.length > 0) {
        clearInterval(intervalo);
        hablar();
      } else if (intentos >= 8) {
        clearInterval(intervalo);
        console.warn(
          "[notificacionSonido] No se detectaron voces tras varios intentos — " +
            "este dispositivo no puede anunciar por voz, solo sonará la sirena."
        );
      }
    }, 250);

    window.speechSynthesis.onvoiceschanged = hablar;
  } catch {
    // se ignora
  }
}