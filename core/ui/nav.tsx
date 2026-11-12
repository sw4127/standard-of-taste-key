"use client";
/**
 * The same screens run in the panel and on the website. Each host says how to move between views:
 * the website by address, the panel by swapping what it shows.
 */
import { createContext, useContext, type ReactNode } from "react";

export type View = "home" | "songs" | "look-back" | "note" | "example-song" | "judge" | "numbers" | "reading";

export interface Nav {
  go: (v: View) => void;
  /** The website gives addresses, so links behave as links; the panel gives none. */
  href?: (v: View) => string;
}

export const NavContext = createContext<Nav>({ go: () => {} });

export function Go({ to, children, className = "act", onGo }: { to: View; children: ReactNode; className?: string; onGo?: () => void }) {
  const nav = useContext(NavContext);
  if (nav.href) {
    return (
      <a
        className={className}
        href={nav.href(to)}
        onClick={(e) => {
          onGo?.();
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          nav.go(to);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={() => { onGo?.(); nav.go(to); }}>
      {children}
    </button>
  );
}

/** Marks anything made up (rule 8). */
export function ExampleLabel({ children }: { children: ReactNode }) {
  return (
    <p className="card slim label example-label">
      <span className="example-tag">Example</span> {children}
    </p>
  );
}

/** A source named in the evidence: a link when it has a page, plain text when it does not. */
export function SourceRef({ source }: { source: { label: string; url?: string } }) {
  return source.url ? (
    <a className="act" href={source.url} target="_blank" rel="noreferrer">
      {source.label}
    </a>
  ) : (
    <span>{source.label}</span>
  );
}
