import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./site.css";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataCredits, PrivacyLine } from "@sot/core/ui/Footer";
import { WebNav } from "./_nav/WebNav";

export const metadata: Metadata = {
  title: "Standard of Taste",
  description: "Words about your own taste that you can check. Everything stays in this browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site">
          <header className="site-head">
            <Link className="label site-name" href="/">
              Standard of Taste
            </Link>
          </header>
          <main className="site-main">
            <WebNav>{children}</WebNav>
          </main>
          <footer className="site-foot stack">
            <PrivacyLine />
            <DataCredits />
          </footer>
        </div>
      </body>
    </html>
  );
}
