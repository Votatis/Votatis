import { Suspense } from "react";
import EvidenceClient from "./EvidenceClient";

export const metadata = { title: "원본 데이터 검수 — Votatis" };

export default function EvidencePage() {
  return (
    <Suspense fallback={null}>
      <EvidenceClient />
    </Suspense>
  );
}
