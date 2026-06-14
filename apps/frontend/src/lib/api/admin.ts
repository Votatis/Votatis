// 관리자 API 클라이언트 (spec 0015) — JWT access Bearer + 401 시 refresh 1회 자동 갱신.
// 검증 큐/상세/판정/증거 스트리밍 + 인증(로그인·세션) + 회원관리.
// 증거 스트리밍은 OpenAPI 스펙 밖(바이너리)이라 직접 fetch → blob → objectURL.

import { API_BASE_URL } from "./client";
import type { components } from "./schema";
import {
  getAccessToken,
  getRefreshToken,
  setSession,
  updateTokens,
  clearSession,
  type AdminUser,
  type AdminSession,
} from "../admin-auth";

export type AdminReportList = components["schemas"]["AdminReportList"];
export type AdminReportSummary = components["schemas"]["AdminReportSummary"];
export type AdminReportDetail = components["schemas"]["AdminReportDetail"];
export type AdminPatch = components["schemas"]["AdminPatch"];
export type Stats = components["schemas"]["Stats"];
export type Analysis = components["schemas"]["Analysis"];
export type AdminMemberList = components["schemas"]["AdminMemberList"];
export type AdminMemberCreateInput = components["schemas"]["AdminMemberCreateInput"];
export type AdminMemberCreateResult = components["schemas"]["AdminMemberCreateResult"];
export type AdminMemberPatchInput = components["schemas"]["AdminMemberPatchInput"];
export type { AdminUser };

export class AdminApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function rawFetch(path: string, init: RequestInit | undefined, token: string | null): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

/** refresh 토큰으로 access 재발급(회전). 성공 시 세션 갱신, 실패 시 false. */
async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  const res = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as AdminSession;
  updateTokens(data.access_token, data.refresh_token);
  return true;
}

/** 인증 요청 — 401 이면 refresh 1회 후 재시도. 그래도 401 이면 세션 클리어 + throw. */
async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  let res = await rawFetch(path, init, getAccessToken());
  if (res.status === 401) {
    if (await tryRefresh()) {
      res = await rawFetch(path, init, getAccessToken());
    }
    if (res.status === 401) {
      clearSession();
      throw new AdminApiError(401, "관리자 인증이 만료되었습니다. 다시 로그인하세요.");
    }
  }
  return res;
}

// ── 인증 ──────────────────────────────────────────────────────────────────────

/** 로그인(username/password) → 세션 저장 후 사용자 반환. */
export async function login(username: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "로그인에 실패했습니다."));
  const data = (await res.json()) as AdminSession;
  setSession(data);
  return data.user;
}

/** 로그아웃 — refresh 폐기 시도 후 로컬 세션 클리어. */
export async function logout(): Promise<void> {
  const rt = getRefreshToken();
  if (rt) {
    try {
      await fetch(`${API_BASE_URL}/admin/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
    } catch {
      /* 네트워크 실패해도 로컬은 비운다 */
    }
  }
  clearSession();
}

/** 재설정 링크 토큰으로 비밀번호 설정(공개 — 인증 불필요). */
export async function setPasswordWithToken(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/admin/auth/password-reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "비밀번호 설정에 실패했습니다."));
}

// ── 회원관리 (root 전용) ──────────────────────────────────────────────────────

export async function listMembers(): Promise<AdminMemberList> {
  const res = await adminFetch("/admin/members");
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "회원 목록을 불러오지 못했습니다."));
  return (await res.json()) as AdminMemberList;
}

export async function createMember(input: AdminMemberCreateInput): Promise<AdminMemberCreateResult> {
  const res = await adminFetch("/admin/members", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "회원 생성에 실패했습니다."));
  return (await res.json()) as AdminMemberCreateResult;
}

export async function issueResetLink(id: string): Promise<string> {
  const res = await adminFetch(`/admin/members/${encodeURIComponent(id)}/reset-link`, { method: "POST" });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "재설정 링크 발급에 실패했습니다."));
  return ((await res.json()) as { reset_token: string }).reset_token;
}

export async function updateMember(id: string, patch: AdminMemberPatchInput): Promise<AdminUser> {
  const res = await adminFetch(`/admin/members/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "회원 수정에 실패했습니다."));
  return (await res.json()) as AdminUser;
}

export async function deleteMember(id: string): Promise<void> {
  const res = await adminFetch(`/admin/members/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "회원 삭제에 실패했습니다."));
}

export interface AdminListParams {
  status?: string;
  election?: string;
  sido?: string;
  sigungu?: string;
  tag?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listAdminReports(params: AdminListParams = {}): Promise<AdminReportList> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const res = await adminFetch(`/admin/reports?${qs.toString()}`);
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "큐를 불러오지 못했습니다."));
  return (await res.json()) as AdminReportList;
}

export async function getAdminReport(id: string): Promise<AdminReportDetail> {
  const res = await adminFetch(`/admin/reports/${encodeURIComponent(id)}`);
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "제보를 불러오지 못했습니다."));
  return (await res.json()) as AdminReportDetail;
}

export async function patchAdminReport(id: string, patch: AdminPatch): Promise<AdminReportDetail> {
  const res = await adminFetch(`/admin/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "판정 저장에 실패했습니다."));
  return (await res.json()) as AdminReportDetail;
}

/** 증거 첨부 바이트를 인증 하에 받아 objectURL 로 변환(<img src> 용). 해제는 호출부 책임. */
export async function fetchAttachmentObjectUrl(id: string, idx: number): Promise<string> {
  const res = await adminFetch(`/admin/reports/${encodeURIComponent(id)}/attachments/${idx}`);
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "첨부를 불러오지 못했습니다."));
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** 검증 보조 분석(POST /admin/reports/{id}/analyze) — 휴리스틱±AI. 보조 신호일 뿐 판정 근거 아님. */
export async function analyzeAdminReport(id: string): Promise<Analysis> {
  const res = await adminFetch(`/admin/reports/${encodeURIComponent(id)}/analyze`, { method: "POST" });
  if (!res.ok) throw new AdminApiError(res.status, await parseError(res, "분석에 실패했습니다."));
  return (await res.json()) as Analysis;
}

/** 공개 통계(GET /stats) — 인증 불필요. (런타임 집계; 정적 통계는 archive.ts 사용) */
export async function getPublicStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE_URL}/stats`);
  if (!res.ok) throw new AdminApiError(res.status, "통계를 불러오지 못했습니다.");
  return (await res.json()) as Stats;
}
