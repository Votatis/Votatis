"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminShell from "@/components/web/AdminShell";
import { IShield, IImage } from "@/components/mock/mock-icons";
import { STATUS_LABEL, type VerifyStatus } from "@/lib/types";
import {
  getAdminReport,
  patchAdminReport,
  fetchAttachmentObjectUrl,
  AdminApiError,
  type AdminReportDetail,
  type AdminPatch,
} from "@/lib/api/admin";
import { getAdminToken } from "@/lib/admin-auth";

const STATUSES: VerifyStatus[] = [
  "unverified",
  "reviewing",
  "confirmed",
  "disputed",
  "debunked",
  "corrected",
];

// 근거(검증 방법 + 링크 1개 이상)가 필수인 판정 상태. API 도 400 으로 강제(페르소나 5).
const JUDGED: VerifyStatus[] = ["confirmed", "disputed", "debunked", "corrected"];

interface Rebuttal {
  text: string;
  source_url?: string;
}

function regionText(r: AdminReportDetail): string {
  return [r.region?.sido, r.region?.sigungu, r.region?.eup_myeon_dong].filter(Boolean).join(" ");
}

export default function EvidenceClient() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [record, setRecord] = useState<AdminReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 첨부 objectURL (인덱스 → url). 언마운트/갱신 시 revoke.
  const [imgUrls, setImgUrls] = useState<Record<number, string>>({});
  const urlsRef = useRef<string[]>([]);

  // 판정 폼 상태.
  const [status, setStatus] = useState<VerifyStatus>("reviewing");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [tags, setTags] = useState("");
  const [rebuttals, setRebuttals] = useState<Rebuttal[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hydrate = useCallback((r: AdminReportDetail) => {
    setRecord(r);
    setStatus((r.status as VerifyStatus) ?? "reviewing");
    setMethod(r.verification?.method ?? "");
    setNotes(r.verification?.notes ?? "");
    const ev = r.verification?.evidence_links ?? [];
    setLinks(ev.length ? ev : [""]);
    setTags((r.tags ?? []).join(", "));
    setRebuttals((r.rebuttals ?? []).map((rb) => ({ text: rb.text, source_url: rb.source_url })));
  }, []);

  const loadRecord = useCallback(
    async (rid: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await getAdminReport(rid);
        hydrate(r);
      } catch (e) {
        if (e instanceof AdminApiError && e.status === 401) {
          router.push("/free/admin/login");
          return;
        }
        setLoadError(e instanceof AdminApiError ? e.message : "제보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [router, hydrate],
  );

  // 인증 가드 + 최초 로드.
  useEffect(() => {
    if (!getAdminToken()) {
      router.push("/free/admin/login");
      return;
    }
    if (id) loadRecord(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 첨부 이미지를 인증 하에 받아 objectURL 로. record 변경 시 이전 URL revoke.
  useEffect(() => {
    // 이전 URL 정리.
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
    setImgUrls({});
    if (!record || !id) return;
    let cancelled = false;
    const collected: string[] = [];
    (async () => {
      for (let i = 0; i < record.attachments.length; i++) {
        try {
          const url = await fetchAttachmentObjectUrl(id, i);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          collected.push(url);
          urlsRef.current = [...collected];
          setImgUrls((prev) => ({ ...prev, [i]: url }));
        } catch {
          // 개별 첨부 실패는 무시(빈 자리로 표시).
        }
      }
    })();
    return () => {
      cancelled = true;
      for (const u of collected) URL.revokeObjectURL(u);
    };
  }, [record, id]);

  // 언마운트 시 남은 URL revoke.
  useEffect(() => {
    return () => {
      for (const u of urlsRef.current) URL.revokeObjectURL(u);
    };
  }, []);

  const exifText = useMemo(() => {
    if (!record?.exif || record.exif.length === 0) return null;
    try {
      return JSON.stringify(record.exif, null, 2);
    } catch {
      return null;
    }
  }, [record]);

  const needsEvidence = JUDGED.includes(status);
  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);

  async function submit() {
    if (!id || !record || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const patch: AdminPatch = {
      status,
      verification: {
        method: method.trim() || undefined,
        notes: notes.trim() || undefined,
        evidence_links: cleanLinks,
      },
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      rebuttals: rebuttals
        .filter((rb) => rb.text.trim())
        .map((rb) => ({
          text: rb.text.trim(),
          ...(rb.source_url?.trim() ? { source_url: rb.source_url.trim() } : {}),
        })),
    };
    try {
      const updated = await patchAdminReport(id, patch);
      hydrate(updated);
      setSaved(true);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        router.push("/free/admin/login");
        return;
      }
      setSaveError(e instanceof AdminApiError ? e.message : "판정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // 근거 미충족 시 클라이언트 경고(서버도 400 으로 막음).
  const evidenceMissing = needsEvidence && (!method.trim() || cleanLinks.length === 0);

  const sub = id ? `evidence/${id} · 감사 로그 기록` : "식별자 미지정";

  return (
    <AdminShell active="evidence" title="원본 데이터 검수" sub={sub}>
      <div className="privacy">
        <IShield size={18} />
        <p>
          원본은 관리자만 열람하며 모든 접근이 기록됩니다. confirmed/disputed/debunked/corrected 판정은 검증 방법과
          근거 링크가 반드시 필요합니다.
        </p>
      </div>

      {!id ? (
        <div className="empty" style={{ background: "#fff" }}>
          <div className="ic">
            <IImage size={22} />
          </div>
          <h4>검수할 제보가 지정되지 않았습니다</h4>
          <p>검토 큐에서 항목을 선택하면 이 화면으로 이동합니다.</p>
        </div>
      ) : loadError ? (
        <div className="empty" style={{ background: "#fff" }}>
          <div className="ic">
            <IImage size={22} />
          </div>
          <h4>제보를 불러오지 못했습니다</h4>
          <p>{loadError}</p>
        </div>
      ) : loading || !record ? (
        <div className="empty" style={{ background: "#fff" }}>
          <h4>불러오는 중…</h4>
        </div>
      ) : (
        <div className="prow" style={{ gridTemplateColumns: "1.4fr .6fr", gap: 14 }}>
          {/* 좌: 원본 + 판정 폼 */}
          <div className="panel">
            <div className="ph">증거 원본</div>
            {record.attachments.length === 0 ? (
              <div className="empty" style={{ background: "#fff" }}>
                <div className="ic">
                  <IImage size={22} />
                </div>
                <h4>첨부 원본이 없습니다</h4>
                <p>이 제보에는 봉인된 원본 첨부가 없습니다.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {record.attachments.map((att, i) => (
                  <div key={att.r2_key || i}>
                    {imgUrls[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrls[i]}
                        alt={att.filename}
                        style={{ width: "100%", borderRadius: 12, border: "1px solid var(--g200)" }}
                      />
                    ) : (
                      <div className="empty" style={{ background: "#fff" }}>
                        <h4>불러오는 중…</h4>
                        <p>{att.filename}</p>
                      </div>
                    )}
                    <div className="kv" style={{ marginTop: 6 }}>
                      <b>{att.filename}</b> · {att.mime} · {Math.round(att.size / 1024)} KB
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 판정 폼 */}
            <div className="rsec" style={{ marginTop: 18 }}>판정</div>
            {evidenceMissing && (
              <div className="kv" style={{ color: "var(--red-strong)", fontWeight: 700 }}>
                이 판정은 검증 방법과 최소 1개의 근거 링크가 필요합니다.
              </div>
            )}
            <div className="seg" style={{ flexWrap: "wrap", marginBottom: 10 }}>
              {STATUSES.map((s) => (
                <b key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>
                  {STATUS_LABEL[s]}
                </b>
              ))}
            </div>

            <div className="kv">
              <b>검증 방법{needsEvidence ? " *" : ""}</b>
            </div>
            <input
              className="inp"
              type="text"
              placeholder="예: 원본 EXIF·GPS 대조, 선관위 공고 확인"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />

            <div className="kv">
              <b>근거 링크{needsEvidence ? " *" : ""}</b>
            </div>
            {links.map((link, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="inp"
                  type="url"
                  placeholder="https://…"
                  value={link}
                  onChange={(e) => {
                    const next = [...links];
                    next[i] = e.target.value;
                    setLinks(next);
                  }}
                  style={{ flex: 1 }}
                />
                {links.length > 1 && (
                  <div
                    className="act"
                    style={{ marginTop: 0, marginBottom: 11 }}
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  >
                    <div className="a3">✕</div>
                  </div>
                )}
              </div>
            ))}
            <div className="seg" style={{ marginBottom: 12 }}>
              <b onClick={() => setLinks([...links, ""])}>+ 링크 추가</b>
            </div>

            <div className="kv">
              <b>메모</b>
            </div>
            <textarea
              className="inp"
              placeholder="검토 메모(공개 안 됨)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ height: "auto", minHeight: 72, padding: "10px 14px", resize: "vertical", display: "block" }}
            />

            <div className="kv">
              <b>태그</b>
            </div>
            <input
              className="inp"
              type="text"
              placeholder="쉼표로 구분 (예: 사전투표, 분당)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />

            <div className="kv">
              <b>반박·반론</b>
            </div>
            {rebuttals.map((rb, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <input
                  className="inp"
                  type="text"
                  placeholder="반박 내용"
                  value={rb.text}
                  onChange={(e) => {
                    const next = [...rebuttals];
                    next[i] = { ...next[i], text: e.target.value };
                    setRebuttals(next);
                  }}
                  style={{ marginBottom: 6 }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="inp"
                    type="url"
                    placeholder="출처 URL (선택)"
                    value={rb.source_url ?? ""}
                    onChange={(e) => {
                      const next = [...rebuttals];
                      next[i] = { ...next[i], source_url: e.target.value };
                      setRebuttals(next);
                    }}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <div
                    className="act"
                    style={{ marginTop: 0 }}
                    onClick={() => setRebuttals(rebuttals.filter((_, j) => j !== i))}
                  >
                    <div className="a3">✕</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="seg" style={{ marginBottom: 12 }}>
              <b onClick={() => setRebuttals([...rebuttals, { text: "" }])}>+ 반박 추가</b>
            </div>

            {saveError && (
              <div className="kv" style={{ color: "var(--red-strong)", fontWeight: 700 }}>
                {saveError}
              </div>
            )}
            {saved && (
              <div className="kv" style={{ color: "var(--g700)", fontWeight: 700 }}>
                판정이 저장되었습니다.
              </div>
            )}
            <div className="act">
              <div
                className="a1"
                style={saving ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                onClick={submit}
              >
                {saving ? "저장 중…" : "판정 저장"}
              </div>
            </div>
          </div>

          {/* 우: 메타데이터 */}
          <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div className="ph">제보 · 메타데이터</div>
            <div className="kv">
              <b>식별자</b> {record.id}
            </div>
            <div className="kv">
              <b>현재 상태</b> {STATUS_LABEL[record.status as VerifyStatus] ?? record.status}
            </div>
            <div className="kv">
              <b>제보자(익명 ID)</b> {record.submitter}
            </div>
            <div className="kv">
              <b>선거</b> {record.election}
            </div>
            <div className="kv">
              <b>지역</b> {regionText(record) || "—"}
            </div>
            <div className="kv">
              <b>발생 시각</b> {record.occurred_at ?? "—"}
            </div>
            <div className="kv">
              <b>수집 시각</b> {record.collected_at}
            </div>
            <div className="kv">
              <b>라이선스</b> {record.license}
            </div>

            <div className="rsec" style={{ marginTop: 12 }}>EXIF · GPS</div>
            {exifText ? (
              <pre
                className="kv"
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                }}
              >
                {exifText}
              </pre>
            ) : (
              <div className="kv">메타데이터 없음</div>
            )}

            <div className="rsec" style={{ marginTop: 12 }}>접근 로그</div>
            <div className="kv">현재 세션 열람 기록이 감사 로그에 남습니다.</div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
