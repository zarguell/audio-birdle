import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

const { audioControlsMock } = vi.hoisted(() => ({
  audioControlsMock: {
    playAudio: vi.fn(),
    pauseAudio: vi.fn(),
    stopAudio: vi.fn(),
  },
}));

vi.mock('@/utils/AudioUtils', () => ({
  createAudioControls: () => audioControlsMock,
}));

describe('useAudioPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioControlsMock.playAudio.mockResolvedValue(true);
  });

  it('starts with default state', () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.audioError).toBe(false);
    expect(result.current.selectedAudioIndex).toBe(0);
  });

  it('plays audio successfully on toggle', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.toggleAudio();
    });

    expect(audioControlsMock.playAudio).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.audioError).toBe(false);
  });

  it('pauses audio when already playing', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.toggleAudio();
    });
    await act(async () => {
      await result.current.toggleAudio();
    });

    expect(audioControlsMock.pauseAudio).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it('sets an error when playback fails', async () => {
    audioControlsMock.playAudio.mockResolvedValue(false);
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.toggleAudio();
    });

    expect(result.current.audioError).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it('treats natural playback end as NOT an error (regression guard)', async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.toggleAudio();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.handleAudioEnded();
    });

    // Playing state clears, but the audio must stay re-playable: no error.
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.audioError).toBe(false);
  });

  it('resets state', async () => {
    const { result } = renderHook(() => useAudioPlayer(2));

    await act(async () => {
      await result.current.toggleAudio();
    });
    act(() => {
      result.current.resetAudio();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.audioError).toBe(false);
    expect(result.current.selectedAudioIndex).toBe(0);
  });
});
