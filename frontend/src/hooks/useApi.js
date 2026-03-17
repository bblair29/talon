import { useState, useEffect, useCallback } from 'react'

const BASE = '/api'

export function useApi(endpoint, options = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { poll = 0, skip = false } = options

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}${endpoint}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    if (skip) return
    fetchData()
    if (poll > 0) {
      const id = setInterval(fetchData, poll)
      return () => clearInterval(id)
    }
  }, [fetchData, poll, skip])

  return { data, loading, error, refetch: fetchData }
}

export async function postApi(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
