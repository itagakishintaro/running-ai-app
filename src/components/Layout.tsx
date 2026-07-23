import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardList,
  BarChart3,
  Sparkles,
  Settings as SettingsIcon,
  Footprints,
} from "lucide-react";
import { cn } from "./ui/cn";

const navItems = [
  { path: "/", label: "ホーム", icon: Home },
  { path: "/training", label: "トレーニング", icon: ClipboardList },
  { path: "/stats", label: "統計", icon: BarChart3 },
  { path: "/advice", label: "AIアドバイス", icon: Sparkles },
  { path: "/settings", label: "設定", icon: SettingsIcon },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <Footprints className="w-6 h-6 text-primary-600" />
          <span className="font-bold text-gray-900">Running AI Coach</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">{children}</main>

      <nav className="sticky bottom-0 z-20 border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="flex justify-around max-w-2xl mx-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <li key={path} className="flex-1">
                <Link
                  to={path}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
