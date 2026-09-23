import type { ReactNode } from "react";
import { SuzukiSpecialFinishGuard } from "@/components/suzuki-special-finish-guard";
import { SuzukiSpecialRitual } from "@/components/suzuki-special-ritual";

export default function StampRallyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SuzukiSpecialRitual />
      <SuzukiSpecialFinishGuard />
      {children}
    </>
  );
}
