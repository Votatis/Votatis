import "../app-shell.css";
import SiteHeader from "@/components/layout/SiteHeader";
import ArchiveClient from "./ArchiveClient";
import { allSummaries } from "@/lib/archive";

export const metadata = { title: "공개 아카이브 — Votatis" };

// 목록을 빌드타임에 서버 렌더(SSG): 정적 인덱스를 prop 으로 주입해 HTML 에 직접 담는다.
export default function ArchivePage() {
  return (
    <>
      <SiteHeader />
      <div className="page-wrap">
        <div className="page-head">
          <h1>공개 아카이브</h1>
          <div className="sub">검증을 통과한 기록만 공개됩니다. 모든 기록에는 검증 상태가 함께 표시됩니다.</div>
        </div>
        <ArchiveClient initial={allSummaries()} />
      </div>
    </>
  );
}
