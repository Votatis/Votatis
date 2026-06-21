import "../../app-shell.css";
import Link from "next/link";
import SiteHeader from "@/components/layout/SiteHeader";
import { ArchiveDetail, ArchiveNotFound } from "@/components/archive/ArchiveDetail";
import { allSummaries, getSummary } from "@/lib/archive";
import { readRecordMarkdown } from "@/lib/archive-md";

// 정적 export(SSG): 빌드타임 인덱스(archive.generated.json, 슬림 요약)의 실 id 를 열거한다.
// 데이터가 0건이어도 빌드가 성공하도록 sentinel("none")을 둔다(dynamicParams=false).
// 상세 풀데이터는 인덱스가 아니라 각 .md 에서 빌드타임에 파싱해 렌더한다(archive-md).
// 런타임에 새로 승인된 레코드는 /archive/record?id= (API 연동, spec 0016)가 커버한다.
export const dynamicParams = false;
export function generateStaticParams(): { id: string }[] {
  const ids = allSummaries().map((r) => ({ id: r.id }));
  return ids.length ? ids : [{ id: "none" }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getSummary(id);
  return { title: `${s ? s.title : id} — Votatis 레코드` };
}

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getSummary(id);
  const r = s ? readRecordMarkdown(s.election, id) : null;

  return (
    <>
      <SiteHeader />
      <div className="page-wrap">
        <div style={{ marginBottom: 14 }}>
          <Link href="/archive" style={{ fontSize: 13, fontWeight: 700, color: "var(--g600)" }}>
            ← 아카이브
          </Link>
        </div>
        {!r || id === "none" ? <ArchiveNotFound id={id} /> : <ArchiveDetail r={r} />}
      </div>
    </>
  );
}
