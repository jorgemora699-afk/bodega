export default function CampoMoneda({
  value,
  onChange,
  placeholder = "0",
  maxDigits = 9,
  id,
  autoFocus = false,
}) {
  function manejarCambio(e) {
    const soloDigitos = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
    onChange(soloDigitos);
  }

  return (
    <div className="campo-moneda">
      <span className="campo-moneda-simbolo">$</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value ? Number(value).toLocaleString("es-CO") : ""}
        onChange={manejarCambio}
      />
    </div>
  );
}