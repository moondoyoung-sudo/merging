import type { CSSProperties } from 'react';
import { CHAINS, CHAIN_IDS, GENERATORS } from '../game/config';
import { generatorLabel, generatorLetters, generatorProbabilities } from '../game/generators';
import { itemForLetter } from '../game/rules';
import { hueOf } from './Tile';

const percent = (p: number): string => (p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);

/** 화면 맨 위에 항상 펼쳐져 있는 글자 순서표 */
export function LetterStrip() {
  return (
    <div className="letter-strip">
      <div className="strip-title">
        글자 순서 <small>같은 글자 2개를 합치면 → 다음 글자</small>
      </div>
      {CHAIN_IDS.map((chain) => (
        <div key={chain} className="strip-chips">
          {CHAINS[chain].map((label, level) => (
            <b key={label} className="chip" style={{ '--hue': hueOf(level) } as CSSProperties}>
              {label}
            </b>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 생성기별 글자 확률 (접어 둘 수 있음) */
export function GeneratorOdds() {
  return (
    <details className="guide">
      <summary>생성기 확률 보기</summary>
      <div className="gen-odds">
        {GENERATORS.map((g) => {
          const probs = generatorProbabilities(g);
          return (
            <div key={generatorLabel(g)} className="odds-row">
              <strong>{generatorLabel(g)}</strong>
              {generatorLetters(g).map((letter, i) => (
                <span key={letter} className="odds">
                  <b
                    className="chip"
                    style={{ '--hue': hueOf(itemForLetter(letter)?.level ?? 0) } as CSSProperties}
                  >
                    {letter}
                  </b>
                  {percent(probs[i]!)}
                </span>
              ))}
            </div>
          );
        })}
        <p>생성기는 구간의 앞글자가 가장 잘 나오고, 뒤로 갈수록 확률이 줄어요.</p>
      </div>
    </details>
  );
}
