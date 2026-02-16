import { useAuthStore } from '../../store/authStore'

export function LoginPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-gray-100">
      <div className="flex flex-col items-center gap-4 p-12 bg-white rounded-xl shadow-md">
        <h1 className="text-3xl font-bold text-gray-900">CollabBoard</h1>
        <p className="text-base text-gray-500">Real-time collaborative whiteboard</p>
        <button
          onClick={signInWithGoogle}
          className="mt-4 px-6 py-3 text-base font-medium text-white bg-blue-500 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
