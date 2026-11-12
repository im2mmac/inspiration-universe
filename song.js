// QR로 들어온 휴대폰에서, 주소에 담긴 영감 목록으로 같은 합주를 다시 만들어 내려받는다.
import { UniverseAudio } from "./audio-engine.js";
import { catalog } from "./items.js";

const colors = ["#ff7a68", "#ffd45e", "#6daeff"];
const byId = id => document.getElementById(id);

const items = decodeURIComponent(location.hash.slice(1)).split("-").map((part, slot) => {
  if (!part) return null;
  const [seed, player] = part.split(".");
  const base = catalog[parseInt(seed, 36)];
  return base ? { ...base, player: Number(player) || 0, slot, id: slot + 1 } : null;
}).filter(Boolean);

const people = new Set(items.map(item => item.player)).size;
byId("who").textContent = items.length
  ? people + "명이 함께 낚은 영감 " + items.length + "개로 만든 음악이에요."
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
  cell.title = item.name;
  return cell;
}));

byId("make").disabled = !items.length;
byId("make").addEventListener("click", async () => {
  const button = byId("make");
  button.disabled = true;
  byId("status").textContent = "음악을 만들고 있어요. 잠시만 기다려 주세요.";
  try {
    const blob = await new UniverseAudio().render(items);
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
  }
});
