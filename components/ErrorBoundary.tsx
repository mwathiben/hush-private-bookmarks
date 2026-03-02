import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { captureException } from '@/lib/sentry';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

const GITHUB_ISSUE_URL =
  'https://github.com/mwathiben/hush-private-bookmarks/issues/new';

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    captureException(error);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  private handleReport = (): void => {
    window.open(GITHUB_ISSUE_URL, '_blank', 'noopener');
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            An unexpected error occurred. Your bookmarks are safe.
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleReport}
              >
                Report Bug
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
