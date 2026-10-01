
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("=================================");
    console.error("ERROR EN LA APLICACIÓN");
    console.error("Mensaje:", error?.message);
    console.error("Error:", error);
    console.error("Stack:", error?.stack);
    console.error("React:", errorInfo?.componentStack);
    console.error("=================================");

    this.setState({
      error,
      errorInfo,
    });
  }

  copiarError = async () => {
    const { error, errorInfo } = this.state;

    const texto = `
ERROR DE LA APLICACIÓN

Mensaje:
${error?.message || String(error)}

Stack:
${error?.stack || "No disponible"}

Componente:
${errorInfo?.componentStack || "No disponible"}
`;

    try {
      await navigator.clipboard.writeText(texto);

      alert(
        "Error copiado. Ahora puedes pegarlo y enviármelo."
      );
    } catch {
      alert(
        "No se pudo copiar automáticamente. Haz una captura de pantalla."
      );
    }
  };

  recargar = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo } = this.state;

    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          boxSizing: "border-box",
          padding: "20px",
          background: "#ffffff",
          color: "#111111",
          fontFamily: "Arial, sans-serif",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#b91c1c",
              color: "#ffffff",
              padding: "18px",
              borderRadius: "12px",
              marginBottom: "16px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "22px",
              }}
            >
              ⚠️ Error de la aplicación
            </h1>

            <p style={{ marginBottom: 0 }}>
              La pantalla encontró un error y no pudo
              continuar.
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Mensaje del error
            </h2>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f5f5f5",
                padding: "12px",
                borderRadius: "8px",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              {error?.message || String(error)}
            </pre>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Stack del error
            </h2>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f5f5f5",
                padding: "12px",
                borderRadius: "8px",
                fontSize: "11px",
                overflowX: "auto",
              }}
            >
              {error?.stack || "No disponible"}
            </pre>
          </div>

          {errorInfo?.componentStack && (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                Componente
              </h2>

              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#f5f5f5",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  overflowX: "auto",
                }}
              >
                {errorInfo.componentStack}
              </pre>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={this.copiarError}
              style={{
                padding: "12px 18px",
                border: "none",
                borderRadius: "8px",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "15px",
              }}
            >
              📋 Copiar error
            </button>

            <button
              onClick={this.recargar}
              style={{
                padding: "12px 18px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#111111",
                fontSize: "15px",
              }}
            >
              🔄 Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
