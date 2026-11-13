// QR로 들어온 휴대폰에서, 주소에 담긴 영감 목록으로 같은 합주를 다시 만들어 내려받는다.
import { UniverseAudio, arrangementName, layerFromCode, layerLabel } from "./audio-engine.js";
import { catalog } from "./items.js";

const colors = ["#ff7a68", "#ffd45e", "#6daeff"];
const byId = id => document.getElementById(id);

const hash = location.hash.slice(1);
// v3.<곡>~<영감.관람객.악기>-… (v2와 예전 주소도 열 수 있게 둔다. 악기는 다시 정해진다)
const versioned = /^v([23])\.([0-9a-z]{1,5})~(.*)$/.exec(hash);
const take = versioned && versioned[1] === "3" ? parseInt(versioned[2], 36) : 1;
const items = (versioned?.[3] ?? hash).split("-").slice(0, 15).map((part, slot) => {
  const match = /^([0-9a-z]{1,2})\.([0-2])(?:\.([0-9a-z]{0,2}e?))?$/.exec(part);
  if (!match) return null;
  const [, seed, player, code] = match;
  const base = catalog[parseInt(seed, 36)];
  return base ? { ...base, player: Number(player) || 0, slot, id: slot + 1, layer: layerFromCode(code) || undefined } : null;
}).filter(Boolean);

const people = new Set(items.map(item => item.player)).size;
byId("who").textContent = items.length
  ? people + "명이 함께 낚은 영감 " + items.length + "개 · " + arrangementName(take)
  : "음악 정보가 없어요. 전시장의 QR을 다시 찍어 주세요.";

byId("grid").replaceChildren(...items.map(item => {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.style.setProperty("--p", colors[item.player] || colors[0]);
  if (item.kind === "image") {
    const image = new Image();
    image.src = "./assets/" + item.image + ".webp";
    image.alt = item.name;
    cell.append(image);
  } else cell.textContent = item.name;
  cell.title = item.name + (item.layer ? " · " + layerLabel(item.layer) : "");
  return cell;
}));

byId("make").disabled = !items.length;
byId("make").addEventListener("click", async () => {
  const button = byId("make");
  button.disabled = true;
  byId("status").textContent = "음악을 만들고 있어요. 잠시만 기다려 주세요.";
  const engine = new UniverseAudio({ take });
  try {
    const blob = await engine.render(items);
    const url = URL.createObjectURL(blob);
    byId("player").src = url;
    byId("download").href = url;
    byId("result").hidden = false;
    button.hidden = true;
    byId("status").textContent = "재생해 보고 저장하세요.";
    byId("player").play().catch(() => {});
  } catch {
    byId("status").textContent = "음악을 만들지 못했어요. 다시 눌러 주세요.";
    button.disabled = false;
  } finally {
    void engine.close().catch(() => {});
  }
});
