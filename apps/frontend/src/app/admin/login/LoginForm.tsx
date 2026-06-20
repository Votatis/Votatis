"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Torch from "@/components/landing/Torch";
import { login, AdminApiError } from "@/lib/api/admin";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = username.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.push("/admin/dashboard");
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
          type="text"
          autoComplete="username"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <input
          className="inp"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          style={{ marginTop: 8 }}
        />
        {error && (
          <div className="l2fa" style={{ color: "var(--red-strong)", marginTop: 8, marginBottom: 8 }}>
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
      </div>
    </div>
  );
}
