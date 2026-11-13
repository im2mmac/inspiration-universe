// 영감의 성운: 낚은 영감이 별가루가 되어 우주 배경에 떠 있는다.
// - 이미지 영감은 그림의 실제 색을 머금은 입자로, 글자 영감은 글자 모양의 입자로 만든다.
// - 형체를 이뤘다가 성운처럼 흩어지기를 천천히 되풀이하고, 박자와 음량에 숨을 쉰다.
// - 낚으면 수집 칸에서 별가루가 솟아올라 모이고, 놓아주면 흩어져 사라진다.
// - '잉크' 영감: 물에 떨어진 잉크처럼 한 점에서 번져 형체가 되고, 소용돌이치며 풀렸다 다시 모인다.

const TAU = Math.PI * 2;
const shapes = new Map();   // 같은 영감은 모양을 한 번만 뽑는다

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 이미지에서 점 뽑기: 불투명한 곳의 위치와 색
function sampleImage(src, count) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const side = 110;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = side;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const scale = Math.min(side / image.width, side / image.height);
      const w = image.width * scale, h = image.height * scale;
      ctx.drawImage(image, (side - w) / 2, (side - h) / 2, w, h);
      const data = ctx.getImageData(0, 0, side, side).data;
      const points = [];
      for (let y = 0; y < side; y += 1) {
        for (let x = 0; x < side; x += 1) {
          const i = (y * side + x) * 4;
          if (data[i + 3] > 90) points.push([x / side - .5, y / side - .5, data[i], data[i + 1], data[i + 2]]);
        }
      }
      resolve(pick(points, count));
    };
    image.onerror = () => resolve([]);
    image.src = src;
  });
}

// 글자에서 점 뽑기: 글자 획 위의 위치, 색은 나중에 정한다
function sampleText(text, count) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 140;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let size = 96;
  ctx.font = `600 ${size}px "Noto Serif KR", "Nanum Myeongjo", Batang, serif`;
  const width = ctx.measureText(text).width;
  if (width > 400) {
    size = Math.floor(size * 400 / width);
    ctx.font = `600 ${size}px "Noto Serif KR", "Nanum Myeongjo", Batang, serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 210, 72);
  const data = ctx.getImageData(0, 0, 420, 140).data;
  const points = [];
  for (let y = 0; y < 140; y += 1) {
    for (let x = 0; x < 420; x += 1) {
      if (data[(y * 420 + x) * 4 + 3] > 120) points.push([(x - 210) / 420, (y - 70) / 420]);
    }
  }
  return pick(points, count);
}

// 잉크 방울 그림: 색을 몇 단계로 묶어 미리 그려 둔다(수백 가지 색이어도 가볍게)
const blobs = new Map();
function inkBlob(color) {
  const [r, g, b] = color.match(/\d+/g).map(n => Math.round(+n / 24) * 24);
  const key = r + "," + g + "," + b;
  if (blobs.has(key)) return blobs.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(.35, `rgba(${r},${g},${b},.55)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, 32, 32);
  blobs.set(key, c);
  return c;
}

function pick(points, count) {
  if (points.length <= count) return points;
  const out = [];
  const step = points.length / count;
  for (let i = 0; i < count; i += 1) out.push(points[Math.floor(i * step + Math.random() * step)]);
  return out;
}

export class ArtField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.entities = new Map();
    this.w = 1; this.h = 1; this.dpr = 1;
    this.lite = false;
    this.visibility = 1;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  // items: 지금 수집 칸의 영감들. origin(item): 별가루가 솟아오를 수집 칸 위치 [x, y] (무대 비율)
  sync(items, { origin, colors, tints, isInk = item => item.seed % 2 === 0 }) {
    const now = performance.now();
    const alive = new Set(items.map(item => item.id));
    for (const [id, entity] of this.entities) {
      if (!alive.has(id) && !entity.dying) {
        entity.dying = now;
        for (const p of entity.particles) {
          const a = Math.random() * TAU, v = 1.5 + Math.random() * 5;
          p.vx += Math.cos(a) * v; p.vy += Math.sin(a) * v - 1;
        }
      }
    }
    for (const item of items) {
      if (this.entities.has(item.id)) continue;
      const entity = {
        item, born: Math.max(now, item.joinAt || now), particles: [], dying: 0,
        cycle: 15000 + (item.seed % 9) * 1100, phase: (item.seed * 0.37) % 1,
        // 움직임의 결: Y축 회전, X축 회전, 흔들림, 맴돌기 중 하나
        move: ["y", "x", "wobble", "spin"][(item.seed >> 1) % 4],
        dir: item.seed % 3 === 0 ? -1 : 1,
        // 여정: 천천히 커지며 다가오다가 흩어지고, 다시 작게 모여 시작한다
        journey: 24000 + (item.seed % 7) * 2600,
        player: hexRgb(colors[item.player] || "#ffffff"), tint: hexRgb(tints[item.role] || "#ffffff"),
        origin: origin(item),
        ink: isInk(item),
      };
      this.entities.set(item.id, entity);
      this.build(entity);
    }
  }

  async build(entity) {
    const { item } = entity;
    const count = this.lite ? 300 : item.kind === "image" ? 720 : 600;
    const key = item.seed + ":" + count;
    if (!shapes.has(key)) {
      shapes.set(key, item.kind === "image"
        ? sampleImage("./assets/" + item.image + ".webp", count)
        : Promise.resolve(sampleText(item.name, count)));
    }
    const points = await shapes.get(key);
    const [ox, oy] = entity.origin;
    const [cx, cy] = this.place(item, performance.now());
    entity.particles = points.map(point => {
      const dist = Math.hypot(point[0], point[1]);
      const word = item.kind !== "image";
      let r, g, b;
      if (word) {
        // 글자: 역할 색과 관람객 색을 섞은 빛
        const t = Math.random();
        [r, g, b] = entity.tint.map((c, i) => Math.round(c * (1 - t * .55) + entity.player[i] * t * .55));
      } else {
        // 그림: 원래 색을 조금 밝게
        [r, g, b] = [point[2], point[3], point[4]].map(c => Math.min(255, Math.round(c * 1.15 + 25)));
      }
      if (entity.ink) {
        // 잉크 방울: 영감 자리 한 점에서 시작해 가운데부터 번져 나간다
        return {
          hx: point[0], hy: point[1], hz: (Math.random() - .5) * .07,
          x: cx * this.w + (Math.random() - .5) * 6, y: cy * this.h + (Math.random() - .5) * 6,
          vx: 0, vy: 0,
          delay: 250 + dist * 3800 + Math.random() * 500,
          seed: Math.random() * TAU,
          sink: .4 + Math.random() * .6,
          size: 2.4 + Math.random() * (word ? 3 : 4),
          color: `rgb(${r},${g},${b})`,
        };
      }
      return {
        hx: point[0], hy: point[1], hz: (Math.random() - .5) * (word ? .05 : .09),
        x: ox * this.w + (Math.random() - .5) * 40, y: oy * this.h + (Math.random() - .5) * 20,
        vx: 0, vy: 0,
        delay: Math.random() * 900,
        seed: Math.random() * TAU,
        size: 1.1 + Math.random() * (word ? 1.8 : 2.2),
        color: `rgb(${r},${g},${b})`,
      };
    });
  }

  // 이번 프레임의 자세: 축마다 다른 회전
  orient(entity, time) {
    const t = time + entity.phase * 20000, d = entity.dir;
    let ay = 0, ax = 0, az = 0;
    if (entity.move === "y") { ay = t * .00042 * d; ax = .22 * Math.sin(t * .00031); }
    else if (entity.move === "x") { ax = t * .00036 * d; ay = .25 * Math.sin(t * .00027); }
    else if (entity.move === "wobble") { ay = .95 * Math.sin(t * .00055); ax = .7 * Math.sin(t * .00041 + 1); az = .2 * Math.sin(t * .0003); }
    else { az = t * .00028 * d; ay = .35 * Math.sin(t * .0004); ax = .25 * Math.sin(t * .00033); }
    return { cy: Math.cos(ay), sy: Math.sin(ay), cx: Math.cos(ax), sx: Math.sin(ax), cz: Math.cos(az), sz: Math.sin(az) };
  }

  // 3D로 돌린 뒤 원근: [x, y, 가까움(크기 배율)]
  turn(o, x, y, z) {
    const x0 = x * o.cz - y * o.sz, y0 = x * o.sz + y * o.cz;
    const x1 = x0 * o.cy + z * o.sy, z1 = -x0 * o.sy + z * o.cy;
    const y1 = y0 * o.cx - z1 * o.sx, z2 = y0 * o.sx + z1 * o.cx;
    const k = 1 / (1 + z2 * 1.1);
    return [x1 * k, y1 * k, k];
  }

  // 여정 단계: grow(크기), dissolve(흩어짐 0~1), show(다시 모일 때 서서히 보이기)
  voyage(entity, time) {
    const j = ((time - entity.born) / entity.journey) % 1;
    const e = j < .72 ? j / .72 : 1;
    const grow = .72 + 1.05 * (e * e * (3 - 2 * e)) + (j > .72 ? (j - .72) * 1.4 : 0);
    const dissolve = j < .7 ? 0 : Math.pow((j - .7) / .3, 1.4);
    const show = j < .05 ? j / .05 : j > .9 ? 1 - (j - .9) / .1 : 1;
    return { grow, dissolve, show: Math.max(.08, show) };
  }

  // 영감 자리: 화면 위쪽에 황금각으로 흩어 두고, 전체가 아주 천천히 돈다
  place(item, time) {
    const angle = item.slot * 2.39996 + item.seed * .07 + time * .000012;
    const radius = .19 + (item.seed % 4) * .045;
    return [.5 + radius * Math.cos(angle), .36 + radius * .62 * Math.sin(angle)];
  }

  draw(time, { energy = 0, beat = 0, state = "active", fresh = () => 1 } = {}) {
    const { ctx, w, h, dpr } = this;
    // 프레임 간격이 달라도 같은 속도로 움직이게
    const step = Math.min(4, (time - (this.last ?? time)) / 16.7 || 1);
    this.last = time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const target = state === "review" ? 1 : state === "ascend" || state === "idle" ? 0 : .78;
    this.visibility += (target - this.visibility) * .04;
    if (this.visibility < .01 && !this.entities.size) return;
    ctx.globalCompositeOperation = "lighter";
    const breath = 1 + energy * .18 + beat * .05;
    for (const [id, entity] of this.entities) {
      const age = time - entity.born;
      const fade = entity.dying ? 1 - (performance.now() - entity.dying) / 1600 : 1;
      if (fade <= 0) { this.entities.delete(id); continue; }
      if (!entity.particles.length) continue;
      const [cx, cy] = this.place(entity.item, time);
      const span = (entity.item.kind === "image" ? .2 : .3) * w * breath;
      // 형체 ↔ 성운: 주기마다 천천히 흩어졌다 다시 모인다
      const wave = .5 - .5 * Math.cos(((time / entity.cycle) + entity.phase) * TAU);
      // 대부분은 형체를 이루고, 주기의 끝자락에 잠시 성운처럼 풀어진다
      const trip = this.voyage(entity, time);
      const o = this.orient(entity, time);
      const scatter = Math.max(trip.dissolve * (.8 + energy * .4), (wave < .62 ? 0 : Math.pow((wave - .62) / .38, 1.6)) * .35);
      // 막 낚은 것은 또렷하게, 오래된 것은 옅게
      if (!entity.dying) entity.fresh = fresh(entity.item);
      const alpha = this.visibility * fade * trip.show * (entity.fresh ?? 1) * (entity.item.kind === "image" ? .7 : .8);
      if (entity.ink) {
        this.drawInk(entity, { time, age, cx, cy, span: span * trip.grow, wave, alpha, energy, beat, step, o, trip });
        continue;
      }
      for (const p of entity.particles) {
        if (age < p.delay) continue;
        if (!entity.dying) {
          // 소용돌이 장(場): 위치에 따라 부드럽게 휘는 흐름
          const fx = Math.sin(p.hy * 7 + time * .0004 + p.seed) + Math.cos(p.hx * 5 - time * .0003);
          const fy = Math.cos(p.hx * 7 - time * .00035 + p.seed) - Math.sin(p.hy * 5 + time * .0005);
          const [rx, ry, k] = this.turn(o, p.hx, p.hy, p.hz);
          p.k = k;
          const sp = span * trip.grow;
          const tx = cx * w + rx * sp + fx * scatter * sp * .5 + Math.sin(time * .0011 + p.seed) * 1.5;
          const ty = cy * h + ry * sp + fy * scatter * sp * .5 + Math.cos(time * .0013 + p.seed) * 1.5;
          const pull = (age - p.delay < 1500 ? .035 : .07) * step;
          const damp = Math.pow(.8, step);
          p.vx = (p.vx + (tx - p.x) * pull) * damp;
          p.vy = (p.vy + (ty - p.y) * pull) * damp;
        } else {
          p.vx *= Math.pow(.97, step); p.vy *= Math.pow(.97, step);
        }
        p.x += p.vx * step; p.y += p.vy * step;
        const twinkle = .55 + .45 * Math.sin(time * .004 + p.seed * 3);
        const near = p.k || 1;
        const a = alpha * twinkle * (1 - scatter * .35) * Math.min(1.3, near);
        const s = p.size * near * (.85 + trip.grow * .2) * (1 + beat * .4) * (this.lite ? 1.3 : 1);
        ctx.fillStyle = p.color;
        if (!this.lite) {
          // 은은한 빛 번짐: 크고 옅은 점을 먼저 깔고
          ctx.globalAlpha = a * .13;
          ctx.fillRect(p.x - s * 2, p.y - s * 2, s * 4, s * 4);
        }
        ctx.globalAlpha = a;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // 물속 잉크: 부드러운 덩어리들이 소용돌이치며 가라앉고 풀어졌다가, 다시 그림으로 모인다
  drawInk(entity, { time, age, cx, cy, span, wave, alpha, energy, beat, step, o, trip }) {
    const { ctx, w, h } = this;
    // 0 = 또렷한 형체, 1 = 물에 다 풀린 잉크. 천천히 번지고 천천히 돌아온다
    const mix = Math.min(1, Math.max(trip.dissolve, (wave < .5 ? 0 : Math.pow((wave - .5) / .5, 1.3)) * .55) * (.8 + energy * .3));
    const tt = time * .00025;
    for (const p of entity.particles) {
      if (age < p.delay) continue;
      if (!entity.dying) {
        // 소용돌이: 가운데에 가까울수록 더 많이 돈다
        const r = Math.hypot(p.hx, p.hy);
        const turn = mix * (1.4 - r * 1.6) * Math.sin(tt * .7 + entity.phase * 6);
        const c = Math.cos(turn), s = Math.sin(turn);
        let hx = p.hx * c - p.hy * s, hy = p.hx * s + p.hy * c;
        // 휘감기는 실 같은 흐름 + 아래로 가라앉음
        hx += mix * (Math.sin(p.hy * 6 + tt * 3 + p.seed * .4) * .16 + Math.sin(p.hy * 15 - tt * 4) * .05);
        hy += mix * (Math.cos(p.hx * 6 - tt * 2.4) * .1 + mix * p.sink * .32);
        const spread = 1 + mix * .35;
        const [rx, ry, k] = this.turn(o, hx, hy, p.hz || 0);
        p.k = k;
        const tx = cx * w + rx * span * spread;
        const ty = cy * h + ry * span * spread;
        const settle = age - p.delay < 2500;
        const pull = (settle ? .012 : .022) * step;
        const damp = Math.pow(.9, step);
        p.vx = (p.vx + (tx - p.x) * pull) * damp;
        p.vy = (p.vy + (ty - p.y) * pull) * damp;
      } else {
        // 놓아주면 아래로 풀어지며 사라진다
        p.vx *= Math.pow(.96, step); p.vy = p.vy * Math.pow(.96, step) + .05 * step;
      }
      p.x += p.vx * step; p.y += p.vy * step;
      // 막 번질 때는 작게, 풀릴수록 크고 옅게
      const grow = Math.min(1, (age - p.delay) / 1800);
      const s = p.size * (p.k || 1) * (.5 + grow * .5) * (1 + mix * 1.4) * (.85 + trip.grow * .2) * (1 + beat * .25);
      const a = alpha * (.34 - mix * .12);
      // 가장자리가 부드럽게 사라지는 물감 방울
      const blob = p.blob || (p.blob = inkBlob(p.color));
      const d = s * 3.2;
      ctx.globalAlpha = a;
      ctx.drawImage(blob, p.x - d / 2, p.y - d / 2, d, d);
      if (!this.lite && mix < .9) {
        // 진한 심: 형체가 있을 때 또렷하게
        ctx.globalAlpha = a * 1.3 * (1 - mix);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - .7, p.y - .7, 1.4, 1.4);
      }
    }
  }

  clear() { this.entities.clear(); }
}
