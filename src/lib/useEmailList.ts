import { useState } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Estado de un campo de varios correos (chips + texto en edición).
 * `commit()` pasa lo escrito a la lista y la devuelve, o null si hay un correo inválido.
 */
export function useEmailList(initial: string[] = [], max = 10) {
  const [list, setList] = useState<string[]>(initial)
  const [input, setInputText] = useState('')
  const [error, setError] = useState('')

  function setInput(text: string) {
    setInputText(text)
    setError('')
  }

  function commit(): string[] | null {
    const typed = input.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    const invalid = typed.find(e => !EMAIL_RE.test(e))
    if (invalid) { setError(`"${invalid}" no es un correo válido`); return null }

    const next = [...new Set([...list, ...typed])]
    if (next.length > max) { setError(`Máximo ${max} correos`); return null }

    setError('')
    setList(next)
    setInputText('')
    return next
  }

  function remove(email: string) {
    setList(list.filter(e => e !== email))
  }

  return { list, input, error, setInput, commit, remove }
}

export type EmailListState = ReturnType<typeof useEmailList>
