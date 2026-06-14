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
  analyzeAdminReport,
  AdminApiError,
  type AdminReportDetail,
  type AdminPatch,
  type Analysis,
} from "@/lib/api/admin";
import { getAccessToken } from "@/lib/admin-auth";

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

// 검토 피드백 위험도(Votatis#2). 판정 시 필수.
const RISK_OPTIONS = ["낮음", "낮음~중간", "중간", "중간~높음", "높음"] as const;
type Risk = (typeof RISK_OPTIONS)[number] | "";

// 줄바꿈 구분 textarea → 문자열 배열.
const toLines = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);

// 합성/조작 위험 레벨 → 한국어. 보조 신호일 뿐 판정 근거 아님(페르소나 5).
const SYNTHETIC_RISK_LABEL: Record<Analysis["synthetic_risk"]["level"], string> = {
  low: "낮음",
  review: "원본 대조 권장",
  unknown: "평가 대상 아님",
};

const ANALYSIS_SOURCE_LABEL: Record<Analysis["source"], string> = {
  heuristic: "휴리스틱",
  "heuristic+ai": "휴리스틱+AI",
};

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
  // 검토 피드백 스키마(Votatis#2) 입력 상태.
  const [publicSummary, setPublicSummary] = useState("");
  const [riskLevel, setRiskLevel] = useState<Risk>("");
  const [notConfirmed, setNotConfirmed] = useState(""); // 줄바꿈 구분
  const [statusScope, setStatusScope] = useState("");
  const [confirmedScope, setConfirmedScope] = useState(""); // 줄바꿈 구분
  const [claim, setClaim] = useState("");
  const [verifiedFacts, setVerifiedFacts] = useState(""); // 줄바꿈 구분
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // AI 보조 분석 상태(버튼 클릭 시에만 실행 — 자동 실행 안 함).
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const hydrate = useCallback((r: AdminReportDetail) => {
    setRecord(r);
    setStatus((r.status as VerifyStatus) ?? "reviewing");
    setMethod(r.verification?.method ?? "");
    setNotes(r.verification?.notes ?? "");
    const ev = r.verification?.evidence_links ?? [];
    setLinks(ev.length ? ev : [""]);
    setTags((r.tags ?? []).join(", "));
    setRebuttals((r.rebuttals ?? []).map((rb) => ({ text: rb.text, source_url: rb.source_url })));
    setPublicSummary(r.verification?.public_summary ?? "");
    setRiskLevel((r.verification?.risk_level as Risk) ?? "");
    setNotConfirmed((r.verification?.not_confirmed ?? []).join("\n"));
    setStatusScope(r.verification?.status_scope ?? "");
    setConfirmedScope((r.verification?.confirmed_scope ?? []).join("\n"));
    setClaim(r.verification?.claim ?? "");
    setVerifiedFacts((r.verification?.verified_facts ?? []).join("\n"));
    setAnalysis(null);
    setAnalyzeError(null);
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
          router.push("/admin/login");
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
    if (!getAccessToken()) {
      router.push("/admin/login");
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
        public_summary: publicSummary.trim() || undefined,
        risk_level: riskLevel || undefined,
        not_confirmed: toLines(notConfirmed),
        status_scope: statusScope.trim() || undefined,
        confirmed_scope: toLines(confirmedScope),
        claim: claim.trim() || undefined,
        verified_facts: toLines(verifiedFacts),
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
        router.push("/admin/login");
        return;
      }
      setSaveError(e instanceof AdminApiError ? e.message : "판정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function runAnalysis() {
    if (!id || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeAdminReport(id);
      setAnalysis(result);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        router.push("/admin/login");
        return;
      }
      setAnalyzeError(e instanceof AdminApiError ? e.message : "분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  // 제안 태그를 판정 폼의 태그 상태(쉼표 구분 문자열)에 추가. 이미 있으면 무시.
  function addSuggestedTag(tag: string) {
    const current = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (current.includes(tag)) return;
    setTags([...current, tag].join(", "));
  }

  // 근거·피드백 미충족 시 클라이언트 경고(서버도 400 으로 막음).
  const feedbackMissing =
    needsEvidence &&
    (!method.trim() ||
      cleanLinks.length === 0 ||
      !publicSummary.trim() ||
      !riskLevel ||
      toLines(notConfirmed).length === 0 ||
      (status === "confirmed" && (!statusScope.trim() || toLines(confirmedScope).length === 0)));

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
            {feedbackMissing && (
              <div className="kv" style={{ color: "var(--red-strong)", fontWeight: 700 }}>
                이 판정에는 검증 방법·근거 링크와 공개 요약·위험도·미확인 항목이 필요합니다
                {status === "confirmed" ? " (확인됨은 확인 범위·확인된 항목도 필수)" : ""}.
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

            {/* 검토 피드백 스키마(Votatis#2) — 판정 시 공개요약·위험도·미확인 필수, 확인됨은 확인범위 필수 */}
            <div className="rsec" style={{ marginTop: 6 }}>검토 피드백</div>
            <div className="kv">
              <b>공개 요약(public_summary){needsEvidence ? " *" : ""}</b>
            </div>
            <textarea
              className="inp"
              placeholder="외부 공개용 중립 요약. 감정·단정 표현을 피하고 확인 범위를 명확히."
              value={publicSummary}
              onChange={(e) => setPublicSummary(e.target.value)}
              rows={3}
              style={{ height: "auto", minHeight: 72, padding: "10px 14px", resize: "vertical", display: "block" }}
            />

            <div className="kv">
              <b>위험도(risk_level){needsEvidence ? " *" : ""}</b>
            </div>
            <div className="seg" style={{ flexWrap: "wrap", marginBottom: 12 }}>
              {RISK_OPTIONS.map((r) => (
                <b key={r} className={riskLevel === r ? "on" : ""} onClick={() => setRiskLevel(r)}>
                  {r}
                </b>
              ))}
            </div>

            <div className="kv">
              <b>미확인·과잉해석 차단(not_confirmed){needsEvidence ? " *" : ""}</b>
            </div>
            <textarea
              className="inp"
              placeholder={"확인되지 않은 주장을 한 줄에 하나씩.\n예) 부정선거 조작이 있었다는 주장\n예) 선거 결과에 영향을 주었다는 주장"}
              value={notConfirmed}
              onChange={(e) => setNotConfirmed(e.target.value)}
              rows={3}
              style={{ height: "auto", minHeight: 72, padding: "10px 14px", resize: "vertical", display: "block" }}
            />

            <div className="kv">
              <b>확인 범위(status_scope){status === "confirmed" ? " *" : ""}</b>
            </div>
            <input
              className="inp"
              type="text"
              placeholder="예: 봉인지 2겹 부착에 따른 봉인 관리 미흡 (부정선거 단정 금지)"
              value={statusScope}
              onChange={(e) => setStatusScope(e.target.value)}
            />

            <div className="kv">
              <b>확인된 항목(confirmed_scope){status === "confirmed" ? " *" : ""}</b>
            </div>
            <textarea
              className="inp"
              placeholder={"확인된 범위를 한 줄에 하나씩.\n예) 봉인지 2겹 부착 정황\n예) 봉인 관리 미흡"}
              value={confirmedScope}
              onChange={(e) => setConfirmedScope(e.target.value)}
              rows={2}
              style={{ height: "auto", minHeight: 56, padding: "10px 14px", resize: "vertical", display: "block" }}
            />

            <div className="kv">
              <b>제보자 주장(claim)</b>
            </div>
            <textarea
              className="inp"
              placeholder="제보자의 주장을 중립적으로 요약(검토자 판단은 넣지 않음)."
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              rows={2}
              style={{ height: "auto", minHeight: 56, padding: "10px 14px", resize: "vertical", display: "block" }}
            />

            <div className="kv">
              <b>확인된 사실(verified_facts)</b>
            </div>
            <textarea
              className="inp"
              placeholder={"사진·영상·문서에서 직접 확인되는 사실만 한 줄에 하나씩(해석 제외)."}
              value={verifiedFacts}
              onChange={(e) => setVerifiedFacts(e.target.value)}
              rows={2}
              style={{ height: "auto", minHeight: 56, padding: "10px 14px", resize: "vertical", display: "block" }}
            />

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

            {/* AI 보조 분석 — 보조 신호일 뿐, 최종 판단은 검수자(페르소나 5). */}
            <div className="rsec" style={{ marginTop: 16 }}>AI 분석 (보조 신호)</div>
            <div className="kv" style={{ color: "var(--g500)" }}>
              이 분석은 <b>비공식 보조 신호</b>이며 판정 근거가 아닙니다. 최종 판단은 검수자가 직접 내립니다.
            </div>

            <div className="act">
              <div
                className="a1"
                style={analyzing ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                onClick={runAnalysis}
              >
                {analyzing ? "분석 중…" : "분석 실행"}
              </div>
            </div>

            {analyzeError && (
              <div className="kv" style={{ color: "var(--red-strong)", fontWeight: 700 }}>
                {analyzeError}
              </div>
            )}

            {analysis && (
              <>
                <div className="kv" style={{ marginTop: 6 }}>
                  <b>출처</b> {ANALYSIS_SOURCE_LABEL[analysis.source]}
                </div>

                <div className="kv" style={{ marginTop: 8 }}>
                  <b>신뢰도 점수</b> {Math.round(analysis.credibility.score * 100)}%
                </div>
                {analysis.credibility.signals.length > 0 && (
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {analysis.credibility.signals.map((s, i) => (
                      <li key={i} className="kv" style={{ margin: 0 }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="kv" style={{ marginTop: 8 }}>
                  <b>합성·조작 위험</b> {SYNTHETIC_RISK_LABEL[analysis.synthetic_risk.level]}
                </div>
                {analysis.synthetic_risk.signals.length > 0 && (
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {analysis.synthetic_risk.signals.map((s, i) => (
                      <li key={i} className="kv" style={{ margin: 0 }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}

                {analysis.suggested_tags.length > 0 && (
                  <>
                    <div className="kv" style={{ marginTop: 8 }}>
                      <b>제안 태그</b>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {analysis.suggested_tags.map((tag) => (
                        <span key={tag} className="chip sm c-unv">
                          {tag}
                          <b
                            onClick={() => addSuggestedTag(tag)}
                            style={{ cursor: "pointer", marginLeft: 2 }}
                          >
                            + 추가
                          </b>
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {analysis.summary_hint && (
                  <>
                    <div className="kv" style={{ marginTop: 8 }}>
                      <b>요약 힌트</b>
                    </div>
                    <div className="kv">{analysis.summary_hint}</div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
