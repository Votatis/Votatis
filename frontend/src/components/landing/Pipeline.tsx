import Reveal from "./Reveal";
import { Upload, Shield, CheckSquare, SearchBig, Home } from "./icons";

const STEPS = [
  { n: "01", Icon: Upload, h: "제보 접수", p: "위치·유형·출처·자료를 입력합니다." },
  { n: "02", Icon: Shield, h: "수집·봉인", p: "R2에 올리고 해시로 봉인합니다." },
  { n: "03", Icon: CheckSquare, h: "검토 큐", p: "정규화 포맷으로 등록됩니다." },
  { n: "04", Icon: SearchBig, h: "검증", p: "사람이 원본을 대조해 판정합니다." },
  { n: "05", Icon: Home, h: "공개", p: "통과 데이터만 반영됩니다." },
];

export default function Pipeline() {
  return (
    <section className="sec gray sec-center">
      <div className="wrap">
        <Reveal style={{ maxWidth: "48ch", margin: "0 auto 52px" }}>
          <p className="eyebrow">검증 절차</p>
          <h2>
            제보부터 공개까지,
            <br />
            하나의 흐름.
          </h2>
        </Reveal>
        <Reveal className="pipe">
          {STEPS.map(({ n, Icon, h, p }) => (
            <div className="pstep" key={n}>
              <div className="pn">{n}</div>
              <div className="pic">
                <Icon size={22} />
              </div>
              <h4>{h}</h4>
              <p>{p}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
