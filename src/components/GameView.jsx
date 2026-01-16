import {
  Settings,
  Volume2,
  RefreshCw,
  Target,
  Play,
  Pause,
} from "lucide-react";
import { SubregionDisplay } from "../utils/SubregionUtils";
import { getAudioSrc } from "../utils/AudioUtils";
import { formatDateForDisplay } from "../utils/DateUtils";
import BirdCompletionCard from "../utils/BirdCompletionCard";
import CountdownToMidnight from "../utils/CountdownToMidnight";

export default function GameView({
  selectedRegion,
  today,
  regions,
  todaysBird,
  currentDailyGame,
  answerOptions,
  makeGuess,
  audioPlayer,
  selectedAudioIndex,
  setSelectedAudioIndex,
  dataConsistencyError,
  hasUpdate,
  refreshingData,
  handleForceRefresh,
  handleShareResult,
  onBack,
  onModeChange,
}) {
  const {
    isPlaying,
    audioError,
    setAudioError,
    audioRef,
    toggleAudio,
    handleAudioError,
  } = audioPlayer;

  const handleAudioEnded = () => {
    if (audioPlayer.isPlaying) {
      audioPlayer.handleAudioError();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">
              🐦 Audio-Birdle
            </h1>
            {hasUpdate && (
              <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                Update Available
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onModeChange("hard")}
              disabled={currentDailyGame?.completed}
              className={`${
                currentDailyGame?.completed
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              } text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
            >
              <Target className="w-4 h-4" />
              Hard Mode
            </button>
            <button
              onClick={() => onModeChange("practice")}
              className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
            >
              <Target className="w-4 h-4" />
              Practice
            </button>
            <button
              onClick={() => onBack("mode")}
              className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
            >
              Change Mode
            </button>
            <button
              onClick={() => onBack("settings")}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {dataConsistencyError && !todaysBird && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-6 mb-4">
              <div className="text-center">
                <p className="text-red-800 font-medium mb-2">
                  ⚠️ Data Sync Issue
                </p>
                <p className="text-sm text-red-700 mb-4">
                  {dataConsistencyError}
                </p>
                <div className="flex flex-col gap-2 items-center">
                  <button
                    onClick={handleForceRefresh}
                    disabled={refreshingData}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-gray-400"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshingData ? 'animate-spin' : ''}`} />
                    {refreshingData ? 'Refreshing...' : 'Force Refresh Data'}
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-red-600 underline text-sm hover:text-red-800"
                  >
                    Or reload the page
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">
              {regions.find((r) => r.id === selectedRegion)?.name}
            </p>
            <p className="text-sm text-gray-500">
              Daily Bird Challenge • {formatDateForDisplay(today)}
            </p>
          </div>

          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <Volume2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />

              {todaysBird &&
                Array.isArray(todaysBird.audioUrl) &&
                todaysBird.audioUrl.length > 1 && (
                  <div className="mb-4">
                    <select
                      value={selectedAudioIndex}
                      onChange={(e) => {
                        const newIndex = parseInt(e.target.value);
                        setSelectedAudioIndex(newIndex);
                        if (audioRef.current) {
                          audioRef.current.load();
                        }
                      }}
                      className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {todaysBird.audioUrl.map((_, index) => (
                        <option key={index} value={index}>
                          Recording {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {todaysBird && (
                <audio
                  ref={audioRef}
                  src={getAudioSrc(todaysBird.audioUrl, selectedAudioIndex)}
                  onEnded={handleAudioEnded}
                  onError={handleAudioError}
                  onLoadStart={() => {
                    setAudioError(false);
                  }}
                  preload="none"
                  key={`${todaysBird.id || "bird"}-${selectedAudioIndex}`}
                />
              )}

              <button
                onClick={toggleAudio}
                disabled={!todaysBird || audioError}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto hover:bg-blue-600 transition-colors disabled:bg-gray-300"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {isPlaying ? "Pause" : "Play"} Bird Call
              </button>

              {audioError && (
                <p className="text-red-500 text-sm mt-2">
                  Audio did not load - please try reloading the page
                </p>
              )}
            </div>
          </div>

          {currentDailyGame && currentDailyGame.guesses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Your Guesses:</h3>
              <div className="space-y-2">
                {currentDailyGame.guesses.map((guess, index) => {
                  const guessedBird = answerOptions.find(
                    (bird) => bird.id === guess.birdId,
                  );
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        guess.correct
                          ? "border-green-500 bg-green-50"
                          : "border-red-500 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{guessedBird?.name}</span>
                        <span className="text-2xl">
                          {guess.correct ? "✅" : "❌"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mt-2">
            Hint: today's selected bird was observed in the last 14 days on
            eBird in{" "}
            <SubregionDisplay selectedRegion={selectedRegion} today={today} />
            !
          </p>
          <br></br>

          {currentDailyGame &&
            !currentDailyGame.completed && (
              <div className="space-y-2">
                <h3 className="font-semibold mb-2">
                  Choose the bird ({currentDailyGame.guesses.length + 1}/
                  {currentDailyGame.maxGuesses}):
                </h3>
                {answerOptions.map((bird) => (
                  <button
                    key={bird.id}
                    onClick={() => makeGuess(bird.id)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium">{bird.name}</div>
                    <div className="text-sm text-gray-500 italic">
                      {bird.scientificName}
                    </div>
                  </button>
                ))}
              </div>
            )}

          {currentDailyGame && currentDailyGame.completed && (
            <div className="text-center">
              <div
                className={`text-2xl font-bold mb-4 ${currentDailyGame.won ? "text-green-600" : "text-red-600"}`}
              >
                {currentDailyGame.won
                  ? "🎉 Well done!"
                  : "😔 Better luck tomorrow!"}
              </div>

              <BirdCompletionCard
                bird={todaysBird}
                selectedAudioIndex={selectedAudioIndex}
                onShare={handleShareResult}
                variant="normal"
              />
            </div>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          Next bird in: <CountdownToMidnight />
        </div>
      </div>
    </div>
  );
}
