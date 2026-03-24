'use client'
import { useEffect, useState, useCallback } from 'react'
import { getMonthlyPoints } from '@/lib/points'

export function useMonthlyPoints() {
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { total } = await getMonthlyPoints()
    setTotal(total)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { total, loading, refresh }
}
