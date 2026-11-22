import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

function parseErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
    if (parsed && typeof parsed.error === 'string') {
      return `${parsed.error}${parsed.path ? ` (${parsed.operationType ?? 'op'} on ${parsed.path})` : ''}`;
    }
  } catch {
    // Not JSON
  }
  return raw;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: parseErrorMessage(error.message || 'An unexpected error occurred.'),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application error boundary caught:', error, info);
  }

  handleRecover = (): void => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0E1117] text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#161B24] border border-white/10 rounded-xl p-8 space-y-5">
            <h1 className="font-display text-2xl font-bold text-amber-400">
              Table Interrupted
            </h1>
            <p className="text-sm text-stone-300 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleRecover}
              className="px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
