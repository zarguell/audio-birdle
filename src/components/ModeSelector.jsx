import { Settings } from "lucide-react";
import { VIEWS } from "../utils/Constants";

export default function ModeSelector({
  gameModes,
  onModeSelect,
  lastPlayedMode,
  selectedRegion,
  regions,
}) {
  const colorClasses = {
    blue: {
      border: "border-blue-200",
      hoverBg: "hover:bg-blue-50",
      hoverBorder: "hover:border-blue-400",
      title: "text-blue-800",
      badge: "bg-blue-100 text-blue-800",
    },
    red: {
      border: "border-red-200",
      hoverBg: "hover:bg-red-50",
      hoverBorder: "hover:border-red-400",
      title: "text-red-800",
      badge: "bg-red-100 text-red-800",
    },
    purple: {
      border: "border-purple-200",
      hoverBg: "hover:bg-purple-50",
      hoverBorder: "hover:border-purple-400",
      title: "text-purple-800",
      badge: "bg-purple-100 text-purple-800",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🐦 Audio-Birdle
          </h1>
          <p className="text-gray-600">Learn birds through their calls</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Select Game Mode</h2>

          {gameModes.map((mode) => {
            const colors = colorClasses[mode.color];
            return (
              <button
                key={mode.mode}
                onClick={() => onModeSelect(mode.view, mode.mode)}
                className={`w-full text-left p-4 rounded-lg border-2 ${colors.border} ${colors.hoverBg} ${colors.hoverBorder} transition-all`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{mode.icon}</div>
                  <div className="flex-1">
                    <div className={`font-semibold ${colors.title}`}>
                      {mode.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {mode.description}
                    </div>
                  </div>
                  {lastPlayedMode === mode.mode && (
                    <span
                      className={`text-xs ${colors.badge} px-2 py-1 rounded`}
                    >
                      Last played
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          <button
            onClick={() => onModeSelect(VIEWS.SETTINGS)}
            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          Current region:{" "}
          {regions.find((r) => r.id === selectedRegion)?.name ||
            "None selected"}
        </div>
      </div>
    </div>
  );
}
