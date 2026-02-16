import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error: error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
        try {
            this.logErrorToBackend(error, errorInfo);
        } catch (e) {
            console.error('Failed to log error to backend:', e);
        }
    }

    private logErrorToBackend = async (error: Error, errorInfo: ErrorInfo) => {
        try {
            const backendUrl = (window as any).electronAPI?.getBackendUrl?.() ||
                localStorage.getItem('backendUrl') ||
                'http://localhost:3334';

            await fetch(`${backendUrl}/auth/debug/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Frontend Crash (ErrorBoundary)',
                    data: {
                        error: error.message,
                        stack: error.stack,
                        componentStack: errorInfo.componentStack
                    }
                })
            });
        } catch (e) {
            // Ignore logging failures during crash
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    backgroundColor: '#1a1b1c',
                    color: '#D1D9E0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                    <div style={{
                        maxWidth: '600px',
                        width: '100%',
                        backgroundColor: '#252525',
                        border: '1px solid #ff4444',
                        borderRadius: '8px',
                        padding: '2rem',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                    }}>
                        <h1 style={{ color: '#ff4444', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>⚠️</span>
                            <span>Anwendungsfehler</span>
                        </h1>

                        <p style={{ fontSize: '1.1rem', lineHeight: '1.5' }}>
                            Es ist ein unerwarteter Fehler aufgetreten.
                        </p>

                        <div style={{
                            backgroundColor: '#111',
                            padding: '1rem',
                            borderRadius: '4px',
                            overflowX: 'auto',
                            margin: '1.5rem 0',
                            border: '1px solid #333',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem'
                        }}>
                            <p style={{ color: '#ff4444', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                                {this.state.error?.toString()}
                            </p>
                            {this.state.errorInfo && (
                                <pre style={{ margin: 0, color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    localStorage.clear();
                                    window.location.reload();
                                }}
                                style={{
                                    backgroundColor: '#333',
                                    color: '#fff',
                                    border: '1px solid #555',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Reset & Reload
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    backgroundColor: '#A330C9',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Neu laden
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
