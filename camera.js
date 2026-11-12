const version = "0.10.21";
const cdn = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + version;
const model = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export class WristCamera {
  constructor(video, onPoses) {
    this.video = video;
    this.onPoses = onPoses;
    this.tracks = Array(3).fill(null);
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("카메라는 HTTPS 또는 이 PC의 로컬 주소에서 켤 수 있어요.");
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = this.stream;
    try {
      await this.video.play();
      if (!this.landmarker) {
        const { FilesetResolver, PoseLandmarker } = await import(cdn + "/vision_bundle.mjs");
        const files = await FilesetResolver.forVisionTasks(cdn + "/wasm");
        this.landmarker = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: model },
          runningMode: "VIDEO",
          numPoses: 3,
        });
      }
      this.lastFrame = -1;
      this.lastTime = 0;
      this.frame = requestAnimationFrame(time => this.scan(time));
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop() {
    cancelAnimationFrame(this.frame);
    for (const track of this.stream?.getTracks() || []) track.stop();
    this.stream = null;
    this.video.srcObject = null;
    this.tracks.fill(null);
  }

  scan(time) {
    if (!this.stream) return;
    if (time - this.lastTime >= 54 && this.video.readyState >= 2 && this.video.currentTime !== this.lastFrame) {
      this.lastTime = time;
      this.lastFrame = this.video.currentTime;
      try {
        const { landmarks } = this.landmarker.detectForVideo(this.video, time);
        this.onPoses(this.match(landmarks, time));
      } catch (error) {
        this.stop();
        this.onPoses(null, error);
        return;
      }
    }
    this.frame = requestAnimationFrame(next => this.scan(next));
  }

  match(poses, time) {
    const candidates = poses.flatMap(pose => {
      const [left, right, wrist] = [pose[11], pose[12], pose[16]];
      if (!left || !right || !wrist || Math.min(left.visibility ?? 1, right.visibility ?? 1) < .35) return [];
      return [{
        x: 1 - (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
        wrist: (wrist.visibility ?? 1) >= .48 ? [1 - wrist.x, wrist.y] : null,
      }];
    }).sort((a, b) => a.x - b.x);

    const available = new Set(candidates);
    const result = Array(3).fill(null);
    this.tracks = this.tracks.map((previous, index) => {
      if (!previous || time - previous.seen > 1200) return null;
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
    return result;
  }
}
