/**
 * ErrorBoundary genérico: si el subárbol lanza al renderizar (p. ej. HTML
 * inesperado que rompa el parser del blog), pinta el `fallback` en vez de
 * tumbar la pantalla entera. Sin estado global ni side effects: cada montaje
 * aísla su propio subárbol.
 */
import React from "react";

type Props = { fallback: React.ReactNode; children: React.ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    if (__DEV__) console.warn("[ErrorBoundary] render del subárbol falló:", error);
  }

  render(): React.ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
