// 펼침 → 중간 굽힘 → 주먹의 연속 동작을 유지한다.
export function updateEraserGrip(eraser, grip) {
  if (!Number.isFinite(grip)) { eraser.on = false; eraser.fist = false; return; }
  if (grip < .4) {
    eraser.needsOpen = false;
    eraser.on = true;
    eraser.fist = false;
    return;
  }
  if (eraser.needsOpen) { eraser.on = false; eraser.fist = false; return; }
  eraser.fist = !!eraser.on && (grip > .55 || (!!eraser.fist && grip > .43));
  // 손가락이 중간까지 굽혀져 있어도 활성 상태를 끊지 않는다.
}
