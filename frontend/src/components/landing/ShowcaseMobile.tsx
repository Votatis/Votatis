import Reveal from "./Reveal";
import { Check, Pin, Image } from "./icons";

export default function ShowcaseMobile() {
  return (
    <section className="sec gray" id="report">
      <div className="wrap showcase">
        <Reveal className="copy">
          <p className="eyebrow">모바일 제보</p>
          <h2>
            현장에서
            <br />
            바로 남기세요.
          </h2>
          <p className="desc">
            위치와 유형을 고르고 사진을 올리면 끝입니다. 촬영 위치·시각 정보는
            보존된 채 안전하게 업로드되고, 출처가 함께 기록됩니다.
          </p>
          <div className="feat">
            <div className="fi">
              <span className="ic">
                <Check size={14} />
              </span>
              <p>
                카메라로 <b>바로 촬영</b>해 제보할 수 있습니다.
              </p>
            </div>
            <div className="fi">
              <span className="ic">
                <Check size={14} />
              </span>
              <p>
                메타데이터를 확인하고 <b>1회용 보안 링크</b>로 직접 업로드합니다.
              </p>
            </div>
            <div className="fi">
              <span className="ic">
                <Check size={14} />
              </span>
              <p>
                실명·연락처는 <b>저장하지 않습니다.</b>
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="phone">
            <div className="scr">
              <div className="statusbar">
                <span>9:41</span>
                <span className="ic">
                  <svg width="17" height="12" viewBox="0 0 18 12" fill="currentColor">
                    <rect x="0" y="7" width="3" height="5" rx="1" />
                    <rect x="4.5" y="4.5" width="3" height="7.5" rx="1" />
                    <rect x="9" y="2" width="3" height="10" rx="1" />
                    <rect x="13.5" y="0" width="3" height="12" rx="1" />
                  </svg>
                  <svg width="22" height="12" viewBox="0 0 24 12" fill="none">
                    <rect
                      x="1"
                      y="1"
                      width="19"
                      height="10"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="3"
                      y="3"
                      width="13"
                      height="6"
                      rx="1.5"
                      fill="currentColor"
                    />
                    <rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" />
                  </svg>
                </span>
              </div>
              <div className="ph-top">
                <div className="pgt">
                  <span>작성 완성도</span>
                  <b>80%</b>
                </div>
                <div className="ph-pbar">
                  <i />
                </div>
                <div className="t">제보하기</div>
              </div>
              <div className="ph-body">
                <div className="flbl">위치</div>
                <div className="finput filled">
                  <Pin size={15} />
                  경기도 · 성남시 분당구
                </div>
                <div className="flbl">유형</div>
                <div className="ftypes">
                  <b>수치 에러</b>
                  <b className="on">봉인</b>
                  <b>훼손</b>
                  <b>지연</b>
                  <b>기타</b>
                </div>
                <div className="flbl">상세 설명</div>
                <div className="farea">
                  <p>
                    오후 4시경 사전투표함 봉인 스티커 일부가 떨어진 상태로
                    보였습니다. 사진을 함께 첨부합니다.
                  </p>
                  <div className="cc">112 / 2000</div>
                </div>
                <div className="flbl">첨부 자료</div>
                <div className="fthumbs">
                  <div className="th">
                    <Image size={20} />
                    <span className="ex">EXIF</span>
                  </div>
                  <div className="th">
                    <Image size={20} />
                    <span className="ex">EXIF</span>
                  </div>
                </div>
                <div className="fopt">메타데이터 확인됨 · 최적화 시 약 -74%</div>
                <div className="fbtn-sub">제보 보내기</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
