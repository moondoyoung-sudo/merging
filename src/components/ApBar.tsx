interface Props {
  /** AP 총 사용량 (누적) */
  used: number;
}

/** AP 충전/제한은 없고, 지금까지 쓴 AP의 총합만 보여줘요 */
export function ApBar({ used }: Props) {
  return (
    <div className="ap-total" title="생성기를 쓸 때마다 쌓이는 AP 총 사용량">
      <span>AP 총 사용량</span>
      <b>{used.toLocaleString()}</b>
    </div>
  );
}
