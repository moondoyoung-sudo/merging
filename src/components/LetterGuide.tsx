import type { CSSProperties } from 'react';
import { Fragment } from 'react';
import { CHAINS, CHAIN_IDS, GENERATORS } from '../game/config';
import {
  generatorLabel,
  generatorLetters,
  generatorProbabilities,
} from '../game/generators';
import { itemForLetter } from '../game/rules';
import { hueOf } from './Tile';

const percent = (p: number): string => (p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);

export function LetterGuide() {
  return (
    <details className="guide">
      <summary>글자 순서표 · 생성기 확률 보기</summary>
      <div className="guide-body">
        {CHAIN_IDS.map((chain) => (
          <div key={chain} className="guide-row">
            {CHAINS[chain].map((label, level) => (
              <Fragment key={label}>
                {level > 0 && <span className="arrow">›</span>}
                <b className="chip" style={{ '--hue': hueOf(level) } as CSSProperties}>
                  {label}
                </b>
              </Fragment>
            ))}
          </div>
        ))}
        <p>같은 글자 2개를 합치면 다음 글자가 돼요. A부터 Z까지 한 줄로 이어져 있어요.</p>

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
        </div>
        <p>생성기는 구간의 앞글자가 가장 잘 나오고, 뒤로 갈수록 확률이 줄어요.</p>
      </div>
    </details>
  );
}
