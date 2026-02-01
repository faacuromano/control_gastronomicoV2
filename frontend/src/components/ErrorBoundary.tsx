import { Component, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
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

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>Algo salio mal</h2>
                    <p style={{ color: '#666', marginBottom: '1rem' }}>
                        {this.state.error?.message || 'Error inesperado'}
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #ccc',
                            cursor: 'pointer',
                            backgroundColor: '#f5f5f5',
                        }}
                    >
                        Recargar pagina
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
