"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/web/AdminShell";
import { getAccessToken } from "@/lib/admin-auth";
import { createMember, AdminApiError } from "@/lib/api/admin";

function resetLinkFor(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/admin/reset?token=${encodeURIComponent(token)}`;
}

const linkBox: CSSProperties = {
  marginTop: 6,
  padding: 12,
  background: "var(--g50)",
  border: "1px solid var(--g200)",
  borderRadius: 12,
};

export default function NewMemberClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "root">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ username: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) router.push("/admin/login");
  }, [router]);

  async function onCreate() {
    if (busy || !username.trim() || !name.trim()) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await createMember({ username: username.trim().toLowerCase(), name: name.trim(), role });
      setIssued({ username: res.user.username, link: resetLinkFor(res.reset_token) });
      setUsername("");
      setName("");
      setRole("member");
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        router.push("/admin/login");
        return;
      }
      setError(e instanceof AdminApiError ? e.message : "회원 생성에 실패했습니다.");
    } finally {
      setBusy(false);
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
      title="회원 생성"
      sub="검증자 계정 생성 + 비밀번호 재설정 링크 발급"
      right={
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => router.push("/admin/members")}
        >
          ← 회원 목록
        </button>
      }
    >
      <div className="prow adm">
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ph">새 검증자 계정</div>
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
            {error && <div style={{ color: "var(--red-strong)", fontSize: 13 }}>{error}</div>}
            <button
              className="btn btn-primary"
              disabled={busy || !username.trim() || !name.trim()}
              onClick={onCreate}
              style={{ marginTop: 4 }}
            >
              {busy ? "생성 중…" : "회원 생성 + 재설정 링크 발급"}
            </button>
          </div>
        </div>

        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="ph">발급된 재설정 링크</div>
          <div style={{ padding: "0 14px 14px" }}>
            {issued ? (
              <div style={linkBox}>
                <div style={{ fontSize: 12.5, color: "var(--g700)", marginBottom: 6 }}>
                  <b>{issued.username}</b> 비밀번호 재설정 링크 (24시간 유효 · 1회용) — 본인에게 직접 전달하세요.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="inp" readOnly value={issued.link} style={{ flex: 1, fontSize: 12 }} />
                  <button className="btn btn-soft" onClick={copyLink}>
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button className="btn btn-soft" onClick={() => setIssued(null)}>
                    계속 생성
                  </button>
                  <button className="btn btn-primary" onClick={() => router.push("/admin/members")}>
                    회원 목록으로
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--g500)", lineHeight: 1.6 }}>
                회원을 생성하면 비밀번호 재설정 링크가 여기에 표시됩니다. 비밀번호는 회원이 링크에서 직접
                설정하며(서버는 평문을 저장하지 않음), 이메일 발송은 없으니 관리자가 안전한 경로로 링크를 전달합니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
