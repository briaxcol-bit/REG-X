/**
 * TableMapModal — modal de pantalla completa que muestra el mapa de mesas
 * dentro del POS. Reutiliza `useTableMap` y `TableMapCanvas` (SST).
 *
 * Al hacer clic en una mesa OCUPADA se carga su orden en el POS.
 * Al hacer clic en una mesa DISPONIBLE también se crea una tab vacía.
 */

import { X, UtensilsCrossed } from 'lucide-react'
import { type TableRow } from '@lib/db'
import {
  STATUS_MAP,
  TableMapCanvas,
  useTableMap,
} from '@modules/restaurant/components/TableMapCanvas'
import { cn } from '@shared/utils/cn'

interface TableMapModalProps {
  onClose:       () => void
  onTableSelect: (table: TableRow) => void
}

export function TableMapModal({ onClose, onTableSelect }: TableMapModalProps) {
  const {
    tables, loading, positions, orderInfoMap,
    zoom, changeZoom, fitToScreen,
    bgImage,
    scrollRef,
    handleDragEnd,
  } = useTableMap()

  const handleTableClick = (table: TableRow) => {
    onTableSelect(table)
    onClose()
  }

  const legend = Object.entries(STATUS_MAP).map(([k, v]) => ({ key: k, ...v }))

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-grafito-50 dark:bg-grafito-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-grafito-900 dark:text-white">Mapa de Mesas</h2>
            <p className="text-xs text-grafito-500 dark:text-grafito-400">
              Selecciona una mesa para cargar su pedido en el POS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Leyenda */}
          <div className="hidden md:flex items-center gap-3">
            {legend.map(l => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', l.dot)} />
                <span className="text-xs text-grafito-500 dark:text-grafito-400">{l.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas compartido */}
      <TableMapCanvas
        tables={tables}
        positions={positions}
        zoom={zoom}
        bgImage={bgImage}
        editMode={false}
        loading={loading}
        scrollRef={scrollRef}
        orderInfoMap={orderInfoMap}
        onTableClick={handleTableClick}
        onDragEnd={handleDragEnd}
        changeZoom={changeZoom}
        fitToScreen={fitToScreen}
      />
    </div>
  )
}
