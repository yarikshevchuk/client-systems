import { createContext, useContext, useEffect, useState } from 'react'

const AgentContext = createContext({ ctx: null, setCtx: () => {}, open: false, setOpen: () => {} })

export const useAgent = () => useContext(AgentContext)

export function AgentProvider({ children }) {
  const [ctx, setCtx] = useState(null)
  const [open, setOpen] = useState(false)
  return <AgentContext.Provider value={{ ctx, setCtx, open, setOpen }}>{children}</AgentContext.Provider>
}

export function useAgentContext(courseId, materialId) {
  const { setCtx } = useAgent()
  useEffect(() => {
    if (!courseId) return undefined
    setCtx({ courseId, materialId: materialId || null })
    return () => setCtx(null)
  }, [courseId, materialId, setCtx])
}
