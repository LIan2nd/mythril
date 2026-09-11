"use client";

import { useBoard } from "../lib/store";
import { FilterToggle } from "./FilterToggle";

export function FilterBar() {
  const { filters, setFilters, toggleDark, dark, shown, total } = useBoard();
  return (
    <section className="filterbar" aria-label="Quick filters">
      <FilterToggle
        pressed={filters.mine}
        onToggle={() => setFilters({ ...filters, mine: !filters.mine })}
      >
        My issues only
      </FilterToggle>
      <FilterToggle
        pressed={filters.urgent}
        urgent
        onToggle={() => setFilters({ ...filters, urgent: !filters.urgent })}
      >
        Urgent bugs
      </FilterToggle>
      <FilterToggle pressed={dark} onToggle={toggleDark}>
        Dark mode
      </FilterToggle>
      <span className="filter-note">
        Showing {shown} / {total}
      </span>
    </section>
  );
}
