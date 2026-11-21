// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(cleanup)

it('mantiene las demás secciones visibles y permite recuperar la que falló', () => {
  let failed = true
  function Chart() {
    if (failed) throw new Error('Error de render de prueba')
    return <p>Gráfica recuperada</p>
  }

  render(
    <>
      <ErrorBoundary><Chart /></ErrorBoundary>
      <p>Otra sección del dashboard</p>
    </>,
    { onCaughtError: () => {} },
  )

  expect(screen.getByRole('alert').textContent).toContain('No pudimos mostrar esta sección')
  expect(screen.getByText('Otra sección del dashboard')).toBeTruthy()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(screen.getByText('Gráfica recuperada')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
