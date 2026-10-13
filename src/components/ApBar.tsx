import { AP_MAX } from '../game/config';

interface Props {
  ap: number;
  /** AP 총 사용량 (누적) */
  used: number;
  msUntilNext: number | null;
}

function formatRemain(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ApBar({ ap, used, msUntilNext }: Props) {
  return (
    <div className="ap">
      <div className="ap-top">
        <span className="ap-num">
          {ap}
          <small> / {AP_MAX}</small>
        </span>
        <span className="ap-used" title="지금까지 사용한 AP 총합">
          총 사용 <b>{used.toLocaleString()}</b>
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${(ap / AP_MAX) * 100}%` }} />
      </div>
      <div className="ap-timer">
        {msUntilNext === null ? '가득 참' : `다음 충전 ${formatRemain(msUntilNext)}`}
      </div>
    </div>
  );
}
