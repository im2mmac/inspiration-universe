// 인식 결과가 도착할 때 한 번만 보정한다. 큰 이동은 즉시, 정지 부근만 떨림 완화.
export function followHand(x, y, tx, ty, elapsed = 33) {
  const gap = Math.hypot(tx - x, (ty - y) * .56);
  if (gap >= .018) return [tx, ty];
  const tau = gap < .003 ? 32 : 10;
  const amount = 1 - Math.exp(-Math.max(1, Math.min(100, elapsed)) / tau);
  return [x + (tx - x) * amount, y + (ty - y) * amount];
}
