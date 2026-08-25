import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h2 className="text-lg font-semibold text-fg">
            Что-то пошло не так
          </h2>
          <p className="text-sm text-fg-mid">
            Страница упала с ошибкой. Попробуйте перезагрузить.
          </p>
          {this.state.error && (
            <pre className="text-xs font-mono text-left text-danger bg-bg-cell border border-line px-3 py-2 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 bg-accent hover:bg-accent-light text-bg text-sm font-medium"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    )
  }
}
