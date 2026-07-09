import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

// Dropdown con buscador — para filtros por empresa, servicio, etc.
export function SearchSelect({ value, onChange, options, placeholder, label }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string; color?: string }[]
  placeholder: string; label?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors text-left"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
              className="text-slate-400 hover:text-slate-600 p-0.5">
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                  value === o.value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700'
                }`}
              >
                {o.color && <span className={`w-2 h-2 rounded-full shrink-0 ${o.color}`} />}
                {o.label}
              </button>
            ))}
            {!filtered.length && (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
