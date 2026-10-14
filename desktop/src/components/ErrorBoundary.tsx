import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Etiqueta corta de la sección (p.ej. "Blog") para el mensaje. */
  label?: string;
  /** Texto del botón de reintento. Por defecto "Reintentar". */
  retryLabel?: string;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * Límite de error de React: captura excepciones lanzadas durante el render de
 * sus hijos y, en vez de desmontar TODO el árbol (pantalla en blanco), muestra
 * el mensaje del error con un botón para reintentar. Antes el desktop no tenía
 * ninguno, así que cualquier throw en render dejaba la app en blanco sin pista
 * de la causa. El mensaje se imprime también en consola para depurar.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Deja el stack completo en la consola del renderer para diagnosticar.
    console.error("[ErrorBoundary] render error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label, retryLabel } = this.props;
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold text-error">
          {label ? `${label}: ` : ""}
          {error.message || "Se produjo un error inesperado."}
        </p>
        <button type="button" className="btn btn-sm btn-outline" onClick={this.reset}>
          {retryLabel ?? "Reintentar"}
        </button>
      </div>
    );
  }
}
