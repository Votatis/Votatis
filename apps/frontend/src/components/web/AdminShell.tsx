"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IGrid, IUsers, ICheckSq, IImage, IChart, IEdit } from "@/components/mock/mock-icons";
import Torch from "@/components/landing/Torch";
import { getUser, type AdminUser } from "@/lib/admin-auth";
import { logout } from "@/lib/api/admin";

export type AdminNav = "dashboard" | "members" | "queue" | "evidence" | "content";

const ITEMS: { key: AdminNav; label: string; href: string; Icon: typeof IGrid; rootOnly?: boolean }[] = [
  { key: "dashboard", label: "대시보드", href: "/admin/dashboard", Icon: IGrid },
  { key: "members", label: "회원", href: "/admin/members", Icon: IUsers, rootOnly: true },
  { key: "queue", label: "검토 큐", href: "/admin/queue", Icon: ICheckSq },
  { key: "evidence", label: "원본 데이터", href: "/admin/evidence", Icon: IImage },
];

/** 관리자 콘솔 공용 셸 (사이드바 + 메인). 실동작 레이아웃. */
export default function AdminShell({
  active,
  title,
  sub,
  right,
  children,
}: {
  active: AdminNav;
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  useEffect(() => {
    setUser(getUser());
  }, []);
  const isRoot = user?.role === "root";
  const items = ITEMS.filter((it) => !it.rootOnly || isRoot);

  async function onLogout() {
    await logout();
    router.push("/admin/login");
  }

  return (
    <div className="win" style={{ boxShadow: "none", borderRadius: 14 }}>
      <div className="dash">
        <aside className="dside">
          <div className="ds-logo">
            <Torch size={24} />관리자
          </div>
          <div className="ds-sec">운영</div>
          {items.map((it) => (
            <Link key={it.key + it.href} href={it.href} className={`ds-item${active === it.key ? " on" : ""}`}>
              <it.Icon />
              {it.label}
            </Link>
          ))}
          <div className="ds-sec">콘텐츠</div>
          <Link href="/admin/dashboard" className={`ds-item${active === "content" ? " on" : ""}`}>
            <IEdit />정보·공지
          </Link>
          <div className="ds-sec">바로가기</div>
          <Link href="/preview" className="ds-item">
            <IChart />화면 미리보기
          </Link>
        </aside>
        <div className="dmain">
          <div className="dh">
            <div>
              <h3>{title}</h3>
              {sub && <div className="sub">{sub}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {right}
              {user && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: "var(--g600)" }}>
                    {user.name}
                    <span style={{ color: "var(--g400)" }}> · {user.role === "root" ? "루트" : "검증자"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={onLogout}
                    style={{
                      fontSize: 12.5,
                      color: "var(--g600)",
                      background: "var(--g100)",
                      border: "1px solid var(--g200)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
