// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import { AcceptInvitationPage } from './AcceptInvitationPage'

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  isAxiosError: () => false,
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

const token = 'a723af18-4ad7-4af5-a34f-094ddecd8120'
const email = 'invite@example.test'
function renderInvitation(requiresLogin: boolean) {
  vi.mocked(axios.get).mockResolvedValue({
    data: { valid: true, email, companyName: 'Empresa A', fullName: 'Ana', requiresLogin },
  })
  vi.mocked(axios.post).mockResolvedValue({ data: { ok: true } })
  return render(
    <MemoryRouter initialEntries={[`/invitations/accept?token=${token}`]}>
      <AcceptInvitationPage />
    </MemoryRouter>,
  )
}

it('autentica la cuenta existente y envía la aceptación sin una nueva contraseña', async () => {
  renderInvitation(true)
  const input = await screen.findByPlaceholderText('Tu contraseña actual')
  fireEvent.change(input, { target: { value: 'actual-password' } })
  fireEvent.click(screen.getByRole('button', { name: /iniciar sesión y aceptar/i }))

  expect(await screen.findByRole('heading', { name: 'Invitación aceptada' })).toBeTruthy()
  expect(axios.post).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/auth\/login$/), {
    email, password: 'actual-password',
  }, { withCredentials: true })
  expect(axios.post).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/auth\/invitations\/accept$/), {
    token, email, fullName: 'Ana',
  }, { withCredentials: true })
})

it('conserva el registro de una cuenta nueva sin exigir una sesión', async () => {
  renderInvitation(false)
  fireEvent.change(await screen.findByPlaceholderText('Mínimo 6 caracteres'), { target: { value: 'new-password' } })
  fireEvent.change(screen.getByPlaceholderText('Repite tu contraseña'), { target: { value: 'new-password' } })
  fireEvent.click(screen.getByRole('button', { name: /crear mi cuenta/i }))

  expect(await screen.findByRole('heading', { name: /cuenta creada/i })).toBeTruthy()
  expect(axios.post).toHaveBeenCalledTimes(1)
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/invitations\/accept$/), {
    token, email, password: 'new-password', fullName: 'Ana',
  }, { withCredentials: true })
})
