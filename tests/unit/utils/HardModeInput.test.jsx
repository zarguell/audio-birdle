import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import HardModeInput from '@/utils/HardModeInput';

const BIRDS = [
  { id: 'amerob', name: 'American Robin', scientificName: 'Turdus migratorius' },
  { id: 'eurrob', name: 'European Robin', scientificName: 'Erithacus rubecula' },
  { id: 'rufhum', name: 'Rufous Hummingbird', scientificName: 'Selasphorus rufus' },
];

describe('HardModeInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const typeQuery = (input, value) => {
    fireEvent.change(input, { target: { value } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
  };

  it('should render a combobox input with aria attributes', () => {
    render(<HardModeInput birds={BIRDS} onGuess={vi.fn()} />);

    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-label', 'Search for a bird');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-controls', 'hard-mode-suggestions');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('should show a listbox with options after debounce', () => {
    render(<HardModeInput birds={BIRDS} onGuess={vi.fn()} />);
    const input = screen.getByRole('combobox');

    typeQuery(input, 'rob');

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute('id', 'hard-mode-suggestions');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', 'hard-mode-suggestions');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('American Robin');
    expect(options[1]).toHaveTextContent('European Robin');
  });

  it('should move the active option with ArrowDown and ArrowUp', () => {
    render(<HardModeInput birds={BIRDS} onGuess={vi.fn()} />);
    const input = screen.getByRole('combobox');

    typeQuery(input, 'rob');
    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'hard-mode-suggestions-option-amerob',
    );

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'hard-mode-suggestions-option-eurrob',
    );

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('should submit the active suggestion on Enter', () => {
    const onGuess = vi.fn();
    render(<HardModeInput birds={BIRDS} onGuess={onGuess} />);
    const input = screen.getByRole('combobox');

    typeQuery(input, 'rob');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess).toHaveBeenCalledWith(BIRDS[1]); // European Robin
    expect(input.value).toBe('');
    // Listbox closes after submit
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should submit the first suggestion on Enter when nothing is active', () => {
    const onGuess = vi.fn();
    render(<HardModeInput birds={BIRDS} onGuess={onGuess} />);
    const input = screen.getByRole('combobox');

    typeQuery(input, 'rob');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess).toHaveBeenCalledWith(BIRDS[0]); // American Robin
  });

  it('should close the listbox on Escape', () => {
    render(<HardModeInput birds={BIRDS} onGuess={vi.fn()} />);
    const input = screen.getByRole('combobox');

    typeQuery(input, 'rob');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('should select a suggestion on click', () => {
    const onGuess = vi.fn();
    render(<HardModeInput birds={BIRDS} onGuess={onGuess} />);
    const input = screen.getByRole('combobox');

    typeQuery(input, 'hum');
    fireEvent.click(screen.getByText('Rufous Hummingbird'));

    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess).toHaveBeenCalledWith(BIRDS[2]);
  });

  it('should expose an accessible clear button', () => {
    render(<HardModeInput birds={BIRDS} onGuess={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'rob' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    fireEvent.click(clearButton);

    expect(input.value).toBe('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
