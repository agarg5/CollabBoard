import { useEffect, useState } from 'react'
import { useConnectionStore } from '../../store/connectionStore'
import type { ConnectionStatus as Status } from '../../store/connectionStore'

const config: Record<Status, { color: string; label: string }> = {
  connecting: { color: 'bg-gray-400', label: 'Connecting...' },
  connected: { color: 'bg-green-500', label: 'Connected' },
  reconnecting: { color: 'bg-yellow-500', label: 'Reconnecting...' },
  error: { color: 'bg-red-500', label: 'Connection lost' },
}

export function ConnectionStatus() {
  const status = useConnectionStore((s) => s.status)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (status !== 'connected') {
      setVisible(true)
      return
    }
    const timer = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(timer)
  }, [status])

  const { color, label } = config[status]

  return (
    <div
      className={`flex items-center gap-1.5 text-sm text-gray-600 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  )
}
