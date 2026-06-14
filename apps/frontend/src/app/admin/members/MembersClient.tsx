"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/web/AdminShell";
import { getAccessToken } from "@/lib/admin-auth";
import {
  listMembers,
  createMember,
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

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "root">("member");
  const [busy, setBusy] = useState(false);

  // 발급된 재설정 링크(생성·재발급 직후 1회 노출 — 관리자가 복사해 전달)
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

  async function onCreate() {
    if (busy || !username.trim() || !name.trim()) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await createMember({ username: username.trim().toLowerCase(), name: name.trim(), role });
      setMembers((prev) => [...prev, res.user]);
      setIssued({ username: res.user.username, link: resetLinkFor(res.reset_token) });
      setUsername("");
      setName("");
      setRole("member");
    } catch (e) {
      if (handleAuthError(e)) return;
      setError(e instanceof AdminApiError ? e.message : "회원 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

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
    <AdminShell active="members" title="회원 관리" sub={`총 ${members.length}명 · 검증자 계정`}>
      <div className="prow adm">
        <div className="panel">
          <div className="ph">회원 목록</div>
          {error && (
            <div style={{ padding: "10px 14px", color: "var(--red-strong)", fontSize: 13 }}>{error}</div>
          )}
          {loading ? (
            <div style={{ padding: 16, color: "var(--g500)", fontSize: 13 }}>불러오는 중…</div>
          ) : members.length === 0 ? (
            <div className="empty" style={{ background: "#fff" }}>
              <h4>회원이 없습니다</h4>
              <p>오른쪽에서 검증자 계정을 생성하면 여기에 표시됩니다.</p>
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

        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ph">회원 생성</div>
          <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="pl">아이디 (영소문자/숫자/._-, 3~32자)</label>
            <div className={`pi${username ? " fill" : ""}`}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="reviewer1"
                autoComplete="off"
              />
            </div>
            <label className="pl">이름</label>
            <div className={`pi${name ? " fill" : ""}`}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
            </div>
            <label className="pl">역할</label>
            <div className="pty">
              <b className={role === "member" ? "on" : ""} onClick={() => setRole("member")}>
                검증자
              </b>
              <b className={role === "root" ? "on" : ""} onClick={() => setRole("root")}>
                루트
              </b>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || !username.trim() || !name.trim()}
              onClick={onCreate}
              style={{ marginTop: 4 }}
            >
              {busy ? "생성 중…" : "회원 생성 + 재설정 링크 발급"}
            </button>

            {issued && (
              <div
                style={{
                  marginTop: 6,
                  padding: 12,
                  background: "var(--g50)",
                  border: "1px solid var(--g200)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 12.5, color: "var(--g700)", marginBottom: 6 }}>
                  <b>{issued.username}</b> 비밀번호 재설정 링크 (24시간 유효 · 1회용) — 본인에게 직접 전달하세요.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="inp" readOnly value={issued.link} style={{ flex: 1, fontSize: 12 }} />
                  <button className="btn btn-soft" onClick={copyLink}>
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--g500)", lineHeight: 1.6, marginTop: 4 }}>
              비밀번호는 회원이 링크에서 직접 설정합니다(서버는 평문을 저장하지 않습니다). 이메일 발송은 없으며 링크는
              관리자가 안전한 경로로 전달합니다.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
