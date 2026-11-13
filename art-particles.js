// 영감의 성운: 낚은 영감이 별가루가 되어 우주 배경에 떠 있는다.
// - 이미지 영감은 그림의 실제 색을 머금은 입자로, 글자 영감은 글자 모양의 입자로 만든다.
// - 형체를 이뤘다가 성운처럼 흩어지기를 천천히 되풀이하고, 박자와 음량에 숨을 쉰다.
// - 낚으면 수집 칸에서 별가루가 솟아올라 모이고, 놓아주면 흩어져 사라진다.

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
  sync(items, { origin, colors, tints }) {
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
        player: hexRgb(colors[item.player] || "#ffffff"), tint: hexRgb(tints[item.role] || "#ffffff"),
        origin: origin(item),
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
    entity.particles = points.map(point => {
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
      return {
        hx: point[0], hy: point[1],
        x: ox * this.w + (Math.random() - .5) * 40, y: oy * this.h + (Math.random() - .5) * 20,
        vx: 0, vy: 0,
        delay: Math.random() * 900,
        seed: Math.random() * TAU,
        size: 1.1 + Math.random() * (word ? 1.8 : 2.2),
        color: `rgb(${r},${g},${b})`,
      };
    });
  }

  // 영감 자리: 화면 위쪽에 황금각으로 흩어 두고, 전체가 아주 천천히 돈다
  place(item, time) {
    const angle = item.slot * 2.39996 + item.seed * .07 + time * .000012;
    const radius = .19 + (item.seed % 4) * .045;
    return [.5 + radius * Math.cos(angle), .36 + radius * .62 * Math.sin(angle)];
  }

  draw(time, { energy = 0, beat = 0, state = "active" } = {}) {
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
      const scatter = (wave < .62 ? 0 : Math.pow((wave - .62) / .38, 1.6)) * (.5 + energy * .35);
      const alpha = this.visibility * fade * (entity.item.kind === "image" ? .62 : .72);
      for (const p of entity.particles) {
        if (age < p.delay) continue;
        if (!entity.dying) {
          // 소용돌이 장(場): 위치에 따라 부드럽게 휘는 흐름
          const fx = Math.sin(p.hy * 7 + time * .0004 + p.seed) + Math.cos(p.hx * 5 - time * .0003);
          const fy = Math.cos(p.hx * 7 - time * .00035 + p.seed) - Math.sin(p.hy * 5 + time * .0005);
          const tx = cx * w + p.hx * span + fx * scatter * span * .45 + Math.sin(time * .0011 + p.seed) * 1.5;
          const ty = cy * h + p.hy * span + fy * scatter * span * .45 + Math.cos(time * .0013 + p.seed) * 1.5;
          const pull = (age - p.delay < 1500 ? .035 : .07) * step;
          const damp = Math.pow(.8, step);
          p.vx = (p.vx + (tx - p.x) * pull) * damp;
          p.vy = (p.vy + (ty - p.y) * pull) * damp;
        } else {
          p.vx *= Math.pow(.97, step); p.vy *= Math.pow(.97, step);
        }
        p.x += p.vx * step; p.y += p.vy * step;
        const twinkle = .55 + .45 * Math.sin(time * .004 + p.seed * 3);
        const a = alpha * twinkle * (1 - scatter * .35);
        const s = p.size * (1 + beat * .4) * (this.lite ? 1.3 : 1);
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

  clear() { this.entities.clear(); }
}
