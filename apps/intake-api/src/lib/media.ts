// 첨부 미디어 처리 — 안전한 파일명, magic bytes 타입 판별. (제약 상수는 constants.ts)

/** 경로 조작/위험 문자를 제거한 안전한 파일명. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "file";
}

/**
 * 바이트 시그니처(magic bytes)로 실제 이미지 타입을 판별한다.
 * Content-Type 헤더는 신뢰하지 않는다(위조·polyglot 방어). finalize 에서 사용.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  const at = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at([0x47, 0x49, 0x46, 0x38])) return "image/gif"; // GIF8
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return null;
}
