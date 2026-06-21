"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type Category,
  type VerifyStatus,
} from "@/lib/types";
import {
  loadArchiveSummaries,
  recordCategory,
  type ArchiveSummary,
} from "@/lib/archive-source";
import { IGrid, ISearch, IPin, IChart } from "@/components/mock/mock-icons";
import Torch from "@/components/landing/Torch";

const CATS: Category[] = ["A", "B", "C"];
const STATUSES: VerifyStatus[] = ["confirmed", "suspected", "disputed", "debunked", "corrected"];

// VerifyStatus → 실제 존재하는 칩 CSS 클래스 suffix(`chip c-<suffix>`).
const STATUS_CHIP_CLASS: Record<string, string> = {
  unverified: "unv",
  reviewing: "rev",
  confirmed: "cnf",
  suspected: "sus",
  disputed: "dis",
  debunked: "deb",
  corrected: "cor",
};

function statusChipClass(status: string): string {
  return STATUS_CHIP_CLASS[status] ?? "unv";
}

/** 카드가 쓰는 최소 필드 — 공개 요약(ReportSummary)과 상세(Report) 양쪽이 만족한다. */
interface CardRecord {
  id: string;
  status: string;
  title: string;
  summary?: string | null;
  region?: { sido?: string; sigungu?: string; eup_myeon_dong?: string };
  tags?: string[];
  attachment_count?: number;
  attachments?: unknown[];
}

function regionText(r: CardRecord): string {
  return [r.region?.sido, r.region?.sigungu].filter(Boolean).join(" ");
}

/** 아카이브/검색 공용 레코드 카드. 상세는 빌드된 정적 페이지(/archive/[id], md 기반). */
export function RecordCard({ r }: { r: CardRecord }) {
  const region = regionText(r);
  const att = r.attachment_count ?? r.attachments?.length ?? 0;
  return (
    <Link
      href={`/archive/${encodeURIComponent(r.id)}`}
      className="rdoc"
      style={{ display: "block", maxWidth: "none", margin: "0 0 12px", padding: "16px 18px" }}
    >
      <div className="rdh" style={{ marginBottom: 8 }}>
        <span className={`chip c-${statusChipClass(r.status)} sm`}>
          <span className="pt" />
          {STATUS_LABEL[r.status as VerifyStatus] ?? r.status}
        </span>
        <span className="rid">{r.id}</span>
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{r.title}</h3>
      {r.summary && (
        <div className="sum" style={{ fontSize: 13.5, marginBottom: 10 }}>
          {r.summary}
        </div>
      )}
      <div className="meta" style={{ marginBottom: 0 }}>
        {region && <span>{region}</span>}
        {(r.tags ?? []).map((t) => (
          <span key={t}>{t}</span>
        ))}
        {att > 0 && <span>첨부 {att}</span>}
      </div>
    </Link>
  );
}

/** 실동작 아카이브: 빌드된 정적 인덱스(archive.generated.json) 기반 목록 + 필터·정렬 토글. */
export default function ArchiveClient() {
  const [records, setRecords] = useState<ArchiveSummary[] | null>(null);
  const [sort, setSort] = useState<"all" | "recent">("all");
  const [cat, setCat] = useState<Category | null>(null);
  const [status, setStatus] = useState<VerifyStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadArchiveSummaries().then((rs) => {
      if (!cancelled) setRecords(rs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const all = records ?? [];
  const loading = records === null;

  const counts = useMemo(() => {
    const c: Record<Category, number> = { A: 0, B: 0, C: 0 };
    for (const r of all) {
      const k = recordCategory(r);
      if (k) c[k]++;
    }
    return c;
  }, [all]);

  const total = all.length;

  const list = useMemo(() => {
    const q = "";
    let out = all.filter((r) => {
      if (cat && recordCategory(r) !== cat) return false;
      if (status && r.status !== status) return false;
      void q;
      return true;
    });
    if (sort === "recent") {
      out = [...out].sort((a, b) => (b.collected_at ?? "").localeCompare(a.collected_at ?? ""));
    }
    return out;
  }, [all, cat, status, sort]);

  return (
    <div className="win" style={{ boxShadow: "none", borderRadius: 14, marginTop: 4 }}>
      <div className="dash">
        <aside className="dside">
          <div className="ds-logo">
            <Torch size={24} />아카이브
          </div>
          <div className="ds-sec">아카이브</div>
          <div className="ds-item on">
            <IGrid />전체 기록<span className="cnt">{total}</span>
          </div>
          <Link href="/search" className="ds-item">
            <ISearch />검색
          </Link>
          <div className="ds-item">
            <IPin />지도
          </div>
          <Link href="/stats" className="ds-item">
            <IChart />통계
          </Link>
          <div className="ds-sec">카테고리</div>
          {CATS.map((c) => (
            <div
              key={c}
              className="ds-stat"
              style={{ cursor: "pointer", borderRadius: 9, background: cat === c ? "var(--red-bg)" : undefined }}
              onClick={() => setCat(cat === c ? null : c)}
            >
              <span className={`catb cat-${c.toLowerCase()}`} style={{ width: 16, height: 16, lineHeight: "16px", fontSize: 9 }}>
                {c}
              </span>
              {CATEGORY_LABEL[c]}
              <span className="cnt">{counts[c]}</span>
            </div>
          ))}
        </aside>

        <div className="dmain">
          <div className="dh">
            <div>
              <h3>전체 기록</h3>
              <div className="sub">
                제9회 지방선거 · {list.length}건
                {cat && ` · ${CATEGORY_LABEL[cat]}`}
                {status && ` · ${STATUS_LABEL[status]}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href="/search" className="dsearch">
                <ISearch size={13} />검색
              </Link>
              <div className="seg">
                <b className={sort === "all" ? "on" : ""} onClick={() => setSort("all")}>
                  전체
                </b>
                <b className={sort === "recent" ? "on" : ""} onClick={() => setSort("recent")}>
                  최신
                </b>
              </div>
            </div>
          </div>

          <div className="fchips">
            <b className={!status ? "on" : ""} onClick={() => setStatus(null)}>
              전체 상태
            </b>
            {STATUSES.map((s) => (
              <b key={s} className={status === s ? "on" : ""} onClick={() => setStatus(status === s ? null : s)}>
                {STATUS_LABEL[s]}
              </b>
            ))}
          </div>

          {loading ? (
            <div className="empty">
              <div className="ic">
                <IGrid size={22} />
              </div>
              <h4>불러오는 중…</h4>
            </div>
          ) : list.length === 0 ? (
            <div className="empty">
              <div className="ic">
                <IGrid size={22} />
              </div>
              <h4>표시할 기록이 없습니다</h4>
              <p>
                {total === 0
                  ? "아직 공개된 레코드가 없습니다. 검증을 통과한 제보만 이곳에 반영됩니다."
                  : "선택한 조건에 해당하는 기록이 없습니다. 필터를 바꿔보세요."}
                <br />
                현장을 보셨다면 <Link href="/report" style={{ color: "var(--red)", fontWeight: 700 }}>제보</Link>로 남겨주세요.
              </p>
            </div>
          ) : (
            <div>
              {list.map((r) => (
                <RecordCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
