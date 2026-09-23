import type { ReactNode } from "react";
import { SuzukiSpecialRitual } from "@/components/suzuki-special-ritual";

export default function StampRallyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SuzukiSpecialRitual />
      {children}
    </>
  );
}
