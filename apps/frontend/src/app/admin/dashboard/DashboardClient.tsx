"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminShell from "@/components/web/AdminShell";
import { Tile, HBar } from "@/components/ui";
import { IList } from "@/components/mock/mock-icons";
import { STATUS_LABEL, type VerifyStatus } from "@/lib/types";
import { listAdminReports, AdminApiError, type AdminReportList } from "@/lib/api/admin";
import { getAccessToken } from "@/lib/admin-auth";

const ORDER: VerifyStatus[] = [
  "unverified",
  "reviewing",
  "confirmed",
  "disputed",
  "debunked",
  "corrected",
];

export default function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<AdminReportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/admin/login");
      return;
    }
    (async () => {
      try {
        const res = await listAdminReports({ limit: 8 });
        setData(res);
      } catch (e) {
        if (e instanceof AdminApiError && e.status === 401) {
          router.push("/admin/login");
          return;
        }
        setError(e instanceof AdminApiError ? e.message : "현황을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;
  const maxCount = Math.max(1, ...ORDER.map((s) => counts[s] ?? 0));

  return (
    <AdminShell
      active="dashboard"
      title="대시보드"
      sub={loading ? "불러오는 중…" : "제9회 지방선거 · 운영 현황"}
    >
      <div className="tiles">
        <Tile tone="pt-rl" label="총 제보" value={String(total)} note="전체" dir="dn" />
        <Tile tone="pt-red" label="검증 대기" value={String(counts.unverified ?? 0)} note="검토 큐" dir="dn" />
        <Tile tone="pt-g" label="검토중" value={String(counts.reviewing ?? 0)} note="진행" dir="dn" />
        <Tile tone="pt-dk" label="사실확인" value={String(counts.confirmed ?? 0)} note="완료" dir="dn" />
      </div>
      <div className="prow adm">
        <div className="panel">
          <div className="ph">
            최근 제보{" "}
            <Link href="/admin/queue" className="more">
              검토 큐
            </Link>
          </div>
          {error ? (
            <div className="empty" style={{ background: "#fff" }}>
              <div className="ic">
                <IList size={22} />
              </div>
              <h4>현황을 불러오지 못했습니다</h4>
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="empty" style={{ background: "#fff" }}>
              <h4>불러오는 중…</h4>
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="empty" style={{ background: "#fff" }}>
              <div className="ic">
                <IList size={22} />
              </div>
              <h4>접수된 제보가 없습니다</h4>
              <p>제보가 들어오면 이곳과 검토 큐에 표시됩니다.</p>
            </div>
          ) : (
            <div className="tblw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>제목</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/admin/evidence?id=${encodeURIComponent(r.id)}`)}
                    >
                      <td className="mut">{STATUS_LABEL[r.status as VerifyStatus] ?? r.status}</td>
                      <td className="nm">{r.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="ph">상태별 분포</div>
          {ORDER.map((s, i) => (
            <HBar
              key={s}
              label={STATUS_LABEL[s]}
              value={counts[s] ?? 0}
              width={`${Math.round(((counts[s] ?? 0) / maxCount) * 100)}%`}
              last={i === ORDER.length - 1}
            />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
