"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/web/AdminShell";
import { getAccessToken } from "@/lib/admin-auth";
import { createAdminReport, AdminApiError } from "@/lib/api/admin";
import { type Category, CATEGORY_LABEL, CATEGORY_FULL, TYPE_SETS } from "@/lib/types";

const CATS: Category[] = ["A", "B", "C"];
const DEFAULT_ELECTION = "제9회 전국동시지방선거";

export default function NewReportClient() {
  const router = useRouter();
  const [election, setElection] = useState(DEFAULT_ELECTION);
  const [category, setCategory] = useState<Category>("A");
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [dong, setDong] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [sources, setSources] = useState<string[]>([""]);
  const [status, setStatus] = useState<"unverified" | "reviewing">("unverified");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) router.push("/admin/login");
  }, [router]);

  const valid = election.trim() && title.trim();

  async function onCreate() {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    // tags[0] = 카테고리 라벨(공개 흐름과 동일), tags[1] = 세부 유형(선택)
    const tags = [CATEGORY_FULL[category], type].map((t) => t.trim()).filter(Boolean);
    const cleanSources = sources
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url, type: "submitter" }));
    try {
      const created = await createAdminReport({
        election: election.trim(),
        title: title.trim(),
        summary: summary.trim() || undefined,
        body: body.trim() || undefined,
        region: { sido: sido.trim() || undefined, sigungu: sigungu.trim() || undefined, eup_myeon_dong: dong.trim() || undefined },
        occurred_at: occurredAt.trim() || undefined,
        tags,
        sources: cleanSources.length ? cleanSources : undefined,
        status,
      });
      // 등록 후 바로 검수(원본 데이터) 화면으로 이동.
      router.push(`/admin/evidence?id=${encodeURIComponent(created.id)}`);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        router.push("/admin/login");
        return;
      }
      setError(e instanceof AdminApiError ? e.message : "제보 등록에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <AdminShell active="reports" title="제보 등록" sub="검증자가 현장 제보를 직접 등록합니다(검수 전 상태로 생성)">
      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="ph">새 제보</div>

        <div className="kv">
          <b>선거 *</b>
        </div>
        <input className="inp" type="text" value={election} onChange={(e) => setElection(e.target.value)} />

        <div className="kv">
          <b>카테고리 *</b>
        </div>
        <div className="seg" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          {CATS.map((c) => (
            <b
              key={c}
              className={category === c ? "on" : ""}
              onClick={() => {
                setCategory(c);
                setType("");
              }}
            >
              {CATEGORY_LABEL[c]}
            </b>
          ))}
        </div>

        <div className="kv">
          <b>세부 유형</b>
        </div>
        <div className="seg" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          {TYPE_SETS[category].map((t) => (
            <b key={t} className={type === t ? "on" : ""} onClick={() => setType(type === t ? "" : t)}>
              {t}
            </b>
          ))}
        </div>

        <div className="kv">
          <b>제목 *</b>
        </div>
        <input className="inp" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="kv">
          <b>요약</b>
        </div>
        <input className="inp" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} />

        <div className="kv">
          <b>본문</b>
        </div>
        <textarea
          className="inp"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          style={{ height: "auto", minHeight: 110, padding: "10px 14px", resize: "vertical", display: "block" }}
        />

        <div className="kv">
          <b>지역(시도 / 시군구 / 읍면동)</b>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="inp" type="text" placeholder="시도" value={sido} onChange={(e) => setSido(e.target.value)} />
          <input className="inp" type="text" placeholder="시군구" value={sigungu} onChange={(e) => setSigungu(e.target.value)} />
          <input className="inp" type="text" placeholder="읍면동" value={dong} onChange={(e) => setDong(e.target.value)} />
        </div>

        <div className="kv">
          <b>발생 일시(ISO, 선택)</b>
        </div>
        <input
          className="inp"
          type="text"
          placeholder="2026-06-03T16:20:00+09:00"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />

        <div className="kv">
          <b>출처 URL</b>
        </div>
        {sources.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="inp"
              type="url"
              placeholder="https://…"
              value={s}
              onChange={(e) => {
                const next = [...sources];
                next[i] = e.target.value;
                setSources(next);
              }}
              style={{ flex: 1 }}
            />
            {sources.length > 1 && (
              <div className="act" style={{ marginTop: 0, marginBottom: 11 }} onClick={() => setSources(sources.filter((_, j) => j !== i))}>
                <div className="a3">✕</div>
              </div>
            )}
          </div>
        ))}
        <div className="seg" style={{ marginBottom: 12 }}>
          <b onClick={() => setSources([...sources, ""])}>+ 출처 추가</b>
        </div>

        <div className="kv">
          <b>등록 상태</b>
        </div>
        <div className="seg" style={{ marginBottom: 12 }}>
          <b className={status === "unverified" ? "on" : ""} onClick={() => setStatus("unverified")}>
            미검증
          </b>
          <b className={status === "reviewing" ? "on" : ""} onClick={() => setStatus("reviewing")}>
            검토중
          </b>
        </div>

        {error && (
          <div className="kv" style={{ color: "var(--red-strong)", fontWeight: 700 }}>
            {error}
          </div>
        )}
        <div className="act">
          <div className="a1" style={!valid || busy ? { opacity: 0.6, pointerEvents: "none" } : undefined} onClick={onCreate}>
            {busy ? "등록 중…" : "제보 등록"}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
