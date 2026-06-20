"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Torch from "@/components/landing/Torch";
import { setPasswordWithToken, AdminApiError } from "@/lib/api/admin";

const MIN_LEN = 10;

export default function ResetClient() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LEN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= MIN_LEN && confirm === password && token.length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setPasswordWithToken(token, password);
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 1500);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "비밀번호 설정에 실패했습니다.");
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
        <div className="sub">비밀번호 설정</div>

        {!token ? (
          <div className="l2fa" style={{ color: "var(--red-strong)" }}>
            유효하지 않은 링크입니다. 관리자에게 재설정 링크를 다시 요청하세요.
          </div>
        ) : done ? (
          <div className="l2fa" style={{ color: "var(--g700)" }}>
            비밀번호가 설정되었습니다. 로그인 화면으로 이동합니다…
          </div>
        ) : (
          <>
            <input
              className="inp"
              type="password"
              autoComplete="new-password"
              placeholder={`새 비밀번호 (${MIN_LEN}자 이상)`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className="inp"
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 확인"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              style={{ marginTop: 8 }}
            />
            {(tooShort || mismatch || error) && (
              <div className="l2fa" style={{ color: "var(--red-strong)", marginTop: 8, marginBottom: 8 }}>
                {error ?? (tooShort ? `비밀번호는 ${MIN_LEN}자 이상이어야 합니다.` : "비밀번호가 일치하지 않습니다.")}
              </div>
            )}
            <button
              className="lbtn"
              disabled={!valid || busy}
              style={!valid || busy ? { background: "var(--g300)", cursor: "not-allowed" } : undefined}
              onClick={submit}
            >
              {busy ? "설정 중…" : "비밀번호 설정"}
            </button>
            <div className="l2fa">이 링크는 1회용이며 24시간 동안만 유효합니다.</div>
          </>
        )}
      </div>
    </div>
  );
}
