import { Link } from "react-router-dom";
import {
  User as UserIcon,
  Target,
  TrendingUp,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Card, cardClass, Button } from "../components/ui";

const settingsItems: {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
}[] = [
  {
    to: "/profile",
    icon: UserIcon,
    label: "プロフィール",
    description: "名前・年齢・体重などの基本情報",
  },
  {
    to: "/goal",
    icon: Target,
    label: "目標設定",
    description: "マラソンの目標タイムと目標日の一覧管理",
  },
  {
    to: "/review",
    icon: TrendingUp,
    label: "ふりかえり",
    description: "AIによるトレーニング進捗分析",
  },
];

export function Settings() {
  const { user, logOut } = useAuth();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">設定</h2>

      <Card className="flex items-center gap-3">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="w-12 h-12 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-primary-600" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{user?.displayName}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
      </Card>

      <ul className="space-y-3">
        {settingsItems.map(({ to, icon: Icon, label, description }) => (
          <li key={to}>
            <Link
              to={to}
              className={`${cardClass} p-4 flex items-center gap-3 hover:border-primary-200 transition-colors`}
            >
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        onClick={logOut}
        className="w-full text-gray-600"
      >
        <LogOut className="w-4 h-4" />
        ログアウト
      </Button>
    </div>
  );
}
