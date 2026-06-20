"use client";

// 공개 아카이브 레코드의 증거 이미지 갤러리(spec 0016).
// 작은 썸네일로 보여주고, 클릭하면 전체화면 라이트박스로 확대(페이스북 스타일).
// 이미지 바이트는 공개 스트리밍 엔드포인트 GET /reports/{id}/attachments/{idx} 에서 받는다.

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";

interface Attachment {
  filename: string;
  mime: string;
  size: number;
  sha256: string;
}

function attachmentUrl(id: string, idx: number): string {
  return `${API_BASE_URL}/reports/${encodeURIComponent(id)}/attachments/${idx}`;
}

export function AttachmentGallery({ id, attachments }: { id: string; attachments: Attachment[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback(
    (dir: 1 | -1) =>
      setOpen((cur) => {
        if (cur === null) return cur;
        const next = (cur + dir + attachments.length) % attachments.length;
        return next;
      }),
    [attachments.length],
  );

  // 라이트박스 열렸을 때 키보드(ESC 닫기, ←/→ 이동) + 배경 스크롤 잠금.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, go]);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="attgrid">
        {attachments.map((a, i) => (
          <button
            key={i}
            type="button"
            className="attthumb"
            onClick={() => setOpen(i)}
            aria-label={`${a.filename} 확대 보기`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachmentUrl(id, i)} alt={a.filename} loading="lazy" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="lightbox" onClick={close} role="dialog" aria-modal="true">
          <button type="button" className="lb-close" onClick={close} aria-label="닫기">
            ×
          </button>
          {attachments.length > 1 && (
            <button
              type="button"
              className="lb-nav lb-prev"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="이전"
            >
              ‹
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lb-img"
            src={attachmentUrl(id, open)}
            alt={attachments[open].filename}
            onClick={(e) => e.stopPropagation()}
          />
          {attachments.length > 1 && (
            <button
              type="button"
              className="lb-nav lb-next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="다음"
            >
              ›
            </button>
          )}
          <div className="lb-cap">
            {attachments[open].filename} · {open + 1}/{attachments.length}
          </div>
        </div>
      )}
    </>
  );
}
