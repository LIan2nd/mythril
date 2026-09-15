import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Profile",
  description: "Manage your MYTHRIL identity, password, and custom avatar.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
