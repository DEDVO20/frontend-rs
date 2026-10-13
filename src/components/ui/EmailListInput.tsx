import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { EmailListState } from '@/lib/useEmailList'
import { X } from 'lucide-react'

interface Props {
  id: string
  state: EmailListState
  disabled?: boolean
  placeholder?: string
  hint?: string
}

/**
 * Campo de varios correos como chips — Enter o coma confirman lo escrito.
 * Lo que quede sin confirmar lo recoge quien guarda llamando a `state.commit()`.
 */
export function EmailListInput({ id, state, disabled, placeholder = 'correo@dominio.com', hint }: Props) {
  const { list, input, error, setInput, commit, remove } = state

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !input && list.length) {
      remove(list[list.length - 1]!)
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 px-2 py-1.5 border rounded-lg bg-white',
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-colors',
          error ? 'border-red-400' : 'border-slate-200',
          disabled && 'opacity-60',
        )}
      >
        {list.map(email => (
          <span
            key={email}
            className="inline-flex items-center gap-1 text-xs bg-primary-100 text-primary-700 pl-2 pr-1 py-1 rounded-full font-medium"
          >
            {email}
            {!disabled && (
              <button
                type="button"
                aria-label={`Quitar ${email}`}
                onClick={() => remove(email)}
                className="rounded-full hover:bg-primary-200 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          type="text"
          inputMode="email"
          value={input}
          disabled={disabled}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={list.length ? '' : placeholder}
          className="flex-1 min-w-[12rem] px-1 py-1 text-sm bg-transparent placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      {error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400 mt-1">{hint}</p>
      ) : null}
    </div>
  )
}
