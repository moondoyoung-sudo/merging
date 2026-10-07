import type { CSSProperties } from 'react';
import { chainLength, getSpawnDrops, labelOf } from '../game/rules';
import type { Item } from '../game/types';

interface Props {
  item: Item;
  fx?: 'pop' | 'spawn';
  dimmed?: boolean;
}

export function levelRatio(item: Item): number {
  return item.level / (chainLength(item.chain) - 1);
}

export function Tile({ item, fx, dimmed }: Props) {
  const t = levelRatio(item);
  const spawnable = getSpawnDrops(item) !== null;
  const cls = ['tile', `chain-${item.chain}`, fx, dimmed && 'src', t > 0.8 && 'top']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={{ '--t': t } as CSSProperties}>
      {labelOf(item)}
      {spawnable && <span className="dot" />}
      <span className="lv">{item.level + 1}</span>
    </div>
  );
}
