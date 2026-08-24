import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HistoryView from "@/components/HistoryView";
import { loadHistoryData } from "@/utils/HistoryUtils";

// Constructable Audio mock: the component uses `new Audio(url)`.
// vi.fn(arrowFn) is NOT constructable, so use a regular function that
// returns the instance object (new then yields that object).
function makeAudioMock() {
  return vi.fn(function mockAudio(url) {
    return {
      src: url,
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });
}

vi.mock("@/utils/HistoryUtils", async (importOriginal) => ({
  ...(await importOriginal()),
  loadHistoryData: vi.fn(),
}));

const REGIONS = [
  { id: "us", name: "United States" },
  { id: "us-lower48", name: "US Lower 48", parentRegion: "us" },
];

const BIRDS = {
  us: [
    {
      id: "amerob",
      name: "American Robin",
      audioUrl: [{ url: "https://x.example/robin.mp3", attribution: {} }],
    },
    {
      id: "barswa",
      name: "Barn Swallow",
      audioUrl: [{ url: "https://x.example/swallow.mp3", attribution: {} }],
    },
  ],
};

const HISTORY = {
  us: [
    { date: "2026-08-20", id: "amerob", name: "American Robin", subregion: "Ohio" },
    { date: "2026-08-21", id: "barswa", name: "Barn Swallow", subregion: "Iowa" },
    // Today and future must never render
    { date: "2026-08-24", id: "today1", name: "Todays Bird", subregion: "Texas" },
    { date: "2026-08-25", id: "future1", name: "Tomorrows Bird", subregion: "Nevada" },
  ],
};

const TODAY = "2026-08-24";

function renderView(overrides = {}) {
  return render(
    <HistoryView
      region="us"
      regions={REGIONS}
      birds={BIRDS}
      today={TODAY}
      onBack={vi.fn()}
      {...overrides}
    />,
  );
}

describe("HistoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.Audio = makeAudioMock();
    loadHistoryData.mockResolvedValue(HISTORY);
  });

  it("should list past challenges newest first", async () => {
    renderView();

    await waitFor(() =>
      expect(screen.getByText("Barn Swallow")).toBeInTheDocument(),
    );

    expect(screen.getByText("American Robin")).toBeInTheDocument();
    expect(screen.getByText("Iowa")).toBeInTheDocument();
    expect(screen.getByText("Ohio")).toBeInTheDocument();
  });

  it("should never show today's or future answers", async () => {
    renderView();

    await waitFor(() =>
      expect(screen.getByText("Barn Swallow")).toBeInTheDocument(),
    );

    expect(screen.queryByText("Todays Bird")).not.toBeInTheDocument();
    expect(screen.queryByText("Tomorrows Bird")).not.toBeInTheDocument();
    expect(screen.getByText("United States • 2 days")).toBeInTheDocument();
  });

  it("should show an empty state when the region has no history", async () => {
    loadHistoryData.mockResolvedValue({ eu: [] });
    renderView();

    await waitFor(() =>
      expect(
        screen.getByText("No past challenges yet for this region."),
      ).toBeInTheDocument(),
    );
  });

  it("should show an error state when loading fails", async () => {
    loadHistoryData.mockRejectedValue(new Error("network"));
    renderView();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't load the challenge history."),
      ).toBeInTheDocument(),
    );
  });

  it("should play a clip when the play button is pressed", async () => {
    renderView();

    const playButtons = await waitFor(() =>
      screen.getAllByRole("button", { name: /Play .* recording/ }),
    );
    fireEvent.click(playButtons[0]); // newest: Barn Swallow

    expect(global.Audio).toHaveBeenCalledWith("https://x.example/swallow.mp3");
    const instance = global.Audio.mock.results.at(-1).value;
    expect(instance.play).toHaveBeenCalledTimes(1);
  });

  it("should pause on second press of the same row", async () => {
    renderView();

    const playButtons = await waitFor(() =>
      screen.getAllByRole("button", { name: /Play .* recording/ }),
    );
    fireEvent.click(playButtons[0]);
    const instance = global.Audio.mock.results.at(-1).value;

    const pauseButton = screen.getByRole("button", {
      name: /Pause Barn Swallow recording/,
    });
    fireEvent.click(pauseButton);

    expect(instance.pause).toHaveBeenCalledTimes(1);
  });

  it("should disable playback for entries with no matching bird", async () => {
    loadHistoryData.mockResolvedValue({
      us: [
        { date: "2026-08-20", id: "gone1", name: "Vanished Bird", subregion: "Ohio" },
      ],
    });
    renderView();

    const button = await waitFor(() =>
      screen.getByRole("button", { name: /Play Vanished Bird recording/ }),
    );
    expect(button).toBeDisabled();
  });

  it("should paginate with Show more", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      id: "amerob",
      name: "American Robin",
      subregion: "Ohio",
    })).filter((e) => e.date < TODAY);
    loadHistoryData.mockResolvedValue({ us: many });
    renderView();

    await waitFor(() =>
      expect(screen.getAllByText("American Robin").length).toBe(20),
    );
    fireEvent.click(screen.getByText(/Show more/));
    expect(screen.getAllByText("American Robin").length).toBe(23);
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it("should call onBack when back is pressed", async () => {
    const onBack = vi.fn();
    renderView({ onBack });

    await waitFor(() =>
      expect(screen.getByText("Barn Swallow")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("← Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
