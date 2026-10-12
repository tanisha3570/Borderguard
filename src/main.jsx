import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('BorderGuard UI Error Boundary Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#FFF5F5', color: '#C53030', minHeight: '100vh' }}>
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>Application Runtime Error</h2>
          <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 6, border: '1px solid #FED7D7', marginBottom: 20, color: '#1A202C' }}>
            <strong>{this.state.error && this.state.error.toString()}</strong>
            <pre style={{ marginTop: 12, fontSize: 12, overflowX: 'auto' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#1E3A5F', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
