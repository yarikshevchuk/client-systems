import { useEffect } from 'react'
import { getToken } from './api.js'

const listeners = new Set()
let socket = null

export function connectLive() {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${scheme}://${window.location.host}/ws?token=${getToken()}`)
  ws.onmessage = (message) => listeners.forEach((listener) => listener(JSON.parse(message.data)))
  ws.onclose = () => setTimeout(() => socket === ws && connectLive(), 2000)
  socket = ws
}

export function disconnectLive() {
  const ws = socket
  socket = null
  if (ws) ws.close()
}

export function useLive(handler) {
  useEffect(() => {
    listeners.add(handler)
    return () => listeners.delete(handler)
  })
}
