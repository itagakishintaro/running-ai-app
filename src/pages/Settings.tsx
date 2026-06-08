import { Link } from "react-router-dom";

const settingsItems = [
  {
    to: "/profile",
    icon: "👤",
    label: "プロフィール",
    description: "名前・年齢・体重などの基本情報",
  },
  {
    to: "/goal",
    icon: "🎯",
    label: "目標設定",
    description: "マラソンの目標タイムと目標日",
  },
  {
    to: "/review",
    icon: "📈",
    label: "ふりかえり",
    description: "AIによるトレーニング進捗分析",
  },
];

export function Settings() {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">設定</h2>
      <ul className="space-y-3">
        {settingsItems.map(({ to, icon, label, description }) => (
          <li key={to}>
            <Link
              to={to}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 hover:border-blue-200 transition-colors"
            >
              <span className="text-2xl">{icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
