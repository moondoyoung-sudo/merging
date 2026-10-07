import { AP_MAX } from '../game/config';

interface Props {
  ap: number;
  msUntilNext: number | null;
}

function formatRemain(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ApBar({ ap, msUntilNext }: Props) {
  return (
    <div className="ap">
      <div className="ap-top">
        <span className="ap-num">
          {ap}
          <small> / {AP_MAX}</small>
        </span>
        <span className="ap-timer">
          {msUntilNext === null ? '가득 참' : `다음 충전 ${formatRemain(msUntilNext)}`}
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${(ap / AP_MAX) * 100}%` }} />
      </div>
    </div>
  );
}
