import { usePresenceStore } from '../../store/presenceStore'
import { useAuthStore } from '../../store/authStore'

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function PresencePanel() {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)
  const myId = useAuthStore((s) => s.user?.id)

  if (onlineUsers.length === 0) return null

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Online users">
      {onlineUsers.map((user) => {
        const isMe = user.user_id === myId
        const label = isMe ? `${user.user_name} (you)` : user.user_name
        const initials = getInitials(user.user_name)
        return (
          <div
            key={user.user_id}
            role="img"
            aria-label={label}
            title={label}
            className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: user.color }}
          >
            {initials}
          </div>
        )
      })}
    </div>
  )
}
