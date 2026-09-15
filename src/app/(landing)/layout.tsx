import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MYTHRIL · Neo-Brutalist Sprint Kanban & Project Management",
  description:
    "High-velocity Neo-Brutalist Sprint Kanban dashboard. 3px grid. Hard shadows. Zero fluff. Built with Next.js 15, React 19, TypeScript & PostgreSQL.",
  alternates: {
    canonical: "/",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
