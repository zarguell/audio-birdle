import { BarChart3 } from "lucide-react";

export default function StatsView({ stats, regions, onBack }) {
  const totalGames = stats.totalGamesPlayed;
  const winRate =
    totalGames > 0 ? ((stats.totalGamesWon / totalGames) * 100).toFixed(1) : 0;
  const regionBreakdown = Object.entries(stats.regionStats).map(
    ([region, regionStats]) => ({
      region,
      games: regionStats.gamesPlayed,
      winRate:
        regionStats.gamesPlayed > 0
          ? ((regionStats.gamesWon / regionStats.gamesPlayed) * 100).toFixed(1)
          : 0,
      avgGuesses: regionStats.averageGuesses.toFixed(1),
    }),
  );

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
          <h1 className="text-2xl font-bold text-gray-800">Your Stats</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-3">Overall Performance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {totalGames}
                </div>
                <div className="text-sm text-gray-600">Games Played</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {winRate}%
                </div>
                <div className="text-sm text-gray-600">Win Rate</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.averageGuesses.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Avg Guesses</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.maxStreak}
                </div>
                <div className="text-sm text-gray-600">Best Streak</div>
              </div>
            </div>
          </div>

          {regionBreakdown.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">By Region</h3>
              <div className="space-y-2">
                {regionBreakdown.map((regionStat) => {
                  const regionName =
                    regions.find((r) => r.id === regionStat.region)?.name ||
                    regionStat.region;
                  return (
                    <div
                      key={regionStat.region}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{regionName}</span>
                        <span className="text-sm text-gray-600">
                          {regionStat.games} games
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Win Rate: {regionStat.winRate}%</span>
                        <span>Avg: {regionStat.avgGuesses} guesses</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalGames === 0 && (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No games played yet!</p>
              <p className="text-sm">Start playing to see your stats here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
