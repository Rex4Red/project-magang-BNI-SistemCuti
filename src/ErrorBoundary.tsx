import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled runtime error in React component tree:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="boot" style={{ padding: 24, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="bni-logo"><img src="/images/bni-logo.png" alt="BNI" /></span>
          <h2 style={{ color: '#005e54', marginTop: 16, fontSize: 20 }}>Terjadi Kendala Memuat Tampilan</h2>
          <p style={{ color: '#5a737c', maxWidth: 460, margin: '8px auto 20px', fontSize: 14 }}>
            {this.state.error?.message || 'Terjadi kesalahan sistem saat memproses halaman.'}
          </p>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Muat ulang halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
