import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameView from '@/components/GameView';

const { storeMocks, storeState, audioMocks } = vi.hoisted(() => ({
  storeMocks: {
    setDailyGame: vi.fn(),
    processGuess: vi.fn(),
  },
  storeState: { dailyGames: {} },
  audioMocks: {
    isPlaying: false,
    audioError: false,
    setAudioError: vi.fn(),
    setSelectedAudioIndex: vi.fn(),
    toggleAudio: vi.fn(),
    handleAudioError: vi.fn(),
    handleAudioEnded: vi.fn(),
  },
}));

vi.mock('@/stores/gameStore', () => {
  const readGame = (key) => storeState.dailyGames[key];
  const useGameStore = (selector) =>
    selector({
      dailyGames: storeState.dailyGames,
      getDailyGame: readGame,
      setDailyGame: storeMocks.setDailyGame,
      processGuess: storeMocks.processGuess,
    });
  useGameStore.getState = () => ({
    getDailyGame: readGame,
    setDailyGame: storeMocks.setDailyGame,
    processGuess: storeMocks.processGuess,
  });
  return { useGameStore };
});

vi.mock('@/hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    isPlaying: audioMocks.isPlaying,
    audioError: audioMocks.audioError,
    setAudioError: audioMocks.setAudioError,
    selectedAudioIndex: 0,
    setSelectedAudioIndex: audioMocks.setSelectedAudioIndex,
    audioRef: { current: null },
    toggleAudio: audioMocks.toggleAudio,
    handleAudioError: audioMocks.handleAudioError,
    handleAudioEnded: audioMocks.handleAudioEnded,
  }),
}));

// Avoid network/timer side effects from real subcomponents
vi.mock('@/utils/SubregionUtils', () => ({
  SubregionDisplay: () => <span>Mock Subregion</span>,
}));
vi.mock('@/utils/CountdownToMidnight', () => ({
  default: () => <span>Mock Countdown</span>,
}));

const BIRDS = {
  us: [
    {
      id: 'amerob',
      name: 'American Robin',
      scientificName: 'Turdus migratorius',
      family: 'Turdidae',
      order: 'Passeriformes',
      audioUrl: ['/audio/amerob.mp3'],
      images: [{ url: '/img/amerob.jpg' }],
      facts: ['Common in backyards.'],
      learnMoreUrl: 'https://example.com/amerob',
    },
    {
      id: 'norcar',
      name: 'Northern Cardinal',
      scientificName: 'Cardinalis cardinalis',
      family: 'Cardinalidae',
      order: 'Passeriformes',
      audioUrl: ['/audio/norcar.mp3'],
      images: [{ url: '/img/norcar.jpg' }],
      facts: [],
      learnMoreUrl: '',
    },
    {
      id: 'blujay',
      name: 'Blue Jay',
      scientificName: 'Cyanocitta cristata',
      family: 'Corvidae',
      order: 'Passeriformes',
      audioUrl: ['/audio/blujay.mp3'],
      images: [],
      facts: [],
      learnMoreUrl: '',
    },
    {
      id: 'moudov',
      name: 'Mourning Dove',
      scientificName: 'Zenaida macroura',
      family: 'Columbidae',
      order: 'Columbiformes',
      audioUrl: ['/audio/moudov.mp3'],
      images: [],
      facts: [],
      learnMoreUrl: '',
    },
  ],
};

const REGIONS = [{ id: 'us', name: 'United States' }];

const normalProps = {
  mode: 'normal',
  isPractice: false,
  region: 'us',
  today: '2026-08-06',
  regions: REGIONS,
  todaysBird: BIRDS.us[0],
  birds: BIRDS,
  onBack: vi.fn(),
  onNavigateSettings: vi.fn(),
  onNavigatePractice: vi.fn(),
  onNavigateHard: vi.fn(),
  dataConsistencyError: null,
  hasUpdate: false,
  refreshingData: false,
  handleForceRefresh: null,
  hardModeCompleted: false,
  normalModeCompleted: false,
};

describe('GameView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.dailyGames = {};
    audioMocks.isPlaying = false;
    audioMocks.audioError = false;
  });

  it('should render the normal game without crashing', () => {
    render(<GameView {...normalProps} />);

    expect(screen.getByText('🐦 Audio-Birdle')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText(/Daily Bird Challenge/)).toBeInTheDocument();
    // Play button is present and enabled (no audio error)
    const playButton = screen.getByRole('button', { name: /Play Bird Call/ });
    expect(playButton).toBeInTheDocument();
    expect(playButton).not.toBeDisabled();
    // Answer options are rendered for normal mode
    expect(screen.getByText('American Robin')).toBeInTheDocument();
    expect(screen.getByText('Northern Cardinal')).toBeInTheDocument();
  });

  it('should render practice mode and toggle hard/normal without wiping the round', () => {
    render(
      <GameView
        {...normalProps}
        isPractice={true}
        mode="normal"
        todaysBird={null}
      />,
    );

    expect(screen.getByText('🎯 Practice Mode')).toBeInTheDocument();

    // The round bird is randomly selected; capture the current round's answer
    // options and assert the toggle preserves them (no re-init / wipe).
    const birdNamesPresent = () =>
      BIRDS.us
        .filter((b) => screen.queryByText(b.name))
        .map((b) => b.name)
        .sort();
    const optionsBefore = birdNamesPresent();
    expect(optionsBefore.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    // Same round survives the toggle
    expect(birdNamesPresent()).toEqual(optionsBefore);
    expect(screen.getByText('🔥 Hard Practice')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Normal' }));
    expect(screen.getByText('🎯 Practice Mode')).toBeInTheDocument();
    expect(birdNamesPresent()).toEqual(optionsBefore);
  });

  it('should expose accessible names for icon-only buttons', () => {
    render(<GameView {...normalProps} />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('should submit a guess through the store when an answer is clicked', () => {
    render(<GameView {...normalProps} />);

    fireEvent.click(screen.getByText('American Robin'));

    expect(storeMocks.processGuess).toHaveBeenCalledWith(
      'us-2026-08-06-normal',
      expect.objectContaining({ birdId: 'amerob', correct: true }),
    );
  });

  it('should show the Data Sync Issue panel and trigger force refresh', () => {
    const handleForceRefresh = vi.fn();
    render(
      <GameView
        {...normalProps}
        todaysBird={null}
        dataConsistencyError="Offline mode: using hash-based selection"
        handleForceRefresh={handleForceRefresh}
      />,
    );

    expect(screen.getByText(/Data Sync Issue/)).toBeInTheDocument();
    expect(
      screen.getByText('Offline mode: using hash-based selection'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Force Refresh Data'));
    expect(handleForceRefresh).toHaveBeenCalledTimes(1);
  });

  it('should render the completion card when the game is completed', () => {
    storeState.dailyGames = {
      'us-2026-08-06-normal': {
        region: 'us',
        date: '2026-08-06',
        mode: 'normal',
        guesses: [{ birdId: 'amerob', correct: true, timestamp: 1 }],
        completed: true,
        won: true,
        maxGuesses: 4,
      },
    };

    render(<GameView {...normalProps} />);

    // Completion card shows the bird's scientific name
    expect(
      screen.getByText('Turdus migratorius'),
    ).toBeInTheDocument();
    // No guess buttons remain after completion
    expect(screen.queryByText('Choose the bird')).not.toBeInTheDocument();
  });

  it('should render hard mode with the text input and remaining-guess count', () => {
    storeState.dailyGames = {
      'us-2026-08-06-hard': {
        region: 'us',
        date: '2026-08-06',
        mode: 'hard',
        guesses: [{ birdId: 'norcar', correct: false, timestamp: 1, textInput: 'Northern Cardinal', taxonomicScore: { order: true, family: true, genus: false, species: false } }],
        completed: false,
        won: false,
        maxGuesses: 6,
      },
    };

    render(
      <GameView
        {...normalProps}
        mode="hard"
        todaysBird={BIRDS.us[0]}
      />,
    );

    expect(screen.getByText(/Hard Mode/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Type bird name or scientific name...'),
    ).toBeInTheDocument();
    // One guess used -> 5 remaining, and taxonomic hints appear
    expect(screen.getByText(/5 guesses remaining/)).toBeInTheDocument();
    expect(screen.getByText(/Taxonomic Hints:/)).toBeInTheDocument();
    expect(screen.queryByText('Choose the bird')).not.toBeInTheDocument();
  });

  it('should render the guess history', () => {
    storeState.dailyGames = {
      'us-2026-08-06-normal': {
        region: 'us',
        date: '2026-08-06',
        mode: 'normal',
        guesses: [{ birdId: 'norcar', correct: false, timestamp: 1 }],
        completed: false,
        won: false,
        maxGuesses: 4,
      },
    };

    render(<GameView {...normalProps} />);

    expect(screen.getByText('Your Guesses:')).toBeInTheDocument();
    // The guessed bird appears in the guess history (and as an answer option)
    expect(screen.getAllByText('Northern Cardinal').length).toBeGreaterThanOrEqual(2);
  });

  it('should navigate via the header buttons', () => {
    const onNavigateHard = vi.fn();
    const onNavigatePractice = vi.fn();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();

    render(
      <GameView
        {...normalProps}
        onNavigateHard={onNavigateHard}
        onNavigatePractice={onNavigatePractice}
        onBack={onBack}
        onNavigateSettings={onNavigateSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hard Mode/ }));
    expect(onNavigateHard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Practice/ }));
    expect(onNavigatePractice).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Change Mode' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onNavigateSettings).toHaveBeenCalledTimes(1);
  });

  it('should show the loading state when there is no bird and no error', () => {
    render(
      <GameView
        {...normalProps}
        todaysBird={null}
        dataConsistencyError={null}
      />,
    );

    expect(screen.getByText("Loading today's bird...")).toBeInTheDocument();
  });

  it('should toggle audio via the play button', () => {
    render(<GameView {...normalProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Play Bird Call/ }));
    expect(audioMocks.toggleAudio).toHaveBeenCalledTimes(1);
  });

  it('should complete a practice round on a correct guess and advance', () => {
    render(
      <GameView
        {...normalProps}
        isPractice={true}
        mode="normal"
        todaysBird={null}
      />,
    );

    expect(screen.getByText(/Practice Round #1/)).toBeInTheDocument();

    // Click answer options until the correct one completes the round. The
    // option buttons are the only buttons containing a bird name; guessed
    // names also appear in the history list (divs), which are excluded.
    const names = BIRDS.us.map((b) => b.name);
    const clickOption = (name) => {
      const btn = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes(name));
      if (btn) fireEvent.click(btn);
    };
    for (const name of names) {
      if (screen.queryByText(/Well done!/)) break;
      clickOption(name);
    }

    expect(screen.getByText(/Well done!/)).toBeInTheDocument();

    // Advancing starts round 2
    fireEvent.click(screen.getByText('Next Bird'));
    expect(screen.getByText(/Practice Round #2/)).toBeInTheDocument();
  });

  it('should show the audio error message when playback fails', () => {
    audioMocks.audioError = true;

    render(<GameView {...normalProps} />);

    expect(
      screen.getByText('Audio did not load - please try reloading the page'),
    ).toBeInTheDocument();
  });
});
