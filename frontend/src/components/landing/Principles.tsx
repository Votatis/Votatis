import Reveal from "./Reveal";
import { BadgeCheck, Link as LinkIcon, Shield, List, Expand, EyeOff } from "./icons";

const ITEMS = [
  { Icon: BadgeCheck, h: "검증 우선", p: "미검증과 사실확인을 절대 같은 무게로 두지 않습니다." },
  { Icon: LinkIcon, h: "출처 추적", p: "출처가 없으면 등록되지 않습니다." },
  { Icon: Shield, h: "무결성 증명", p: "첨부는 해시로 봉인해 변조를 확인합니다." },
  { Icon: List, h: "중립 서술", p: "단정하지 않고 라벨로 표현합니다." },
  { Icon: Expand, h: "개방 기여", p: "포맷과 절차를 모두 공개합니다." },
  { Icon: EyeOff, h: "최소 노출", p: "개인정보를 최소화하고 삭제 경로를 둡니다." },
];

export default function Principles() {
  return (
    <section className="sec" id="principles">
      <div className="wrap">
        <Reveal style={{ marginBottom: 48 }}>
          <p className="eyebrow">설계 원칙</p>
          <h2>
            기술이 아니라,
            <br />
            신뢰도를 우선합니다.
          </h2>
        </Reveal>
        <Reveal className="grid6">
          {ITEMS.map(({ Icon, h, p }) => (
            <div className="prin" key={h}>
              <div className="ic">
                <Icon size={20} />
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
