import { queryKeys } from '@/lib/queryKeys'
import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Search, SquareMinus, SquarePlus } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ChartStyle } from '@/features/charts'

type Statement = 'resultados' | 'situacion'

interface TreeRow {
  code: string
  label: string
  hasChildren: boolean
  isTercero: boolean
  values: Record<string, number>
  total: number
}

interface TreeResponse {
  notConnected: boolean
  columns: string[]
  rows: TreeRow[]
  totals: Record<string, number>
}

/** Valores como en el informe contable: "$ 3.280.161.419,17" y "-$ 1.810.371.491,92" */
const money = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (n: number | undefined) => (n === undefined || n === null ? '' : `${n < 0 ? '-' : ''}$ ${money.format(Math.abs(n))}`)

/**
 * Encabezado de columna: el año (resultados) o la fecha de corte del mes (situación),
 * p. ej. "miércoles, 31 de enero de 2024". El mes en curso corta en la fecha de hoy.
 */
function fmtCol(c: string): string {
  if (c.length !== 7) return c
  const [y, m] = c.split('-').map(Number) as [number, number]
  const now = new Date()
  const current = y === now.getFullYear() && m === now.getMonth() + 1
  const cut = current ? now : new Date(y, m, 0)
  return cut.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Sangría por nivel de la cuenta (código de 1, 2, 4, 6, 8… dígitos) */
const depthOf = (row: TreeRow, parentDepth: number) => (row.isTercero ? parentDepth + 1 : Math.max(0, [1, 2, 4, 6, 8, 10, 12].indexOf(row.code.length)))

function useTree(statement: Statement, parent: string, params: Record<string, string>, tercero: string, enabled = true) {
  const query = { ...params, statement, parent, ...(tercero ? { tercero } : {}) }
  return useQuery<TreeResponse>({
    queryKey: [...queryKeys.siigoTrialBalanceTree, query],
    queryFn: async () => (await api.get('/api/siigo/trial-balance/tree', { params: query })).data,
    enabled,
    staleTime: 60_000,
    placeholderData: parent === '' ? keepPreviousData : undefined,
  })
}

function Row({ row, columns, statement, params, tercero, depth, style }: {
  row: TreeRow
  columns: string[]
  statement: Statement
  params: Record<string, string>
  tercero: string
  depth: number
  style: ChartStyle
}) {
  // Las clases (primer nivel) se abren al cargar para mostrar sus grupos, como en el informe contable
  const [open, setOpen] = useState(depth === 0)
  const { data, isFetching } = useTree(statement, row.code, params, tercero, open && row.hasChildren)
  const strong = depth <= 1
  const rowCls = style.isInternal ? 'hover:bg-slate-50' : 'hover:bg-navy-900/5 dark:hover:bg-white/5'

  return (
    <>
      <tr className={rowCls}>
        <td
          className={cn('py-1.5 pr-3 whitespace-nowrap sticky left-0 z-10', style.isInternal ? 'bg-white' : 'bg-cream-100 dark:bg-navy-900')}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <button
            type="button"
            onClick={() => row.hasChildren && setOpen(o => !o)}
            disabled={!row.hasChildren}
            className={cn('inline-flex items-center gap-1 text-left', style.titleCls, strong && 'font-bold', row.isTercero && 'font-normal opacity-80')}
            title={row.label}
          >
            {row.hasChildren
              ? (isFetching
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : open ? <SquareMinus className="w-3.5 h-3.5 opacity-60" strokeWidth={1.5} /> : <SquarePlus className="w-3.5 h-3.5 opacity-60" strokeWidth={1.5} />)
              : <span className="w-3.5" />}
            <span className="max-w-[340px] truncate">{row.label}</span>
          </button>
        </td>
        {columns.map(c => (
          <td key={c} className={cn('py-1.5 px-3 text-right tabular-nums whitespace-nowrap', style.titleCls, strong ? 'font-bold' : row.isTercero && 'opacity-80')}>
            {fmt(row.values[c])}
          </td>
        ))}
      </tr>
      {open && data?.rows.map(child => (
        <Row key={child.code} row={child} columns={columns} statement={statement} params={params} tercero={tercero} depth={depthOf(child, depth)} style={style} />
      ))}
    </>
  )
}

/**
 * Estado financiero desplegable por cuenta (clase → grupo → cuenta → subcuenta → auxiliar → tercero),
 * con los datos del balance de prueba. Cada nivel se consulta al desplegarlo.
 * - resultados: movimiento (débito − crédito) por año; ingresos en negativo.
 * - situacion: saldo final al cierre de cada mes; pasivo y patrimonio en negativo.
 */
export function StatementTree({ statement, params, style }: { statement: Statement; params: Record<string, string>; style: ChartStyle }) {
  const { cardCls, titleCls, mutedCls, isInternal } = style
  const [terceroInput, setTerceroInput] = useState('')
  const [tercero, setTercero] = useState('')

  // Se consulta al dejar de escribir
  useEffect(() => {
    const t = setTimeout(() => setTercero(terceroInput.trim()), 400)
    return () => clearTimeout(t)
  }, [terceroInput])

  const { data, isLoading, isFetching } = useTree(statement, '', params, tercero)
  const columns = data?.columns ?? []
  const headCls = isInternal ? 'bg-slate-100 text-slate-600' : 'bg-sand-300/50 text-navy-900 dark:bg-navy-800 dark:text-cream-100'

  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className={cn('text-xs', mutedCls)}>
          {statement === 'resultados'
            ? 'Movimiento de cada cuenta por año (débitos − créditos). Ingresos en negativo por su naturaleza crédito.'
            : 'Saldo de cada cuenta al cierre de cada mes. Pasivo y patrimonio en negativo por su naturaleza crédito.'}
          {' '}Despliega cada fila para ver el detalle hasta el tercero.
        </p>
        <div className="relative">
          <Search className={cn('w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2', mutedCls)} />
          <input
            value={terceroInput}
            onChange={e => setTerceroInput(e.target.value)}
            placeholder="Filtrar por tercero (NIT o nombre)"
            aria-label="Filtrar por tercero"
            className={cn(
              'pl-9 pr-3 py-1.5 text-xs rounded-xl border w-64 focus:outline-none focus:ring-2 focus:ring-primary-500',
              isInternal ? 'border-slate-200 bg-white text-slate-700' : 'border-navy-900/10 bg-white text-navy-900 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100',
            )}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className={cn('w-6 h-6 animate-spin', mutedCls)} /></div>
      ) : !data?.rows.length ? (
        <p className={cn('text-sm py-10 text-center', mutedCls)}>
          {tercero ? 'Ningún movimiento de ese tercero en el periodo.' : 'No hay balance de prueba importado en el periodo seleccionado.'}
        </p>
      ) : (
        <div className={cn('overflow-x-auto max-h-[520px] overflow-y-auto rounded-xl', isFetching && 'opacity-70')}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className={headCls}>
                <th className={cn('py-2 px-3 text-left font-semibold sticky left-0 z-30', headCls)}>Cuenta</th>
                {columns.map(c => <th key={c} className="py-2 px-3 text-right font-semibold whitespace-nowrap">{fmtCol(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <Row key={row.code} row={row} columns={columns} statement={statement} params={params} tercero={tercero} depth={0} style={style} />
              ))}
              <tr className={cn('border-t-2', isInternal ? 'border-slate-300' : 'border-navy-900/20 dark:border-white/20')}>
                <td className={cn('py-2 px-3 font-bold sticky left-0', titleCls, isInternal ? 'bg-white' : 'bg-cream-100 dark:bg-navy-900')}>Total</td>
                {columns.map(c => (
                  <td key={c} className={cn('py-2 px-3 text-right tabular-nums font-bold whitespace-nowrap', titleCls)}>{fmt(data.totals[c])}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
