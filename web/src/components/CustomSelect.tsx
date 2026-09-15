"use client";

import { useEffect, useRef, useState, useId } from "react";

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  placeholder?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  id,
  className = "",
  style,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
  placeholder = "Select...",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const autoId = useId();
  const selectId = id || autoId;

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        let next = prev + 1;
        while (next < options.length && options[next].disabled) next++;
        return next < options.length ? next : prev;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && options[next].disabled) next--;
        return next >= 0 ? next : prev;
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        const opt = options[highlightedIndex];
        if (!opt.disabled) {
          onChange(opt.value);
          setOpen(false);
          buttonRef.current?.focus();
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`neo-select-wrap ${className}`}
      style={style}
    >
      <button
        ref={buttonRef}
        type="button"
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        className={`neo-select-btn${open ? " active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
      >
        <span className="neo-select-text">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`neo-select-chevron${open ? " rotated" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          className="neo-select-menu"
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                className={`neo-select-item${isSelected ? " selected" : ""}${
                  isHighlighted ? " highlighted" : ""
                }${opt.disabled ? " disabled" : ""}`}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                onMouseEnter={() => {
                  if (!opt.disabled) setHighlightedIndex(index);
                }}
              >
                <span className="neo-select-item-label">{opt.label}</span>
                {isSelected && <span className="neo-select-item-check" aria-hidden="true">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
