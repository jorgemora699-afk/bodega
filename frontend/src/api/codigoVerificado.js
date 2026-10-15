const CLAVE = "pa_codigo_verificado";

// Cuánto dura la verificación sin usarla. Cámbialo a tu gusto.
const DURACION_MS = 40 * 60 * 1000; // 40 minutos

export function leerTrabajadoraVerificada() {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (!raw) return null;

    const { trabajadora, expira } = JSON.parse(raw);

    if (!trabajadora || !expira || Date.now() > expira) {
      sessionStorage.removeItem(CLAVE);
      return null;
    }

    return trabajadora;
  } catch {
    return null;
  }
}

/* Guarda (o renueva) la verificación: vuelve a contar los 15 minutos
   desde este momento. */
export function guardarTrabajadoraVerificada(trabajadora) {
  try {
    sessionStorage.setItem(
      CLAVE,
      JSON.stringify({ trabajadora, expira: Date.now() + DURACION_MS })
    );
  } catch {
    /* si el storage no está disponible, simplemente pedirá el código cada vez */
  }
}

export function olvidarTrabajadoraVerificada() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* se ignora */
  }
}