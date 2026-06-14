import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdminClient } from "./client.js";
import { validateVerdict, ADMIN_STATUSES } from "./verdict.js";

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `오류: ${message}` }], isError: true };
}
async function guarded(fn: () => Promise<unknown>) {
  try {
    return textResult(await fn());
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}

/** 모든 검증 관리 도구를 등록한다. 검증 로직은 intake-api 가 단일 출처 — 여기선 호출 + 페르소나5 가드레일/안내. */
export function registerTools(server: McpServer, client: AdminClient): void {
  server.registerTool(
    "health",
    {
      title: "연결 확인",
      description: "intake-api 연결성과 관리자 토큰 유효성을 확인한다. 작업 시작 전 가장 먼저 호출해 설정을 검증하라.",
    },
    async () => guarded(() => client.health()),
  );

  server.registerTool(
    "list_review_queue",
    {
      title: "검토 큐 조회",
      description:
        "검증 대기/진행 제보 목록과 상태별 카운트. status(unverified|reviewing|confirmed|disputed|debunked|corrected)·q(제목/요약/본문 키워드)·지역(sido/sigungu)·tag 로 필터. 보통 status=unverified 부터 검토한다.",
      inputSchema: {
        status: z.string().optional(),
        q: z.string().optional(),
        election: z.string().optional(),
        sido: z.string().optional(),
        sigungu: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
      },
    },
    async (args) => guarded(() => client.listQueue(args)),
  );

  server.registerTool(
    "get_report",
    {
      title: "제보 상세",
      description:
        "제보 1건의 내부 필드 포함 상세(제보자 익명ID·EXIF·출처·첨부 해시·검증 이력). 판정 전 반드시 출처 접근성과 첨부를 검토하라.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => guarded(() => client.getReport(id)),
  );

  server.registerTool(
    "analyze_report",
    {
      title: "보조 분석 신호",
      description:
        "휴리스틱(±AI) 보조 신호: 태그 추천·신뢰도 신호·합성 위험·요약 힌트. ⚠️ 이것은 보조 신호일 뿐 판정 근거가 아니다. 이 결과만으로 판정하지 말고, 사람이 출처·원본으로 교차검증하라(페르소나5).",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => guarded(() => client.analyze(id)),
  );

  server.registerTool(
    "view_attachment",
    {
      title: "증거 첨부 열람",
      description: "제보 첨부(증거 이미지)를 직접 본다. index 는 0부터. 원본을 눈으로 대조해 합성·조작·맥락을 판단하라.",
      inputSchema: { id: z.string(), index: z.number().int().min(0) },
    },
    async ({ id, index }) => {
      try {
        const { base64, mime } = await client.getAttachment(id, index);
        return { content: [{ type: "image" as const, data: base64, mimeType: mime }] };
      } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "record_verdict",
    {
      title: "판정 기록",
      description:
        "제보 상태를 판정/갱신한다. ⚠️ confirmed/disputed/debunked/corrected 판정에는 검증 방법(method)과 근거 링크(evidence_links 1개 이상)가 반드시 필요하다 — 없으면 거부된다. 페르소나5 규율: 근거 없는 판정 금지, '우리 편' 자료일수록 더 엄격히. tags·rebuttals(양측 기록)·notes 도 함께 남길 수 있다.",
      inputSchema: {
        id: z.string(),
        status: z.enum(ADMIN_STATUSES),
        method: z.string().optional(),
        evidence_links: z.array(z.string().url()).optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        rebuttals: z.array(z.object({ text: z.string(), source_url: z.string().url().optional() })).optional(),
        reviewer: z.string().optional(),
      },
    },
    async (args) => {
      const check = validateVerdict(args);
      if (!check.ok) return errorResult(check.error);
      const body = {
        status: args.status,
        reviewer: args.reviewer,
        tags: args.tags,
        rebuttals: args.rebuttals,
        verification: { method: args.method, notes: args.notes, evidence_links: args.evidence_links },
      };
      return guarded(() => client.recordVerdict(args.id, body));
    },
  );

  server.registerTool(
    "list_publishable",
    {
      title: "공개 배포 대상",
      description: "검증 완료(confirmed/disputed/debunked/corrected)되어 공개 배포 가능한 레코드 목록(공개 필드).",
    },
    async () => guarded(() => client.listPublishable()),
  );

  server.registerTool(
    "get_stats",
    { title: "통계", description: "공개 레코드의 상태별·선거별·일자별 집계." },
    async () => guarded(() => client.stats()),
  );
}
