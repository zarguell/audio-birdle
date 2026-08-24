import { useState, useEffect, useRef, useCallback } from "react";
import { CalendarDays, Play, Pause, MapPin } from "lucide-react";
import {
  loadHistoryData,
  getPastEntries,
  enrichHistoryEntries,
  pickHistoryClipUrl,
} from "../utils/HistoryUtils";

/**
 * HistoryView - Archive of past daily challenges.
 *
 * Lists previous answers for the selected region with a listen-again
 * button. Entries dated today or later are excluded upstream
 * (getPastEntries) so the archive never spoils an upcoming challenge.
 */
export default function HistoryView({
  region,
  regions,
  birds,
  today,
  onBack,
}) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [playingDate, setPlayingDate] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const history = await loadHistoryData();
        if (cancelled) {
          return;
        }
        const past = getPastEntries(history, region, today);
        setError(false);
        setEntries(enrichHistoryEntries(past, birds?.[region]));
        setVisibleCount(20);
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading challenge history:", err);
          setError(true);
          setEntries([]);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [region, today, birds]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingDate(null);
  }, []);

  // Pause any playing audio when leaving the view
  useEffect(() => stopPlayback, [stopPlayback]);

  const handlePlayToggle = (entry) => {
    if (playingDate === entry.date) {
      stopPlayback();
      return;
    }
    stopPlayback();
    const url = pickHistoryClipUrl(entry);
    if (!url) {
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("ended", stopPlayback);
    audio.play().catch((err) => {
      console.error("History clip playback failed:", err);
      stopPlayback();
    });
    setPlayingDate(entry.date);
  };

  const regionName =
    regions?.find((r) => r.id === region)?.name || region || "Unknown region";

  const formatDate = (isoDate) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const visible = Array.isArray(entries) ? entries.slice(0, visibleCount) : [];

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
          <h1 className="text-2xl font-bold text-gray-800">
            Challenge Archive
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Past Challenges
            </h3>
            {Array.isArray(entries) && (
              <span className="text-sm text-gray-600">
                {regionName} • {entries.length} days
              </span>
            )}
          </div>

          {error && (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Couldn&apos;t load the challenge history.</p>
              <p className="text-sm">Check your connection and try again.</p>
            </div>
          )}

          {!error && entries === null && (
            <div className="text-center py-8 text-gray-500">
              <p>Loading archive…</p>
            </div>
          )}

          {!error && Array.isArray(entries) && entries.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No past challenges yet for this region.</p>
            </div>
          )}

          {!error && visible.length > 0 && (
            <div className="space-y-2">
              {visible.map((entry) => (
                <div
                  key={entry.date}
                  className="p-3 bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <button
                    onClick={() => handlePlayToggle(entry)}
                    disabled={!entry.bird}
                    aria-label={
                      playingDate === entry.date
                        ? `Pause ${entry.name} recording`
                        : `Play ${entry.name} recording`
                    }
                    className="shrink-0 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {playingDate === entry.date ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-800 truncate">
                      {entry.name || entry.id}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <span>{formatDate(entry.date)}</span>
                      {entry.subregion && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{entry.subregion}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {visibleCount < entries.length && (
                <button
                  onClick={() => setVisibleCount((count) => count + 20)}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Show more ({entries.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
