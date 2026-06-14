// intake-api 관리자 API HTTP 클라이언트. 검증 로직은 API가 단일 출처 — 여기선 호출만 한다.
// fetchFn 을 주입 가능하게 해 테스트에서 URL·헤더·바디를 검증한다.

export type FetchFn = typeof fetch;

export interface QueueParams {
  status?: string;
  q?: string;
  election?: string;
  sido?: string;
  sigungu?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface VerdictBody {
  status?: string;
  reviewer?: string;
  verification?: {
    method?: string;
    notes?: string;
    evidence_links?: string[];
    public_summary?: string;
    risk_level?: string;
    status_scope?: string;
    claim?: string;
    verified_facts?: string[];
    assessment?: string[];
    confirmed_scope?: string[];
    not_confirmed?: string[];
    possible_explanations?: string[];
    missing_evidence?: string[];
    reviewer_note?: string;
  };
  tags?: string[];
  rebuttals?: { text: string; source_url?: string }[];
}

export class AdminClient {
  constructor(
    private readonly apiUrl: string,
    private readonly token: string | undefined,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private requireToken(): string {
    if (!this.token) {
      throw new Error(
        "VOTATIS_ADMIN_TOKEN 이 설정되지 않았습니다. MCP 설정의 env 에 관리자 토큰을 넣어주세요(mcp-usage.md 참고).",
      );
    }
    return this.token;
  }

  /** 인증 헤더 포함 요청. 비-2xx 는 API 의 { error } 메시지를 추출해 throw. */
  private async req(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (auth) headers["authorization"] = `Bearer ${this.requireToken()}`;
    const res = await this.fetchFn(`${this.apiUrl}${path}`, { ...init, headers });
    return res;
  }

  private async json<T>(res: Response, fallback: string): Promise<T> {
    if (!res.ok) {
      let msg = fallback;
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) msg = data.error;
      } catch {
        /* ignore */
      }
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return (await res.json()) as T;
  }

  /** 연결성 + 토큰 유효성. */
  async health(): Promise<{ api: string; reachable: boolean; tokenValid: boolean | "unset" }> {
    const out = { api: this.apiUrl, reachable: false, tokenValid: "unset" as boolean | "unset" };
    try {
      const h = await this.req("/health", {}, false);
      out.reachable = h.ok;
    } catch {
      return out;
    }
    if (this.token) {
      try {
        const s = await this.req("/admin/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: this.token }),
        }, false);
        out.tokenValid = s.ok;
      } catch {
        out.tokenValid = false;
      }
    }
    return out;
  }

  async listQueue(params: QueueParams): Promise<unknown> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    const res = await this.req(`/admin/reports?${qs.toString()}`);
    return this.json(res, "큐를 불러오지 못했습니다.");
  }

  async getReport(id: string): Promise<unknown> {
    const res = await this.req(`/admin/reports/${encodeURIComponent(id)}`);
    return this.json(res, "제보를 불러오지 못했습니다.");
  }

  async analyze(id: string): Promise<unknown> {
    const res = await this.req(`/admin/reports/${encodeURIComponent(id)}/analyze`, { method: "POST" });
    return this.json(res, "분석에 실패했습니다.");
  }

  async getAttachment(id: string, idx: number): Promise<{ base64: string; mime: string }> {
    const res = await this.req(`/admin/reports/${encodeURIComponent(id)}/attachments/${idx}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: 첨부를 불러오지 못했습니다.`);
    const mime = res.headers.get("content-type") ?? "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), mime };
  }

  async recordVerdict(id: string, body: VerdictBody): Promise<unknown> {
    const res = await this.req(`/admin/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.json(res, "판정 저장에 실패했습니다.");
  }

  async listPublishable(): Promise<unknown> {
    const res = await this.req(`/admin/export`);
    return this.json(res, "공개 배포 대상을 불러오지 못했습니다.");
  }

  async stats(): Promise<unknown> {
    const res = await this.req(`/stats`, {}, false);
    return this.json(res, "통계를 불러오지 못했습니다.");
  }
}
