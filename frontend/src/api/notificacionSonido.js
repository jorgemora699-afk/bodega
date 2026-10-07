/**
 * Reproduce un beep corto (sin depender de ningún archivo de audio).
 * Si el navegador bloquea el audio por falta de interacción previa del
 * usuario, simplemente no suena — nunca rompe el resto de la pantalla.
 */
export function reproducirNotificacion() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880;

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // Se ignora — el sonido es un extra, nunca debe bloquear la pantalla.
  }
}