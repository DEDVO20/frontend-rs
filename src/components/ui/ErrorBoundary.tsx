import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div role="alert" className="rounded-xl border border-current/20 p-4">
        <p>No pudimos mostrar esta sección.</p>
        <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => this.setState({ failed: false })}>
          Reintentar
        </button>
      </div>
    )
  }
}
