import Reveal from "./Reveal";

const TYPE_BARS = [
  { label: "지연", v: 89, w: "100%" },
  { label: "수치 에러", v: 78, w: "88%" },
  { label: "기타", v: 58, w: "65%" },
  { label: "훼손", v: 52, w: "58%" },
  { label: "봉인", v: 41, w: "46%" },
];

const REGION_BARS = [
  { label: "경기", v: 64, w: "100%" },
  { label: "서울", v: 58, w: "91%" },
  { label: "부산", v: 31, w: "48%" },
  { label: "인천", v: 27, w: "42%" },
  { label: "경북", v: 24, w: "37%" },
];

function Bars({ data }: { data: typeof TYPE_BARS }) {
  return (
    <>
      {data.map((b, i) => (
        <div
          key={b.label}
          className="hbar"
          style={i === data.length - 1 ? { marginBottom: 0 } : undefined}
        >
          <div className="hl">
            <span>{b.label}</span>
            <b>{b.v}</b>
          </div>
          <div className="track">
            <i style={{ width: b.w }} />
          </div>
        </div>
      ))}
    </>
  );
}

export default function DataViz() {
  return (
    <section className="sec sec-center" id="viz">
      <div className="wrap">
        <Reveal style={{ maxWidth: "52ch", margin: "0 auto" }}>
          <p className="eyebrow">데이터로 보는 아카이브</p>
          <h2>
            제보가 쌓일수록
            <br />
            패턴이 보입니다.
          </h2>
          <p className="desc">
            유형·지역·시점별 분포를 집계해 공개합니다. 모든 수치는 검증 상태별로
            구분됩니다.
          </p>
        </Reveal>

        <Reveal style={{ marginTop: 56, textAlign: "left" }}>
          <div className="chart-card">
            <div className="ch-head">
              <div>
                <div className="t">일자별 제보 접수 추이</div>
                <div className="s">제9회 지방선거 · 최근 7일</div>
              </div>
              <div className="ch-legend">
                <span>
                  <i style={{ background: "var(--red)" }} />접수
                </span>
                <span>
                  <i style={{ background: "var(--g300)" }} />검증 완료
                </span>
              </div>
            </div>
            <svg
              viewBox="0 0 720 220"
              style={{ width: "100%", height: "auto" }}
              preserveAspectRatio="none"
              aria-label="접수 추이"
            >
              <g stroke="var(--g100)" strokeWidth="1">
                <line x1="0" y1="20" x2="720" y2="20" />
                <line x1="0" y1="70" x2="720" y2="70" />
                <line x1="0" y1="120" x2="720" y2="120" />
                <line x1="0" y1="170" x2="720" y2="170" />
              </g>
              <line
                x1="480"
                y1="20"
                x2="480"
                y2="200"
                stroke="var(--red-line)"
                strokeWidth="1.5"
                strokeDasharray="3 4"
              />
              <path
                d="M0,165 L120,150 L240,120 L360,70 L480,40 L600,95 L720,130 L720,200 L0,200 Z"
                fill="var(--red)"
                opacity="0.08"
              />
              <path
                d="M0,165 L120,150 L240,120 L360,70 L480,40 L600,95 L720,130"
                fill="none"
                stroke="var(--red)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M0,185 L120,178 L240,162 L360,140 L480,118 L600,150 L720,168"
                fill="none"
                stroke="var(--g300)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 7"
              />
              <g fill="var(--red)">
                <circle cx="240" cy="120" r="4" />
                <circle cx="360" cy="70" r="4" />
                <circle cx="480" cy="40" r="5.5" stroke="#fff" strokeWidth="2" />
              </g>
            </svg>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11.5px",
                color: "var(--g400)",
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              <span>5/29</span>
              <span>5/31</span>
              <span>6/2</span>
              <span style={{ color: "var(--red)", fontWeight: 700 }}>
                6/3 선거일
              </span>
              <span>6/4</span>
              <span>6/5</span>
              <span>6/6</span>
            </div>
          </div>
        </Reveal>

        <Reveal className="viz-grid">
          <div className="chart-card" style={{ textAlign: "left" }}>
            <div className="ch-head">
              <div>
                <div className="t">유형별 분포</div>
              </div>
            </div>
            <Bars data={TYPE_BARS} />
          </div>
          <div className="chart-card" style={{ textAlign: "left" }}>
            <div className="ch-head">
              <div>
                <div className="t">지역별 분포 (상위)</div>
              </div>
            </div>
            <Bars data={REGION_BARS} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
