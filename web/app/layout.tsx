import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./site.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFoot, SiteHead } from "@sot/core/ui/Chrome";
import { WebNav } from "./_nav/WebNav";

export const metadata: Metadata = {
  title: "Standard of Taste",
  description: "Words about your own taste that you can check. Everything stays in this browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebNav>
          <div className="site">
            <SiteHead />
            <main className="site-main">{children}</main>
            <SiteFoot />
          </div>
        </WebNav>
      </body>
    </html>
  );
}
