import type { CSSProperties } from 'react';
import { Fragment } from 'react';
import { CHAINS, CHAIN_IDS, GENERATORS } from '../game/config';
import { hueOf } from './Tile';

export function LetterGuide() {
  return (
    <details className="guide">
      <summary>글자 순서표 보기</summary>
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
        <p>
          같은 글자 2개를 합치면 다음 글자가 돼요. A부터 Z까지 한 줄로 이어져 있어요.
          <br />
          생성기 버튼({GENERATORS.map((g) => g.letter).join(', ')})으로 해당 글자를 바로 만들 수 있어요.
        </p>
      </div>
    </details>
  );
}
