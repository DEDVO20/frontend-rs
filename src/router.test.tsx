// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { router } from './router'

vi.mock('@/pages/LandingPage', () => ({ LandingPage: () => <h1>Landing</h1> }))
vi.mock('@/pages/TermsPage', () => ({
  TermsPage: () => { throw new Error('Error de ruta de prueba') },
}))

afterEach(cleanup)

it('redirige al login al abrir un enlace privado sin sesión', async () => {
  render(<RouterProvider router={router} />)
  await act(async () => { await router.navigate('/app/siigo/balance') })

  expect(await screen.findByRole('heading', { name: /bienvenido/i })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/login')
})

it('muestra una pantalla recuperable si una ruta no se puede renderizar', async () => {
  render(<RouterProvider router={router} />, { onCaughtError: () => {} })
  await act(async () => { await router.navigate('/terminos-y-condiciones') })

  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/')
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
})
