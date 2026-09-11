"use client";

interface FilterToggleProps {
  pressed: boolean;
  urgent?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function FilterToggle({ pressed, urgent, onToggle, children }: FilterToggleProps) {
  return (
    <button
      className={`toggle${urgent ? " urgent" : ""}`}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      <span className="sw" />
      {" "}{children}
    </button>
  );
}
