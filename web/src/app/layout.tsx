import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYTHRIL · Sprint #14 Dashboard",
};

const themeInit = `(function(){try{var t=localStorage.getItem('mythril-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
