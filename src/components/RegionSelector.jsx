import { MapPin } from "lucide-react";
import { useGameStore } from "../stores/gameStore";

export default function RegionSelector({ regions, today, onRegionSelect }) {
  // Subscribe to dailyGames so the "Played Today" badge stays in sync
  // (reading useGameStore.getState() during render never re-renders).
  const dailyGames = useGameStore((state) => state.dailyGames);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🐦 Audio-Birdle
          </h1>
          <p className="text-gray-600">Learn birds through their calls</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Select Your Region
          </h2>

          <div className="space-y-2">
            {regions.map((region) => {
              const hasPlayedToday =
                (dailyGames[`${region.id}-${today}-normal`]?.guesses
                  ?.length || 0) > 0 ||
                (dailyGames[`${region.id}-${today}-hard`]?.guesses
                  ?.length || 0) > 0;
              return (
                <button
                  key={region.id}
                  onClick={() => onRegionSelect(region.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors relative"
                >
                  <div className="flex justify-between items-center">
                    <span>{region.name}</span>
                    {hasPlayedToday && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Played Today
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
