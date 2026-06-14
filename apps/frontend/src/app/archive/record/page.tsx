import { Suspense } from "react";
import "../../app-shell.css";
import SiteHeader from "@/components/layout/SiteHeader";
import RecordClient from "./RecordClient";

export const metadata = { title: "공개 레코드 — Votatis" };

// 런타임 API 조회 상세(spec 0016). 빌드타임에 모르는 id 도 ?id= 쿼리로 조회한다.
// (정적 build 준비: 빌드타임 id 는 /archive/[id] SSG 라우트가 별도로 커버.)
export default function ArchiveRecordPage() {
  return (
    <>
      <SiteHeader />
      <div className="page-wrap">
        <Suspense fallback={<div className="rdoc">불러오는 중…</div>}>
          <RecordClient />
        </Suspense>
      </div>
    </>
  );
}
