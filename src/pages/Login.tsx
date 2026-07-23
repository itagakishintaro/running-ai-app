import { Footprints } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
          <Footprints className="w-9 h-9 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Running AI Coach</h1>
        <p className="text-gray-500 text-sm mb-8">
          あなたの目標達成をAIがサポートします
        </p>
        <button
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors font-medium text-gray-700"
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
