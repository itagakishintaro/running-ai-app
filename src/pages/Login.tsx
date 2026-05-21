import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="text-6xl mb-4">🏃</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Running AI Coach</h1>
        <p className="text-gray-500 text-sm mb-8">
          あなたの目標達成をAIがサポートします
        </p>
        <button
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors font-medium text-gray-700"
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            className="w-5 h-5"
          />
          Googleでサインイン
        </button>
      </div>
    </div>
  );
}
