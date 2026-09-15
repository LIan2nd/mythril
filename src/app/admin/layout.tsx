import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "Manage users, project rosters, and board columns in MYTHRIL.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
