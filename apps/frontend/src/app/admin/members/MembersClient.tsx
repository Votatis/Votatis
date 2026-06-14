"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/web/AdminShell";
import { getAccessToken } from "@/lib/admin-auth";
import {
  listMembers,
  issueResetLink,
  updateMember,
  deleteMember,
  AdminApiError,
  type AdminUser,
} from "@/lib/api/admin";

function resetLinkFor(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/admin/reset?token=${encodeURIComponent(token)}`;
}

const actBtn: CSSProperties = {
  fontSize: 12,
  color: "var(--g600)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "2px 6px",
};

export default function MembersClient() {
  const router = useRouter();
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 회원별 재설정 링크 재발급 결과(노출 후 관리자가 복사·전달)
  const [issued, setIssued] = useState<{ username: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAuthError = useCallback(
    (e: unknown): boolean => {
      if (e instanceof AdminApiError && e.status === 401) {
        router.push("/admin/login");
        return true;
      }
      return false;
    },
    [router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMembers();
      setMembers(data.members);
    } catch (e) {
      if (handleAuthError(e)) return;
      setError(e instanceof AdminApiError ? e.message : "회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/admin/login");
      return;
    }
    void load();
  }, [load, router]);

  async function onReissue(m: AdminUser) {
    setError(null);
    setCopied(false);
    try {
      const token = await issueResetLink(m.id);
      setIssued({ username: m.username, link: resetLinkFor(token) });
    } catch (e) {
      if (handleAuthError(e)) return;
      setError(e instanceof AdminApiError ? e.message : "재설정 링크 발급에 실패했습니다.");
    }
  }

  async function onToggleStatus(m: AdminUser) {
    setError(null);
    try {
      const next = m.status === "active" ? "disabled" : "active";
      const updated = await updateMember(m.id, { status: next });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      if (handleAuthError(e)) return;
      setError(e instanceof AdminApiError ? e.message : "상태 변경에 실패했습니다.");
    }
  }

  async function onDelete(m: AdminUser) {
    if (!window.confirm(`회원 '${m.username}' 을(를) 삭제할까요?`)) return;
    setError(null);
    try {
      await deleteMember(m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e) {
      if (handleAuthError(e)) return;
      setError(e instanceof AdminApiError ? e.message : "삭제에 실패했습니다.");
    }
  }

  async function copyLink() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AdminShell
      active="members"
      title="회원 관리"
      sub={`총 ${members.length}명 · 검증자 계정`}
      right={
        <button type="button" className="btn btn-primary" onClick={() => router.push("/admin/members/new")}>
          + 회원 생성
        </button>
      }
    >
      <div className="prow adm">
        <div className="panel">
          <div className="ph">회원 목록</div>
          {error && <div style={{ padding: "10px 14px", color: "var(--red-strong)", fontSize: 13 }}>{error}</div>}

          {issued && (
            <div
              style={{
                margin: "10px 14px 0",
                padding: 12,
                background: "var(--g50)",
                border: "1px solid var(--g200)",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 12.5, color: "var(--g700)", marginBottom: 6 }}>
                <b>{issued.username}</b> 비밀번호 재설정 링크 (24시간 유효 · 1회용) — 본인에게 직접 전달하세요.
                <button type="button" style={{ ...actBtn, float: "right" }} onClick={() => setIssued(null)}>
                  닫기
                </button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="inp" readOnly value={issued.link} style={{ flex: 1, fontSize: 12 }} />
                <button className="btn btn-soft" onClick={copyLink}>
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 16, color: "var(--g500)", fontSize: 13 }}>불러오는 중…</div>
          ) : members.length === 0 ? (
            <div className="empty" style={{ background: "#fff" }}>
              <h4>회원이 없습니다</h4>
              <p>
                오른쪽 위 <b>＋ 회원 생성</b> 버튼으로 검증자 계정을 만드세요.
              </p>
            </div>
          ) : (
            <div className="tblw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th>이름</th>
                    <th>역할</th>
                    <th>상태</th>
                    <th style={{ textAlign: "right" }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.username}</td>
                      <td>{m.name}</td>
                      <td>{m.role === "root" ? "루트" : "검증자"}</td>
                      <td>
                        <span style={{ color: m.status === "active" ? "var(--g700)" : "var(--red-strong)" }}>
                          {m.status === "active" ? "활성" : "비활성"}
                          {!m.last_login_at && m.status === "active" ? " · 비번 미설정" : ""}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button type="button" style={actBtn} onClick={() => onReissue(m)}>
                          재설정 링크
                        </button>
                        {m.role !== "root" && (
                          <>
                            <button type="button" style={actBtn} onClick={() => onToggleStatus(m)}>
                              {m.status === "active" ? "비활성화" : "활성화"}
                            </button>
                            <button
                              type="button"
                              style={{ ...actBtn, color: "var(--red-strong)" }}
                              onClick={() => onDelete(m)}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
