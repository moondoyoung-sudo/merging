import type { CSSProperties } from 'react';
import { Fragment } from 'react';
import { CHAINS, CHAIN_IDS, SPAWN_COST } from '../game/config';
import { levelRatio } from './Tile';

export function Legend() {
  return (
    <div className="legend">
      {CHAIN_IDS.map((chain) => (
        <div key={chain}>
          {CHAINS[chain].map((label, level) => (
            <Fragment key={label}>
              {level > 0 && '›'}
              <b
                className={`chip chain-${chain}`}
                style={{ '--t': levelRatio({ chain, level }) } as CSSProperties}
              >
                {label}
              </b>
            </Fragment>
          ))}
        </div>
      ))}
      <div>
        <span className="legend-dot" /> 빨간 점이 있는 글자는 더블클릭(더블탭)하면 새 글자가
        나와요 (AP -{SPAWN_COST})
      </div>
    </div>
  );
}
