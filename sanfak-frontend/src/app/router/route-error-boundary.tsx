import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from '@/shared/ui';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route crashed:', error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="This page crashed"
          subTitle={this.state.error.message}
          extra={
            <Button type="primary" onClick={this.reset}>
              Try again
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
