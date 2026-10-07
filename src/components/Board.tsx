import { useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import type { Fx } from '../hooks/useGame';
import type { Board as BoardType, Item } from '../game/types';
import { Tile } from './Tile';

interface Props {
  board: BoardType;
  fx: Fx | null;
  onMove: (from: number, to: number) => void;
  onActivate: (index: number) => void;
}

interface Drag {
  from: number;
  startX: number;
  startY: number;
  moved: boolean;
  size: number;
}
interface Ghost {
  item: Item;
  x: number;
  y: number;
  size: number;
}

const DRAG_THRESHOLD = 6; // px
const DOUBLE_TAP_MS = 320;

function cellIndexAt(x: number, y: number): number {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest<HTMLElement>('[data-index]');
  return cell ? Number(cell.dataset.index) : -1;
}

export function Board({ board, fx, onMove, onActivate }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastTap = useRef({ index: -1, time: 0 });
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [hover, setHover] = useState(-1);
  const [dragFrom, setDragFrom] = useState(-1);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (!cell) return;
    const index = Number(cell.dataset.index);
    if (!board[index]) return;
    e.preventDefault();
    drag.current = {
      from: index,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      size: cell.getBoundingClientRect().width - 6,
    };
    boardRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
      d.moved = true;
      setDragFrom(d.from);
    }
    if (d.moved) {
      const item = board[d.from];
      if (item) setGhost({ item, x: e.clientX, y: e.clientY, size: d.size });
      const target = cellIndexAt(e.clientX, e.clientY);
      setHover(target !== d.from ? target : -1);
    }
  };

  const finish = (e: RPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGhost(null);
    setHover(-1);
    setDragFrom(-1);

    if (d.moved) {
      if (cancelled) return;
      const target = cellIndexAt(e.clientX, e.clientY);
      if (target >= 0) onMove(d.from, target);
      return;
    }
    if (cancelled) return;
    // 터치/마우스 공용 더블탭 감지
    const t = Date.now();
    if (lastTap.current.index === d.from && t - lastTap.current.time < DOUBLE_TAP_MS) {
      lastTap.current = { index: -1, time: 0 };
      onActivate(d.from);
    } else {
      lastTap.current = { index: d.from, time: t };
    }
  };

  return (
    <div
      ref={boardRef}
      className="board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {board.map((item, i) => {
        const hasFx = fx?.index === i;
        return (
          <div key={i} className={`cell${hover === i ? ' over' : ''}`} data-index={i}>
            {item && (
              <Tile
                key={hasFx ? `fx-${fx.id}` : 'static'}
                item={item}
                fx={hasFx ? fx.kind : undefined}
                dimmed={dragFrom === i}
              />
            )}
          </div>
        );
      })}
      {ghost && (
        <div
          className="ghost"
          style={{ left: ghost.x, top: ghost.y, width: ghost.size, height: ghost.size }}
        >
          <Tile item={ghost.item} />
        </div>
      )}
    </div>
  );
}
