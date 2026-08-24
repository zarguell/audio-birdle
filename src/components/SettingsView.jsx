import { BarChart3, RefreshCw, CalendarDays } from "lucide-react";

export default function SettingsView({
  selectedRegion,
  regions,
  onBack,
  onChangeRegion,
  onViewStats,
  onViewHistory,
  onResetTodaysGame,
  onResetAllData,
  onRefreshData,
  refreshingData,
  hasUpdate,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={onBack}
            className="text-blue-500 hover:text-blue-600"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Region
            </label>
            <div className="p-3 bg-gray-50 rounded-lg">
              {regions.find((r) => r.id === selectedRegion)?.name ||
                "None selected"}
            </div>
          </div>

          <button
            onClick={onChangeRegion}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Change Region
          </button>

          <button
            onClick={onViewStats}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            View Stats
          </button>

          <button
            onClick={onViewHistory}
            className="w-full bg-indigo-500 text-white py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            <CalendarDays className="w-4 h-4" />
            Challenge Archive
          </button>

          <button
            onClick={onResetTodaysGame}
            className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Today's Game
          </button>

          <button
            onClick={onResetAllData}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset All Data
          </button>

          {hasUpdate && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                🔄 New data available! Click the button below to refresh.
              </p>
            </div>
          )}

          <button
            onClick={onRefreshData}
            disabled={refreshingData}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshingData ? "animate-spin" : ""}`}
            />
            {refreshingData ? "Refreshing Data..." : "Refresh Game Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
