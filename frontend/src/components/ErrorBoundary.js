import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { fallback, pageName } = this.props;
    if (fallback) return fallback;

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '300px', padding: '40px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>
            {pageName ? `Помилка в «${pageName}»` : 'Щось пішло не так'}
          </div>
          <div style={{
            fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono',
            marginBottom: '20px', wordBreak: 'break-word',
          }}>
            {this.state.error?.message || 'Невідома помилка'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: '#fff',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            }}
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;