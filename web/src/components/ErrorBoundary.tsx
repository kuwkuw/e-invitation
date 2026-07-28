import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered in place of `children` once a descendant throws while rendering. */
  fallback: ReactNode;
  /** Changing this forgets the error and gives the tree another go. Without it
   *  a caught crash outlives every later navigation: React unmounted the
   *  children, so nothing downstream can ever clear the state on its own. */
  resetKey?: string;
}

interface State {
  failed: boolean;
  /** The `resetKey` this state was derived from, so a change is detectable. */
  seenKey: string | undefined;
}

/**
 * The app's only guard against a render-time throw. React unmounts the whole
 * tree when one goes uncaught, which on a single-page app means a blank
 * `<body>` and a console warning no one will read — so every route sits behind
 * this (see `AppRoutes`).
 *
 * A plain class boundary is the only option here: declarative react-router-dom
 * has no `errorElement` (adr-011 §1), and hooks cannot catch render errors.
 * It deliberately holds no copy of its own — the caller passes the fallback, so
 * the guest and host sides can say different things.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, seenKey: undefined };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.resetKey === state.seenKey) return null;
    return { failed: false, seenKey: props.resetKey };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // There is no client error reporting yet, so the console is the only trace
    // a bug report can carry back. React logs the error itself; the component
    // stack is what says which screen it came from.
    console.error("Render error caught by the app boundary", error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
