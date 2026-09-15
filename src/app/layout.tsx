import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://mythril.dev"),
  title: {
    default: "MYTHRIL · Neo-Brutalist Sprint Kanban",
    template: "%s | MYTHRIL",
  },
  description:
    "High-velocity Neo-Brutalist Sprint Kanban & Project Management dashboard. Built with Next.js 15, TypeScript, and PostgreSQL. Hard shadows, zero fluff.",
  keywords: [
    "kanban",
    "sprint dashboard",
    "neo-brutalism",
    "project management",
    "nextjs",
    "typescript",
    "postgresql",
    "agile",
    "developer tools",
  ],
  authors: [{ name: "MYTHRIL Team" }],
  creator: "MYTHRIL",
  publisher: "MYTHRIL",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "MYTHRIL",
    title: "MYTHRIL · Neo-Brutalist Sprint Kanban",
    description:
      "High-velocity Neo-Brutalist Sprint Kanban & Project Management dashboard. 3px grid. Hard shadows. No fluff.",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "MYTHRIL Neo-Brutalist Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "MYTHRIL · Neo-Brutalist Sprint Kanban",
    description:
      "High-velocity Neo-Brutalist Sprint Kanban & Project Management dashboard. 3px grid. Hard shadows. No fluff.",
    creator: "@mythril_dev",
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFE600" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "MYTHRIL",
  url: "https://mythril.dev",
  description:
    "High-velocity Neo-Brutalist Sprint Kanban & Project Management dashboard with live sprint tracking, RBAC, and in-place stage reordering.",
  applicationCategory: "ProjectManagementApplication",
  operatingSystem: "All",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Neo-Brutalist Kanban Board",
    "Interactive Sprint Settings & Health Metrics",
    "In-Place Column Stage Reordering",
    "Multi-Project Organization",
    "Role-Based Access Control (RBAC)",
  ],
};

const themeInit = `(function(){try{var t=localStorage.getItem('mythril-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
