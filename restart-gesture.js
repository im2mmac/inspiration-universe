// 완성 화면에서만 사용. 각 관객의 양손을 따로 추적해 다른 사람 손이 합쳐지지 않는다.
export class RestartGesture {
  reset() { this.motion = null; }
  update(pose, now) {
    const left = pose?.leftWrist, right = pose?.wrist, head = pose?.head;
    if (!left || !right || !head || left[1] >= head[1] || right[1] >= head[1]) {
      this.reset(); return 0;
    }
    const x = [left[0] - pose.leftShoulder[0], right[0] - pose.shoulder[0]];
    let m = this.motion;
    if (!m || now - m.last > 300 || now - m.start > 5000) {
      this.motion = { start: now, last: now, extreme: x, direction: [0, 0], turns: [0, 0] };
      return 0;
    }
    m.last = now;
    const distance = Math.max(.035, pose.span * .35);
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
    return Math.min(1, (now - m.start) / 1600, Math.min(...m.turns) / 3);
  }
}
