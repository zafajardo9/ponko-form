import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ponkoform-error-boundary] Render failed", error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-8"
        >
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#141413]">
              Something went wrong
            </h2>
            <p className="mt-1 text-sm text-[#141413]/60">
              An unexpected error occurred. Please try again.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md bg-[#cc785c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#cc785c]/90 focus:outline-none focus:ring-2 focus:ring-[#cc785c]/50"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-[#6c6a64] underline underline-offset-2 hover:text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#cc785c]/50"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
