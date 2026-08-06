/**
 * HardModeInput - Free-text input with autocomplete dropdown for hard mode
 * Provides fuzzy search and suggestion selection for bird names
 *
 * Accessible combobox pattern:
 * - input: role=combobox + aria-expanded + aria-controls + aria-activedescendant
 * - suggestions listbox with role=listbox/option + aria-selected
 * - ArrowDown/ArrowUp move the active option, Enter selects it, Escape closes
 */

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { filterBirdsByQuery } from "./TaxonomyUtils";

export default function HardModeInput({
  birds,
  onGuess,
  disabled = false,
  placeholder = "Type bird name...",
  inputId = "hard-mode-input",
  listboxId = "hard-mode-suggestions",
}) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Filter birds based on input (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim().length >= 2) {
        const filtered = filterBirdsByQuery(birds, inputValue);
        setSuggestions(filtered.slice(0, 8)); // Limit to 8 suggestions
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
      setActiveIndex(-1);
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [inputValue, birds]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (bird) => {
    if (bird) {
      onGuess(bird);
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions || suggestions.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!showSuggestions || suggestions.length === 0) return;
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      if (!showSuggestions || suggestions.length === 0) return;
      e.preventDefault();
      // Select the active suggestion when one was navigated to, otherwise
      // fall back to the first suggestion (previous behavior).
      const index = activeIndex >= 0 ? activeIndex : 0;
      handleSubmit(suggestions[index]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const isListboxOpen = showSuggestions && suggestions.length > 0;
  const activeSuggestion =
    isListboxOpen && activeIndex >= 0 ? suggestions[activeIndex] : null;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label="Search for a bird"
          aria-autocomplete="list"
          aria-expanded={isListboxOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeSuggestion
              ? `${listboxId}-option-${activeSuggestion.id}`
              : undefined
          }
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
          autoComplete="off"
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue("");
              setSuggestions([]);
              setShowSuggestions(false);
              setActiveIndex(-1);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isListboxOpen && (
        <div
          ref={suggestionsRef}
          id={listboxId}
          role="listbox"
          aria-label="Bird suggestions"
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {suggestions.map((bird, index) => (
            <button
              key={bird.id}
              id={`${listboxId}-option-${bird.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => handleSubmit(bird)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-100 last:border-b-0 ${
                index === activeIndex ? "bg-red-100" : "hover:bg-red-50"
              }`}
              type="button"
            >
              <div className="font-medium text-gray-900">{bird.name}</div>
              <div className="text-sm text-gray-500 italic">
                {bird.scientificName}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions &&
        inputValue.length >= 2 &&
        suggestions.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 text-gray-500">
            No birds found matching "{inputValue}"
          </div>
        )}
    </div>
  );
}
