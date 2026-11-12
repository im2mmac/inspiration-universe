import { cueOptions, cueUrl, preferences, setPreference } from "../sound-options.js";

const host = document.querySelector("#cue-controls");
const tracks = [...document.querySelectorAll("audio")];
const audition = new Audio();
const selected = preferences();

function stopTracks() {
  for (const track of tracks) track.pause();
}

for (const track of tracks) {
  track.addEventListener("play", () => {
    audition.pause();
    for (const other of tracks) if (other !== track) other.pause();
  });
}

for (const [kind, option] of Object.entries(cueOptions)) {
  const row = document.createElement("div");
  row.className = "cue-row";
  const label = document.createElement("label");
  label.textContent = option.title;
  const select = document.createElement("select");
  select.id = "cue-" + kind;
  label.htmlFor = select.id;
  option.sounds.forEach((name, index) => select.add(new Option(name, index)));
  select.value = selected[kind];

  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "듣기";
  play.setAttribute("aria-label", option.title + " 효과음 듣기");
  const download = document.createElement("a");
  download.textContent = "저장";
  download.download = "";
  const update = () => {
    download.href = cueUrl(kind, Number(select.value)).href;
  };
  update();

  select.addEventListener("change", () => {
    setPreference(kind, Number(select.value));
    update();
    document.querySelector("#cue-status").textContent = option.title + " 소리를 " + select.selectedOptions[0].text + "으로 선택했어요.";
  });
  play.addEventListener("click", async () => {
    stopTracks();
    audition.src = download.href;
    try { await audition.play(); } catch {
      document.querySelector("#cue-status").textContent = "효과음을 재생할 수 없어요. 저장 링크로도 들을 수 있어요.";
    }
  });
  row.append(label, select, play, download);
  host.append(row);
}
