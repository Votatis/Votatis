// 공개 아카이브 레코드 상세 렌더링 (spec 0016) — 정적 [id] 라우트와 런타임 record?id 라우트가 공유.
// 검증 이력 + 검토 피드백(공개 필드: 공개요약·확인범위·확인사실·미확인·위험도)을 표시한다.

import { IShield } from "@/components/mock/mock-icons";
import { STATUS_LABEL, type VerifyStatus } from "@/lib/types";
import type { ArchiveRecord } from "@/lib/archive-source";

const STATUS_CHIP_CLASS: Record<string, string> = {
  unverified: "unv",
  reviewing: "rev",
  confirmed: "cnf",
  disputed: "dis",
  debunked: "deb",
  corrected: "cor",
};

function regionText(r: ArchiveRecord): string {
  return [r.region?.sido, r.region?.sigungu, r.region?.eup_myeon_dong].filter(Boolean).join(" ");
}

export function ArchiveNotFound({ id }: { id: string }) {
  return (
    <div className="rdoc">
      <div className="rdh">
        <span className="chip c-unv">
          <span className="pt" />레코드 없음
        </span>
        <span className="rid">{id}</span>
      </div>
      <div className="empty" style={{ marginTop: 8 }}>
        <div className="ic">
          <IShield size={22} />
        </div>
        <h4>해당 레코드를 찾을 수 없습니다</h4>
        <p>
          요청하신 식별자의 공개 레코드가 존재하지 않거나 아직 검증되지 않았습니다.
          <br />
          검증을 통과한 기록만 공개되며, 모든 기록에는 출처·무결성 해시·검증 이력이 함께 표시됩니다.
        </p>
      </div>
    </div>
  );
}

/** 검토 피드백 문자열 배열을 불릿 목록으로. 비어있으면 렌더 안 함. */
function FeedbackList({ label, items }: { label: string; items: string[] | null | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="kv" style={{ marginTop: 6 }}>
      <b>{label}</b>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {items.map((t, i) => (
          <li key={i} style={{ marginBottom: 2 }}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArchiveDetail({ r }: { r: ArchiveRecord }) {
  const chip = STATUS_CHIP_CLASS[r.status] ?? "unv";
  const region = regionText(r);
  const v = r.verification;
  const evidence = v?.evidence_links ?? [];

  return (
    <div className="rdoc">
      <div className="rdh">
        <span className={`chip c-${chip}`}>
          <span className="pt" />
          {STATUS_LABEL[r.status as VerifyStatus] ?? r.status}
        </span>
        <span className="rid">{r.id}</span>
      </div>

      <h3>{r.title}</h3>
      {r.summary && <div className="sum">{r.summary}</div>}

      <div className="meta">
        {region && <span>{region}</span>}
        {r.occurred_at && <span>발생 {r.occurred_at.slice(0, 10)}</span>}
        <span>수집 {r.collected_at.slice(0, 10)}</span>
        {(r.tags ?? []).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      {/* 검토 결과 요약(공개) — 확인 범위/위험도/공개요약. 부정선거 단정 금지(범위 제한). */}
      {(v?.public_summary || v?.status_scope || v?.risk_level) && (
        <div style={{ margin: "14px 0" }}>
          <div className="rsec">검토 결과</div>
          {v?.status_scope && (
            <div className="kv">
              <b>확인 범위</b> {v.status_scope}
            </div>
          )}
          {v?.risk_level && (
            <div className="kv">
              <b>위험도</b> {v.risk_level}
            </div>
          )}
          {v?.public_summary && (
            <div className="sum" style={{ whiteSpace: "pre-wrap", marginTop: 6, marginBottom: 0 }}>
              {v.public_summary}
            </div>
          )}
        </div>
      )}

      {r.body && (
        <div style={{ marginBottom: 20 }}>
          <div className="rsec">본문</div>
          <div className="sum" style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
            {r.body}
          </div>
        </div>
      )}

      <div className="rdgrid">
        <div>
          <div className="rsec">출처</div>
          {(r.sources?.length ?? 0) === 0 ? (
            <div className="kv">등록된 출처가 없습니다.</div>
          ) : (
            r.sources.map((s, i) => (
              <div className="rsrc" key={i}>
                {s.text ?? s.url ?? "출처"}
                {s.type && <span style={{ color: "var(--g400)", fontWeight: 600 }}> · {s.type}</span>}
                <div className="kv" style={{ marginTop: 2 }}>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--red)", fontWeight: 700 }}>
                      원본 링크
                    </a>
                  )}
                  {s.archive_url && (
                    <>
                      {s.url && " · "}
                      <a href={s.archive_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--red)", fontWeight: 700 }}>
                        보존 사본
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="rsec">첨부 · 무결성</div>
          {(r.attachments?.length ?? 0) === 0 ? (
            <div className="kv">첨부 파일이 없습니다.</div>
          ) : (
            r.attachments.map((a, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div className="rsrc" style={{ marginBottom: 2 }}>
                  {a.filename}
                </div>
                <div className="kv">
                  {a.mime} · {Math.round(a.size / 1024)} KB
                </div>
                <div className="hash" style={{ marginTop: 6 }}>
                  sha256: {a.sha256}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="rsec">검증 이력</div>
          <div className="kv">
            <b>검토자</b> {v?.reviewer ?? "—"}
          </div>
          <div className="kv">
            <b>방법</b> {v?.method ?? "—"}
          </div>
          <div className="kv">
            <b>검토 시점</b> {v?.reviewed_at ? v.reviewed_at.slice(0, 10) : "—"}
          </div>
          {v?.notes && (
            <div className="kv">
              <b>메모</b> {v.notes}
            </div>
          )}
          {evidence.length > 0 && (
            <div className="kv">
              <b>근거</b>{" "}
              {evidence.map((e, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <a href={e} target="_blank" rel="noopener noreferrer" style={{ color: "var(--red)", fontWeight: 700 }}>
                    링크 {i + 1}
                  </a>
                </span>
              ))}
            </div>
          )}
          <FeedbackList label="확인된 항목" items={v?.confirmed_scope} />
          <FeedbackList label="확인된 사실" items={v?.verified_facts} />
          <FeedbackList label="확인되지 않은 주장(과잉해석 차단)" items={v?.not_confirmed} />
          <FeedbackList label="가능한 설명" items={v?.possible_explanations} />
        </div>

        <div>
          <div className="rsec">반박 · 라이선스</div>
          {(r.rebuttals?.length ?? 0) === 0 ? (
            <div className="kv">등록된 반박이 없습니다.</div>
          ) : (
            r.rebuttals!.map((rb, i) => (
              <div className="kv" key={i}>
                {rb.text}
                {rb.source_url && (
                  <>
                    {" "}
                    <a href={rb.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--red)", fontWeight: 700 }}>
                      출처
                    </a>
                  </>
                )}
              </div>
            ))
          )}
          <div className="kv" style={{ marginTop: 8 }}>
            <b>라이선스</b> {r.license}
          </div>
        </div>
      </div>
    </div>
  );
}
