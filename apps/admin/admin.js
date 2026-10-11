const get = id => document.getElementById(id);
const loginPanel = get("login-panel");
const editorPanel = get("editor-panel");
const feedback = get("feedback");

function inform(text, error = false) {
  feedback.textContent = text;
  feedback.classList.toggle("error", error);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store"
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

function localInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = v => String(v).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

async function loadEditor() {
  const { event } = await request("/api/event");
  if (!event) return;
  for (const field of ["churchName", "title", "youtubeUrl", "status", "description"]) {
    get(field).value = event[field] || "";
  }
  get("scheduledStartAt").value = localInput(event.scheduledStartAt);
}

async function initialize() {
  try {
    const session = await request("/api/admin/session");
    loginPanel.hidden = session.authenticated;
    editorPanel.hidden = !session.authenticated;
    if (!session.configured) {
      loginPanel.hidden = false;
      inform("Admin is not configured. Set EKKO_ADMIN_PASSWORD and EKKO_SESSION_SECRET on the server.", true);
    }
    if (session.authenticated) await loadEditor();
  } catch (error) {
    inform(error.message, true);
  }
}

get("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  inform("");
  try {
    await request("/api/admin/login", {
      method: "POST", body: JSON.stringify({ password: get("password").value })
    });
    get("password").value = "";
    await initialize();
  } catch (error) {
    inform(error.message, true);
  }
});

get("event-form").addEventListener("submit", async event => {
  event.preventDefault();
  const saveButton = get("save-button");
  saveButton.disabled = true;
  inform("Saving broadcast...");
  try {
    const time = get("scheduledStartAt").value;
    const payload = {
      churchName: get("churchName").value,
      title: get("title").value,
      youtubeUrl: get("youtubeUrl").value,
      status: get("status").value,
      scheduledStartAt: time ? new Date(time).toISOString() : "",
      description: get("description").value
    };
    await request("/api/admin/event", { method: "PUT", body: JSON.stringify(payload) });
    inform("Broadcast saved. Your public EKKO page is updated.");
  } catch (error) {
    inform(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
});

get("logout-button").addEventListener("click", async () => {
  try {
    await request("/api/admin/logout", { method: "POST" });
    inform("Signed out.");
    await initialize();
  } catch (error) {
    inform(error.message, true);
  }
});

initialize();
