// framePlate/components/FramePlateErrorBoundary.tsx
//
// Last line of defense: if anything inside the chart throws during render
// (a bug in a future custom bulb shape, a malformed session object that
// slipped past validation, etc.), this catches it, logs full details to the
// console, and shows a small inline message instead of taking down
// whatever page embeds the chart.
"use client";

import * as React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class FramePlateErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[framePlate] Uncaught render error — chart replaced with fallback message.", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, borderRadius: 8, border: "1px dashed #f66", color: "#f66", fontSize: 13 }}>
          FramePlate chart failed to render ({this.state.error.message}). Details logged to the console.
        </div>
      );
    }
    return this.props.children;
  }
}
