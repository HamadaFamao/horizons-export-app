import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { hasError: false, err: null };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }

  componentDidCatch(err, info) {
    console.error("App crash:", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, margin: 'auto', maxWidth: '800px', fontFamily: 'sans-serif', backgroundColor: '#fff5f5', border: '1px solid #fecaca', borderRadius: '8px' }}>
          <h2 style={{ color: '#b91c1c', borderBottom: '1px solid #fecaca', paddingBottom: '8px' }}>Something went wrong.</h2>
          <p>We've encountered an unexpected error. Please try refreshing the page.</p>
          <details style={{ marginTop: '16px', background: '#fee2e2', padding: '8px', borderRadius: '4px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '8px', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
              {String(this.state.err)}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}