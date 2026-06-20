"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArchiveDetail, ArchiveNotFound } from "@/components/archive/ArchiveDetail";
import { loadArchiveRecord, type ArchiveRecord } from "@/lib/archive-source";

export default function RecordClient() {
  const id = useSearchParams().get("id");
  const [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const r = id ? await loadArchiveRecord(id) : null;
      if (!cancelled) {
        setRecord(r);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link href="/archive" style={{ fontSize: 13, fontWeight: 700, color: "var(--g600)" }}>
          ← 아카이브
        </Link>
      </div>
      {loading ? (
        <div className="rdoc">불러오는 중…</div>
      ) : record ? (
        <ArchiveDetail r={record} />
      ) : (
        <ArchiveNotFound id={id ?? "(미지정)"} />
      )}
    </>
  );
}
