"use client";

import { useBoard } from "../lib/store";

export function SearchBox() {
  const { filters, setFilters } = useBoard();
  return (
    <label className="searchbox">
      <input
        type="search"
        placeholder="SEARCH MY-104..."
        aria-label="Search issues"
        value={filters.query}
        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
      />
      <span>⌕</span>
    </label>
  );
}
