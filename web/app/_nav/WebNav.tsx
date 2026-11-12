"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { NavContext, type View } from "@sot/core/ui/nav";

const PATH: Record<View, string> = {
  home: "/",
  songs: "/songs/",
  "look-back": "/look-back/",
  note: "/note/",
  judge: "/judge/",
  numbers: "/my-numbers/",
  reading: "/reading/",
  "example-song": "/", // the example song card lives in the panel
};

export function WebNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <NavContext.Provider value={{ go: (v) => router.push(PATH[v]), href: (v) => PATH[v] }}>{children}</NavContext.Provider>;
}
