const byId = id => document.getElementById(id);
const title = byId("event-title");
const description = byId("event-description");
const playerHost = byId("player-host");
const badge = byId("video-badge");
const chip = byId("status-chip");
const program = byId("program-title");
const church = byId("church-name");
const schedule = byId("schedule");
const youtubeLink = byId("youtube-link");
let previousVersion = undefined;
let lastPlayerId = null;
let currentEvent = null;

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return null;
  }
}

function message(heading, body) {
  lastPlayerId = null;
  const wrapper = document.createElement("div");
  wrapper.className = "stage-message";
  const symbol = document.createElement("div");
  symbol.className = "stage-symbol";
  symbol.textContent = "✦";
  const h2 = document.createElement("h2");
  h2.textContent = heading;
  const p = document.createElement("p");
  p.textContent = body;
  wrapper.append(symbol, h2, p);
  playerHost.replaceChildren(wrapper);
}

function showLive(videoId) {
  if (lastPlayerId === videoId) return;
  const iframe = document.createElement("iframe");
  iframe.title = "YouTube Live broadcast";
  iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + "?playsinline=1&rel=0";
  iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.loading = "eager";
  playerHost.replaceChildren(iframe);
  lastPlayerId = videoId;
}

function render(event) {
  currentEvent = event;
  if (!event) {
    title.textContent = "Faith, together. Wherever you are.";
    description.textContent = "A place to gather and experience church live.";
    program.textContent = "Your place to watch, together.";
    church.textContent = "EKKO · Built for every church";
    chip.textContent = "AWAITING BROADCAST";
    schedule.textContent = "";
    badge.hidden = true;
    youtubeLink.hidden = true;
    message("Welcome to EKKO", "Our next broadcast will appear here.");
    return;
  }
  title.textContent = event.title;
  description.textContent = event.description || "Come together and be part of this worship moment.";
  program.textContent = event.title;
  church.textContent = event.churchName;
  const when = formatDate(event.scheduledStartAt);
  schedule.textContent = when ? "Scheduled · " + when : "";
  const live = event.status === "live";
  badge.hidden = !live;
  chip.textContent = live ? "ON AIR NOW" : event.status === "ended" ? "BROADCAST ENDED" : "UPCOMING BROADCAST";
  chip.classList.toggle("live", live);
  youtubeLink.hidden = !live;
  youtubeLink.href = event.youtubeUrl;
  if (live && /^[A-Za-z0-9_-]{11}$/.test(event.youtubeVideoId)) {
    showLive(event.youtubeVideoId);
  } else if (event.status === "ended") {
    message("Thank you for joining us", "This broadcast has ended. See you at the next gathering.");
  } else {
    message("We're gathering soon", when ? "Live broadcast scheduled for " + when : "Our next live event will begin here.");
  }
}

async function refresh() {
  try {
    const response = await fetch("/api/event", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load the broadcast.");
    const payload = await response.json();
    const version = payload.event ? payload.event.updatedAt : "empty";
    if (version !== previousVersion) {
      previousVersion = version;
      render(payload.event);
    }
  } catch {
    if (previousVersion === undefined) {
      chip.textContent = "CONNECTION UNAVAILABLE";
      message("Unable to load EKKO", "Please check your connection and try again.");
    }
  }
}

byId("share-button").addEventListener("click", async () => {
  const url = window.location.href;
  try {
    if (navigator.share) await navigator.share({ title: currentEvent?.title || "EKKO", url });
    else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      notify("Broadcast link copied");
    } else notify("Share this page: " + url);
  } catch (error) {
    if (error.name !== "AbortError") notify("Couldn't share the broadcast.");
  }
});

let toastTimer;
function notify(text) {
  const toast = byId("toast");
  toast.textContent = text;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
}

refresh();
setInterval(refresh, 20000);
