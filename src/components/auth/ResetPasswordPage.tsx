import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

interface ResetPasswordPageProps {
  onComplete: () => void
}

export function ResetPasswordPage({ onComplete }: ResetPasswordPageProps) {
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    const err = await updatePassword(password)
    setSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    setSuccess(true)
  }

  return (
    <main className="flex items-center justify-center w-screen h-screen bg-gray-100">
      <div className="flex flex-col items-center gap-4 p-12 bg-white rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900">CollabBoard</h1>
        <p className="text-base text-gray-500">Set a new password</p>
        {renderForm()}
      </div>
    </main>
  )

  function renderForm() {
    if (success) {
      return (
        <div className="flex flex-col gap-3 w-full mt-4 items-center">
          <p role="status" className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2 w-full">
            Password updated successfully.
          </p>
          <button
            onClick={onComplete}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
          >
            Continue to app
          </button>
        </div>
      )
    }

    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full mt-4" aria-label="Set new password">
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div>
          <label htmlFor="reset-password" className="sr-only">New password</label>
          <input
            id="reset-password"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label htmlFor="reset-confirm-password" className="sr-only">Confirm new password</label>
          <input
            id="reset-confirm-password"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Update Password
        </button>
      </form>
    )
  }
}
