"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Torch from "@/components/landing/Torch";
import { verifyAdminToken, AdminApiError } from "@/lib/api/admin";
import { setAdminToken } from "@/lib/admin-auth";

export default function LoginForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = token.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyAdminToken(token.trim());
      if (ok) {
        setAdminToken(token.trim());
        router.push("/admin/dashboard");
      } else {
        setError("토큰이 올바르지 않습니다. 다시 확인하세요.");
      }
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "로그인에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login" style={{ background: "transparent", minHeight: "60vh" }}>
      <div className="login-card">
        <div className="lg">
          <Torch size={30} />Votatis
        </div>
        <div className="sub">관리자 콘솔 · 검토자 전용</div>
        <input
          className="inp"
          type="password"
          placeholder="관리자 액세스 토큰"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {error && (
          <div className="l2fa" style={{ color: "var(--red-strong)", marginTop: 0, marginBottom: 8 }}>
            {error}
          </div>
        )}
        <button
          className="lbtn"
          disabled={!valid || busy}
          style={!valid || busy ? { background: "var(--g300)", cursor: "not-allowed" } : undefined}
          onClick={submit}
        >
          {busy ? "확인 중…" : "로그인"}
        </button>
        <div className="l2fa">
          MVP 단계에서는 운영팀이 공유하는 액세스 토큰으로 인증합니다.
          <br />
          토큰은 이 브라우저에만 저장되며 요청 시 인증 헤더로 전송됩니다.
        </div>
      </div>
    </div>
  );
}
