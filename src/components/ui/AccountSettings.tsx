import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'

export function AccountSettings() {
  const { updateEmail, updatePassword } = useAuthStore()
  const setShowAccountSettings = useUiStore((s) => s.setShowAccountSettings)

  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [emailSubmitting, setEmailSubmitting] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  function close() {
    setShowAccountSettings(false)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setEmailSubmitting(true)
    setEmailStatus(null)
    const error = await updateEmail(email.trim())
    setEmailSubmitting(false)

    if (error) {
      setEmailStatus({ type: 'error', message: error })
      return
    }

    setEmailStatus({ type: 'success', message: 'Check your new email for a confirmation link.' })
    setEmail('')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !confirmPassword) return

    if (password !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match.' })
      return
    }

    if (password.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters.' })
      return
    }

    setPasswordSubmitting(true)
    setPasswordStatus(null)
    const error = await updatePassword(password)
    setPasswordSubmitting(false)

    if (error) {
      setPasswordStatus({ type: 'error', message: error })
      return
    }

    setPasswordStatus({ type: 'success', message: 'Password updated successfully.' })
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      role="dialog"
      aria-label="Account settings"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
          <button
            onClick={close}
            aria-label="Close account settings"
            className="p-1.5 rounded cursor-pointer hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {renderEmailSection()}
        <hr className="my-6 border-gray-200" />
        {renderPasswordSection()}
      </div>
    </div>
  )

  function renderEmailSection() {
    return (
      <form onSubmit={handleEmailSubmit}>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Change Email</h3>
        <label htmlFor="account-new-email" className="sr-only">New email address</label>
        <input
          id="account-new-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="New email address"
          required
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {emailStatus && (
          <p className={`mt-2 text-sm ${emailStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {emailStatus.message}
          </p>
        )}
        <button
          type="submit"
          disabled={emailSubmitting || !email.trim()}
          className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {emailSubmitting ? 'Updating...' : 'Update Email'}
        </button>
      </form>
    )
  }

  function renderPasswordSection() {
    return (
      <form onSubmit={handlePasswordSubmit}>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Change Password</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="account-new-password" className="sr-only">New password</label>
            <input
              id="account-new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              required
              minLength={6}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="account-confirm-password" className="sr-only">Confirm new password</label>
            <input
              id="account-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={6}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        {passwordStatus && (
          <p className={`mt-2 text-sm ${passwordStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {passwordStatus.message}
          </p>
        )}
        <button
          type="submit"
          disabled={passwordSubmitting || !password || !confirmPassword}
          className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {passwordSubmitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    )
  }
}
