import type { CSSProperties } from 'react';
import { getSpawnDrops, labelOf } from '../game/rules';
import type { Item } from '../game/types';
import type { Fx } from '../hooks/useGame';

interface Props {
  item: Item;
  fx?: Fx['kind'];
  dimmed?: boolean;
  /** 정답 칸에 고정된 글자 */
  locked?: boolean;
}

/** 글자(레벨)마다 색상(hue)이 달라서 한눈에 구분됨. 인접한 글자끼리도 색이 확 다르도록 47°씩 건너뜀 */
export const hueOf = (level: number): number => (level * 47) % 360;

export function Tile({ item, fx, dimmed, locked }: Props) {
  const spawnable = getSpawnDrops(item) !== null;
  const cls = ['tile', fx, dimmed && 'src', locked && 'locked'].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--hue': hueOf(item.level) } as CSSProperties}>
      {labelOf(item)}
      {spawnable && <span className="dot" />}
      {locked && <span className="ck">✓</span>}
    </div>
  );
}
