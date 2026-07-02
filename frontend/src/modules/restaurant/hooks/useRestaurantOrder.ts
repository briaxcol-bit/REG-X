import { useState, useCallback } from 'react'
import {
  getActiveOrderForTable,
  createRestaurantOrder,
  addItemsToOrder,
  closeRestaurantOrder,
  type RestaurantOrderRow,
  type RestaurantOrderItemInput,
} from '@lib/db'

export function useRestaurantOrder() {
  const [order,      setOrder]      = useState<RestaurantOrderRow | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadOrder = useCallback(async (tenantId: string, tableId: string) => {
    setLoading(true)
    try {
      const o = await getActiveOrderForTable(tenantId, tableId)
      setOrder(o)
    } finally {
      setLoading(false)
    }
  }, [])

  const sendItems = useCallback(async (
    tenantId:   string,
    branchId:   string,
    tableId:    string,
    waiterId:   string,
    waiterName: string,
    items:      RestaurantOrderItemInput[],
  ) => {
    setSubmitting(true)
    try {
      if (order) {
        await addItemsToOrder(order.id, items)
      } else {
        await createRestaurantOrder(tenantId, branchId, tableId, waiterId, waiterName, items)
      }
      // Refresh order from DB
      const updated = await getActiveOrderForTable(tenantId, tableId)
      setOrder(updated)
    } finally {
      setSubmitting(false)
    }
  }, [order])

  const closeOrder = useCallback(async (tableId: string) => {
    if (!order) return
    setSubmitting(true)
    try {
      await closeRestaurantOrder(order.id, tableId)
      setOrder(null)
    } finally {
      setSubmitting(false)
    }
  }, [order])

  return { order, loading, submitting, loadOrder, sendItems, closeOrder, setOrder }
}
