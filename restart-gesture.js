// 완성 화면에서만 사용. 각 관객의 양손을 따로 추적해 다른 사람 손이 합쳐지지 않는다.
export class RestartGesture {
  reset() { this.motion = null; }
  update(pose, now) {
    const left = pose?.leftPalm || pose?.leftWrist;
    const right = pose?.palm || pose?.wrist;
    const shoulders = pose?.leftShoulder && pose?.shoulder;
    // 얼굴이 가려져도 어깨 기준으로 판정. 머리 높이 부근까지 조금 내려와도 허용.
    const ceiling = shoulders ? (pose.head?.[1] ?? Math.min(pose.shoulder[1], pose.leftShoulder[1]) - pose.span * .6) + pose.span * .15 : -1;
    if (!left || !right || !shoulders || left[1] >= ceiling || right[1] >= ceiling) {
      if (this.motion && now - this.motion.last <= 500) {
        this.motion.gap = true;
        return this.motion.progress;
      }
      this.reset(); return 0;
    }
    const x = [left[0] - pose.leftShoulder[0], left[1] - pose.leftShoulder[1], right[0] - pose.shoulder[0], right[1] - pose.shoulder[1]];
    let m = this.motion;
    if (!m || now - m.last > 500 || now - m.start > 7000) {
      this.motion = { start: now, last: now, extreme: x, direction: [0, 0, 0, 0], turns: [0, 0, 0, 0], progress: .08, visibleMs: 0 };
      return .08;
    }
    m.visibleMs += Math.min(100, now - m.last);
    m.last = now;
    if (m.gap) {
      m.extreme = x; m.direction.fill(0); m.gap = false;
      return m.progress;
    }
    const distance = Math.max(.022, pose.span * .2);
    x.forEach((value, i) => {
      const delta = value - m.extreme[i];
      const direction = Math.sign(delta);
      if (direction === m.direction[i]) m.extreme[i] = value;
      else if (Math.abs(delta) >= distance) {
        if (m.direction[i]) m.turns[i]++;
        m.direction[i] = direction;
        m.extreme[i] = value;
      }
    });
    const leftTurns = Math.max(m.turns[0], m.turns[1]);
    const rightTurns = Math.max(m.turns[2], m.turns[3]);
    m.progress = Math.max(.08, Math.min(1, m.visibleMs / 1000, Math.min(leftTurns, rightTurns) / 2));
    return m.progress;
  }
}
