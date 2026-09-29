import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  onError?: (error: Error) => void
  label?: string
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Isolates asset failures: a broken GLB renders its fallback instead of crashing the scene. */
export class AssetErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`[assets] ${this.props.label ?? 'asset'} failed to load — using fallback.`, error.message, info.componentStack?.split('\n')[1] ?? '')
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
