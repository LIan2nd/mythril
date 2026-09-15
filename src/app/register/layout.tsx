import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request Access",
  description: "Request an account to join the MYTHRIL sprint workspace.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
