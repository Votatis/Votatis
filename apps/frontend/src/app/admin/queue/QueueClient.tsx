"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/web/AdminShell";
import { Tile } from "@/components/ui";
import { ICheckSq } from "@/components/mock/mock-icons";
import { STATUS_LABEL, type VerifyStatus } from "@/lib/types";
import {
  listAdminReports,
  AdminApiError,
  type AdminReportList,
  type AdminReportSummary,
} from "@/lib/api/admin";
import { getAccessToken } from "@/lib/admin-auth";

// 탭 → 실제 검증 상태. 대기=unverified, 검토중=reviewing, 완료=confirmed,
// 그 외 판정(이견/반박/정정)은 "그외" 탭에서 status 미지정으로 전체를 본다.
const TABS: { key: string; label: string; status?: VerifyStatus }[] = [
  { key: "unverified", label: "대기", status: "unverified" },
  { key: "reviewing", label: "검토중", status: "reviewing" },
  { key: "confirmed", label: "완료", status: "confirmed" },
  { key: "all", label: "전체", status: undefined },
];

const STATUS_CHIP_CLASS: Record<string, string> = {
  unverified: "unv",
  reviewing: "rev",
  confirmed: "cnf",
  suspected: "sus",
  disputed: "dis",
  debunked: "deb",
  corrected: "cor",
};

function chipClass(status: string): string {
  return STATUS_CHIP_CLASS[status] ?? "unv";
}

function regionText(r: AdminReportSummary): string {
  return [r.region?.sido, r.region?.sigungu].filter(Boolean).join(" ");
}

export default function QueueClient() {
  const router = useRouter();
  const [tab, setTab] = useState<string>("unverified");
  const [q, setQ] = useState("");
  const [data, setData] = useState<AdminReportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  const load = useCallback(
    async (status: VerifyStatus | undefined, query: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listAdminReports({ status, q: query });
        setData(res);
      } catch (e) {
        if (e instanceof AdminApiError && e.status === 401) {
          router.push("/admin/login");
          return;
        }
        setError(e instanceof AdminApiError ? e.message : "큐를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/admin/login");
      return;
    }
    load(active.status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const counts = data?.counts ?? {};
  const items = data?.items ?? [];

  return (
    <AdminShell
      active="queue"
      title="검토 큐"
      sub={loading ? "불러오는 중…" : `검증 대기 ${counts.unverified ?? 0}건`}
      right={
        <div className="seg">
          {TABS.map((t) => (
            <b key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </b>
          ))}
        </div>
      }
    >
      <div className="tiles">
        <Tile tone="pt-rl" label="대기" value={String(counts.unverified ?? 0)} note="미검증" dir="dn" />
        <Tile tone="pt-red" label="검토중" value={String(counts.reviewing ?? 0)} note="진행" dir="dn" />
        <Tile tone="pt-g" label="사실확인" value={String(counts.confirmed ?? 0)} note="완료" dir="dn" />
        <Tile
          tone="pt-dk"
          label="의심·반박·이견"
          value={String((counts.suspected ?? 0) + (counts.debunked ?? 0) + (counts.disputed ?? 0))}
          note="누적"
          dir="dn"
        />
      </div>
      <div className="prow adm">
        <div className="panel">
          <div className="ph">
            {active.label} 항목 <span className="more">최신순</span>
          </div>
          <input
            className="inp"
            type="search"
            placeholder="제목·요약 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(active.status, q);
            }}
            style={{ marginBottom: 12 }}
          />
          {error ? (
            <div className="empty" style={{ background: "#fff" }}>
              <div className="ic">
                <ICheckSq size={22} />
              </div>
              <h4>큐를 불러오지 못했습니다</h4>
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="empty" style={{ background: "#fff" }}>
              <h4>불러오는 중…</h4>
            </div>
          ) : items.length === 0 ? (
            <div className="empty" style={{ background: "#fff" }}>
              <div className="ic">
                <ICheckSq size={22} />
              </div>
              <h4>표시할 항목이 없습니다</h4>
              <p>제보가 접수되면 검토 큐에 등록되어 이곳에 나타납니다.</p>
            </div>
          ) : (
            <div className="tblw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>제목</th>
                    <th>지역</th>
                    <th>첨부</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} onClick={() => router.push(`/admin/evidence?id=${encodeURIComponent(r.id)}`)}>
                      <td>
                        <span className={`chip sm c-${chipClass(r.status)}`}>
                          <span className="pt" />
                          {STATUS_LABEL[r.status as VerifyStatus] ?? r.status}
                        </span>
                      </td>
                      <td className="nm">{r.title}</td>
                      <td className="mut">{regionText(r) || "—"}</td>
                      <td className="mut">{r.attachment_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="ph">검증 패널</div>
          <p style={{ fontSize: 12, color: "var(--g500)", lineHeight: 1.6, overflowWrap: "anywhere", wordBreak: "break-word" }}>
            왼쪽에서 항목을 선택하면 원본 대조·근거 입력 화면으로 이동합니다. 사실확인/이견/반박/정정
            판정은 검증 방법과 최소 1개의 근거 링크가 필수입니다.
          </p>
          <div className="act" style={{ marginTop: "auto", opacity: 0.5, pointerEvents: "none" }}>
            <div className="a1">사실확인</div>
            <div className="a2">검토중</div>
            <div className="a3">✕</div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
