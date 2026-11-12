export const cueOptions = {
  catch: { title: "낚기", sounds: ["물방울", "나무 조각", "하프 손끝", "조약돌", "작은 종"] },
  layer: { title: "레이어 합류", sounds: ["겹친 줄", "공기의 결", "둥근 울림", "풀잎", "유리결"] },
  release: { title: "놓아주기", sounds: ["멀어지는 물결", "숨 내쉬기", "마른 잎", "가라앉는 줄", "긴 여운"] },
};

const key = "inspiration-universe-cues-v1";

export function preferences() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  return Object.fromEntries(Object.keys(cueOptions).map(kind => {
    const value = saved?.[kind];
    return [kind, Number.isInteger(value) && value >= 0 && value <= 4 ? value : 0];
  }));
}

export function setPreference(kind, value) {
  if (!Object.hasOwn(cueOptions, kind) || !Number.isInteger(value) || value < 0 || value > 4) return;
  try { localStorage.setItem(key, JSON.stringify({ ...preferences(), [kind]: value })); } catch {}
}

export function cueUrl(kind, value) {
  return new URL("./assets/fx/" + kind + "-" + (value + 1) + ".wav", import.meta.url);
}
