// 관리자(검수) API 클라이언트 — Bearer ADMIN_TOKEN(spec 0008). 검증 큐/상세/판정/증거 스트리밍.
// 증거 스트리밍은 OpenAPI 스펙 밖(바이너리)이라 직접 fetch → blob → objectURL.

import { API_BASE_URL } from "./client";
import type { components } from "./schema";
import { getAdminToken, clearAdminToken } from "../admin-auth";

export type AdminReportList = components["schemas"]["AdminReportList"];
export type AdminReportSummary = components["schemas"]["AdminReportSummary"];
export type AdminReportDetail = components["schemas"]["AdminReportDetail"];
export type AdminPatch = components["schemas"]["AdminPatch"];
export type Stats = components["schemas"]["Stats"];

export class AdminApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
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

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new AdminApiError(401, "관리자 인증이 만료되었습니다. 다시 로그인하세요.");
  }
  return res;
}

/** 로그인 — 토큰 유효성 검증(POST /admin/session). 성공 시 호출부에서 setAdminToken. */
export async function verifyAdminToken(token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.ok;
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

/** 공개 통계(GET /stats) — 인증 불필요. (런타임 집계; 정적 통계는 archive.ts 사용) */
export async function getPublicStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE_URL}/stats`);
  if (!res.ok) throw new AdminApiError(res.status, "통계를 불러오지 못했습니다.");
  return (await res.json()) as Stats;
}
