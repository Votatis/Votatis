import "../app-shell.css";
import SiteHeader from "@/components/layout/SiteHeader";
import { IChart } from "@/components/mock/mock-icons";
import { archiveStats } from "@/lib/archive";
import { CATEGORY_FULL, STATUS_LABEL, type Category, type VerifyStatus } from "@/lib/types";

export const metadata = { title: "통계 — Votatis" };

const CATS: Category[] = ["A", "B", "C"];
const STATUSES: VerifyStatus[] = [
  "confirmed",
  "reviewing",
  "unverified",
  "suspected",
  "disputed",
  "debunked",
  "corrected",
];

function pct(count: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.round((count / max) * 100)}%`;
}

export default function StatsPage() {
  const stats = archiveStats();
  const dailyMax = Math.max(0, ...stats.daily.map((d) => d.count));
  const catMax = Math.max(0, ...CATS.map((c) => stats.byCategory[c] ?? 0));
  const statusRows = STATUSES.map((s) => ({ s, count: stats.byStatus[s] ?? 0 })).filter((r) => r.count > 0);
  const statusMax = Math.max(0, ...statusRows.map((r) => r.count));

  return (
    <>
      <SiteHeader />
      <div className="page-wrap">
        <div className="page-head">
          <h1>통계</h1>
          <div className="sub">유형·지역·시점별 분포를 집계해 공개합니다. 모든 수치는 검증 상태별로 구분됩니다.</div>
        </div>

        <div className="chartc" style={{ marginBottom: 12 }}>
          <div className="t">일자별 제보 접수 추이 · 총 {stats.total}건</div>
          {stats.daily.length === 0 ? (
            <div className="empty" style={{ background: "#fff" }}>
              <div className="ic">
                <IChart size={22} />
              </div>
              <h4>집계할 데이터가 없습니다</h4>
              <p>제보가 쌓이면 일자별 접수·검증 추이가 이곳에 표시됩니다.</p>
            </div>
          ) : (
            stats.daily.map((d, i) => (
              <div className="hbar" key={d.date} style={i === stats.daily.length - 1 ? { marginBottom: 0 } : undefined}>
                <div className="hl">
                  <span>{d.date}</span>
                  <b>{d.count}</b>
                </div>
                <div className="track">
                  <i style={{ width: pct(d.count, dailyMax) }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="vizg">
          <div className="chartc">
            <div className="t">카테고리별 분포</div>
            {CATS.map((c, i) => {
              const count = stats.byCategory[c] ?? 0;
              return (
                <div className="hbar" key={c} style={i === CATS.length - 1 ? { marginBottom: 0 } : undefined}>
                  <div className="hl">
                    <span>{CATEGORY_FULL[c]}</span>
                    <b>{count}</b>
                  </div>
                  <div className="track">
                    <i style={{ width: pct(count, catMax) }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="chartc">
            <div className="t">검증 상태별 분포</div>
            {statusRows.length === 0 ? (
              <div className="kv">집계할 상태 데이터가 없습니다.</div>
            ) : (
              statusRows.map((r, i) => (
                <div className="hbar" key={r.s} style={i === statusRows.length - 1 ? { marginBottom: 0 } : undefined}>
                  <div className="hl">
                    <span>{STATUS_LABEL[r.s]}</span>
                    <b>{r.count}</b>
                  </div>
                  <div className="track">
                    <i style={{ width: pct(r.count, statusMax) }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
