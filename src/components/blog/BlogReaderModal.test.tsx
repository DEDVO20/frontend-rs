// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { BlogReaderModal } from './BlogReaderModal'

afterEach(cleanup)

it('muestra las etiquetas HTML como texto y conserva el formato del artículo', () => {
  const rawMarkup = '<span>Texto del artículo</span>'
  render(<BlogReaderModal onClose={() => {}} post={{
    id: 'article',
    slug: 'prueba',
    title: 'Artículo de prueba',
    content: `${rawMarkup}\n\n**Importante**\n\n- *Detalle*\n\nLa fórmula es $VAN$`,
    category: 'Finanzas',
    author_name: 'Finto',
    reading_time_minutes: 1,
    published: true,
    created_at: '2026-01-01',
  }} />)

  expect(screen.getByText(rawMarkup).tagName).toBe('P')
  expect(screen.getByText('Importante').tagName).toBe('STRONG')
  expect(screen.getByText('Detalle').tagName).toBe('EM')
  expect(screen.getByText('VAN').tagName).toBe('CODE')
})
