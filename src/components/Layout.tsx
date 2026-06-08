import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { path: "/", label: "ホーム", icon: "🏠" },
  { path: "/training", label: "トレーニング", icon: "📋" },
  { path: "/stats", label: "統計", icon: "📊" },
  { path: "/advice", label: "AIアドバイス", icon: "🤖" },
  { path: "/settings", label: "設定", icon: "⚙️" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { logOut, user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow">
        <span className="font-bold text-lg">🏃 Running AI Coach</span>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">{user?.displayName}</span>
          <button
            onClick={logOut}
            className="text-sm bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">{children}</main>

      <nav className="bg-white border-t border-gray-200 sticky bottom-0">
        <ul className="flex justify-around max-w-2xl mx-auto">
          {navItems.map(({ path, label, icon }) => (
            <li key={path}>
              <Link
                to={path}
                className={`flex flex-col items-center py-2 px-2 text-xs transition-colors ${
                  location.pathname === path
                    ? "text-blue-600 font-semibold"
                    : "text-gray-500 hover:text-blue-500"
                }`}
              >
                <span className="text-xl">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
