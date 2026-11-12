// 웹캠으로 관람객 최대 3명의 위치(Pose)와 오른손 쥐기(Hand Landmarker)를 읽는다.
// 카메라 원본은 저장하거나 전송하지 않는다.
// 모델과 wasm은 vendor/ 폴더에 있으면 그것을 쓰고, 없으면 인터넷에서 불러온다.

const version = "0.10.21";
const localLib = new URL("./vendor/mediapipe/", import.meta.url).href;
const remoteLib = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + version + "/";
const models = {
  pose: ["./vendor/models/pose_landmarker_lite.task",
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"],
  hand: ["./vendor/models/hand_landmarker.task",
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"],
};

const ASPECT = 4 / 3;
const TIPS = [8, 12, 16, 20];

async function reachable(url) {
  try { return (await fetch(url, { method: "HEAD" })).ok; } catch { return false; }
}

async function pick([local, remote]) {
  const url = new URL(local, import.meta.url).href;
  return await reachable(url) ? url : remote;
}

function dist(a, b) {
  return Math.hypot((a.x - b.x) * ASPECT, a.y - b.y);
}

// 손가락 끝이 손목에 얼마나 가까운지로 쥔 정도(0 펼침 ~ 1 주먹)를 구한다.
function gripOf(hand) {
  const palm = dist(hand[0], hand[9]) || 1e-3;
  const reach = TIPS.reduce((sum, tip) => sum + dist(hand[tip], hand[0]), 0) / TIPS.length / palm;
  return Math.min(1, Math.max(0, (1.78 - reach) / .7));
}

export class WristCamera {
  constructor(video, onPoses) {
    this.video = video;
    this.onPoses = onPoses;
    this.tracks = Array(3).fill(null);
    this.closed = Array(3).fill(false);
    this.mode = "pose";
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error("카메라는 HTTPS 또는 이 PC의 로컬 주소에서 켤 수 있어요.");
      error.name = "SecurityError";
      throw error;
    }
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = this.stream;
    try {
      await this.video.play();
      if (!this.poseModel) {
        try { await this.load(); } catch (error) {
          const wrapped = new Error("인식 모델을 불러오지 못했어요: " + (error?.message || error));
          wrapped.name = "ModelLoadError";
          throw wrapped;
        }
      }
      this.lastFrame = -1;
      this.lastTime = 0;
      this.frame = requestAnimationFrame(time => this.scan(time));
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  async load() {
    const lib = await reachable(localLib + "vision_bundle.mjs") ? localLib : remoteLib;
    const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import(lib + "vision_bundle.mjs");
    const files = await FilesetResolver.forVisionTasks(lib + "wasm");
    const [poseUrl, handUrl] = await Promise.all([pick(models.pose), pick(models.hand)]);
    const make = async (Task, url, extra) => {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          return await Task.createFromOptions(files, { baseOptions: { modelAssetPath: url, delegate }, runningMode: "VIDEO", ...extra });
        } catch (error) { if (delegate === "CPU") throw error; }
      }
    };
    this.poseModel = await make(PoseLandmarker, poseUrl, { numPoses: 3 });
    try {
      this.handModel = await make(HandLandmarker, handUrl, { numHands: 6, minHandDetectionConfidence: .45, minTrackingConfidence: .4 });
      this.mode = "hand";
    } catch {
      this.handModel = null; // 손 모델이 없으면 머무르기 방식으로 낚는다.
    }
  }

  stop() {
    cancelAnimationFrame(this.frame);
    for (const track of this.stream?.getTracks() || []) track.stop();
    this.stream = null;
    this.video.srcObject = null;
    this.tracks.fill(null);
    this.closed.fill(false);
  }

  scan(time) {
    if (!this.stream) return;
    if (time - this.lastTime >= 40 && this.video.readyState >= 2 && this.video.currentTime !== this.lastFrame) {
      this.lastTime = time;
      this.lastFrame = this.video.currentTime;
      try {
        const { landmarks } = this.poseModel.detectForVideo(this.video, time);
        const hands = this.handModel ? this.handModel.detectForVideo(this.video, time).landmarks : [];
        this.onPoses(this.match(landmarks, hands, time));
      } catch (error) {
        this.stop();
        this.onPoses(null, error);
        return;
      }
    }
    this.frame = requestAnimationFrame(next => this.scan(next));
  }

  match(poses, hands, time) {
    const usedHands = new Set();
    const candidates = poses.flatMap(pose => {
      const [left, right, wrist, leftWrist] = [pose[11], pose[12], pose[16], pose[15]];
      if (!left || !right || Math.min(left.visibility ?? 1, right.visibility ?? 1) < .35) return [];
      // 오른손목에 가장 가까운 손을 그 사람의 오른손으로 본다.
      let hand = null;
      if (wrist && hands.length) {
        let best = .16;
        hands.forEach((h, index) => {
          if (usedHands.has(index)) return;
          const d = dist(h[0], wrist);
          const other = leftWrist ? dist(h[0], leftWrist) : 9;
          if (d < best && d < other) { best = d; hand = index; }
        });
        if (hand !== null) usedHands.add(hand);
      }
      // 왼손목에 가장 가까운 손은 지우개 손으로 쓴다.
      let leftHand = null;
      if (leftWrist && (leftWrist.visibility ?? 1) >= .4 && hands.length) {
        let best = .16;
        hands.forEach((h, index) => {
          if (usedHands.has(index)) return;
          const d = dist(h[0], leftWrist);
          const other = wrist ? dist(h[0], wrist) : 9;
          if (d < best && d < other) { best = d; leftHand = index; }
        });
        if (leftHand !== null) usedHands.add(leftHand);
      }
      const h = hand === null ? null : hands[hand];
      const l = leftHand === null ? null : hands[leftHand];
      return [{
        x: 1 - (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
        span: Math.max(.04, dist(left, right)),
        shoulder: [1 - right.x, right.y],
        wrist: wrist && (wrist.visibility ?? 1) >= .45 ? [1 - wrist.x, wrist.y] : null,
        palm: h ? [1 - (h[0].x + h[9].x) / 2, (h[0].y + h[9].y) / 2] : null,
        grip: h ? gripOf(h) : null,
        leftShoulder: [1 - left.x, left.y],
        leftPalm: l ? [1 - (l[0].x + l[9].x) / 2, (l[0].y + l[9].y) / 2] : null,
        leftGrip: l ? gripOf(l) : null,
      }];
    }).sort((a, b) => a.x - b.x);

    const available = new Set(candidates);
    const result = Array(3).fill(null);
    this.tracks = this.tracks.map((previous, index) => {
      if (!previous || time - previous.seen > 1500) return null;
      const distance = item => Math.hypot(item.x - previous.x, item.y - previous.y);
      const nearest = [...available].sort((a, b) => distance(a) - distance(b))[0];
      if (!nearest || distance(nearest) > .23) return previous;
      available.delete(nearest);
      result[index] = nearest;
      return { ...nearest, seen: time };
    });
    for (const item of available) {
      const index = this.tracks.indexOf(null);
      if (index < 0) break;
      this.tracks[index] = { ...item, seen: time };
      result[index] = item;
    }
    // 쥐기 판정에 히스테리시스를 둬서 손이 떨려도 한 번만 잡히게 한다.
    result.forEach((pose, index) => {
      if (!pose || pose.grip === null) { if (!pose) this.closed[index] = false; return; }
      if (this.closed[index] && pose.grip < .35) this.closed[index] = false;
      else if (!this.closed[index] && pose.grip > .62) this.closed[index] = true;
      pose.closed = this.closed[index];
    });
    return result;
  }
}
