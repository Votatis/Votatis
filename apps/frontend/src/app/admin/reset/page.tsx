import { Suspense } from "react";
import ResetClient from "./ResetClient";

export const metadata = { title: "비밀번호 설정 — Votatis" };

export default function AdminResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetClient />
    </Suspense>
  );
}
