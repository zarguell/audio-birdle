import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import CountdownToMidnight from "@/utils/CountdownToMidnight";

// Run the worker in UTC so "local" midnight is unambiguous in assertions.
// The worker process starts fresh per file, so this takes effect before any
// Date is constructed by the tests.
process.env.TZ = "UTC";

// Only fake the timers the component uses; leave MessageChannel/performance
// alone so React's scheduler keeps flushing renders normally.
const TIMERS_TO_FAKE = [
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "Date",
];

describe("CountdownToMidnight", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: TIMERS_TO_FAKE });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should count down to the next LOCAL midnight", () => {
    // 2026-08-06T10:15:30Z (TZ=UTC -> local 10:15:30) -> next local midnight
    // 2026-08-07T00:00:00Z = 13h 44m 30s
    vi.setSystemTime(new Date("2026-08-06T10:15:30.000Z"));
    render(<CountdownToMidnight />);
    expect(screen.getByText("13h 44m 30s")).toBeInTheDocument();
  });

  it("should update every second", async () => {
    vi.setSystemTime(new Date("2026-08-06T10:15:30.000Z"));
    render(<CountdownToMidnight />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("13h 44m 29s")).toBeInTheDocument();
  });

  it("should target tomorrow's midnight at exactly local midnight", () => {
    vi.setSystemTime(new Date("2026-08-06T00:00:00.000Z"));
    render(<CountdownToMidnight />);
    expect(screen.getByText("24h 0m 0s")).toBeInTheDocument();
  });

  it("should show a rolling countdown across the midnight boundary", async () => {
    vi.setSystemTime(new Date("2026-08-06T23:59:59.000Z"));
    render(<CountdownToMidnight />);
    expect(screen.getByText("0h 0m 1s")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Now exactly midnight -> next target is tomorrow's midnight (24h)
    expect(screen.getByText("24h 0m 0s")).toBeInTheDocument();
  });

  it("should clean up the interval on unmount", () => {
    vi.setSystemTime(new Date("2026-08-06T10:15:30.000Z"));
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<CountdownToMidnight />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
