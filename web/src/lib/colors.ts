const TOKENS: Record<string, string> = {
  lav: "var(--lav)",
  lavender: "var(--lav)",
  yellow: "var(--yellow)",
  coral: "var(--coral)",
  mint: "var(--mint)",
  sky: "var(--sky)",
};

export function colorToken(color: string | null | undefined): string {
  return (color && TOKENS[color]) || "var(--lav)";
}
