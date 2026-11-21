import { Link } from 'react-router-dom'

export function ErrorScreen() {
  return (
    <section role="alert" className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p>No pudimos mostrar esta pantalla.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="rounded-lg bg-primary-600 px-4 py-2 text-white" onClick={() => window.location.reload()}>
          Reintentar
        </button>
        <Link className="rounded-lg border border-current px-4 py-2" to="/">Volver al inicio</Link>
      </div>
    </section>
  )
}
