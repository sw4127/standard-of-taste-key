import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./site.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DataCredits, PrivacyLine } from "@sot/core/ui/Footer";

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
            <a className="label site-name" href="/">
              Standard of Taste
            </a>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-foot stack">
            <PrivacyLine />
            <DataCredits />
          </footer>
        </div>
      </body>
    </html>
  );
}
