import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, getToken } from './api.js'

const LiveContext = createContext({ subscribe: () => () => {}, counters: { notifications: 0, messages: 0 }, refresh: () => {} })

export const useLive = () => useContext(LiveContext)

export function useLiveEvents(handler) {
  const { subscribe } = useLive()
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe])
}

export function LiveProvider({ user, children }) {
  const listeners = useRef(new Set())
  const [counters, setCounters] = useState({ notifications: 0, messages: 0 })

  const refresh = useCallback(() => {
    api('/me/counters').then(setCounters).catch(() => {})
  }, [])

  const subscribe = useCallback((callback) => {
    listeners.current.add(callback)
    return () => listeners.current.delete(callback)
  }, [])

  useEffect(() => {
    if (!user) return undefined
    refresh()
    let socket
    let timer
    let stopped = false

    function open() {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${scheme}://${window.location.host}/ws?token=${getToken()}`)
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data)
        if (event.type === 'notification') setCounters((current) => ({ ...current, notifications: current.notifications + 1 }))
        if (event.type === 'dm') setCounters((current) => ({ ...current, messages: current.messages + 1 }))
        listeners.current.forEach((callback) => callback(event))
      }
      socket.onclose = () => {
        if (!stopped) timer = setTimeout(open, 2000)
      }
    }

    open()
    return () => {
      stopped = true
      clearTimeout(timer)
      if (socket) socket.close()
    }
  }, [user, refresh])

  return <LiveContext.Provider value={{ subscribe, counters, refresh }}>{children}</LiveContext.Provider>
}
