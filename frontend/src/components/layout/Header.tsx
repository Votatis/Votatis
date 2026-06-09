import Link from "next/link";

export default function Header() {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a className="brand" href="#top">
          <span className="mark">V</span>Votatis
        </a>
        <nav className="nav-links">
          <a href="#archive">공개 아카이브</a>
          <a href="#admin">검증 시스템</a>
          <a href="#report">제보</a>
          <a href="#principles">설계 원칙</a>
        </nav>
        <Link className="btn btn-primary" href="/report">
          제보하기
        </Link>
      </div>
    </header>
  );
}
