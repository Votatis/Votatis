import Link from "next/link";

/** 공개 실동작 페이지 상단 바 (랜딩 앵커 헤더와 별개) */
export default function SiteHeader() {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link className="brand" href="/">
          <span className="mark">V</span>Votatis
        </Link>
        <nav className="nav-links">
          <Link href="/archive">공개 아카이브</Link>
          <Link href="/stats">통계</Link>
          <Link href="/search">검색</Link>
        </nav>
        <Link className="btn btn-primary" href="/report">
          제보하기
        </Link>
      </div>
    </header>
  );
}
