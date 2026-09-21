const $ = (id) => document.getElementById(id);

/* ---------- Sidebar ---------- */
const sidebar = $("sidebar");
const sidebarOverlay = $("sidebarOverlay");

$("menuBtn").addEventListener("click", () => {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
});
function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
}
$("closeSidebar").addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message) {
  $("toastText").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}

/* ---------- Auth modal + Login/Sign-up toggle ---------- */
const authModal = $("authModal");
const authTabs = document.querySelectorAll(".auth-tab");

function openAuth(mode = "login") {
  authModal.classList.add("show");
  setAuthMode(mode);
}
function closeAuth() {
  authModal.classList.remove("show");
}

$("openAuthBtn").addEventListener("click", () => openAuth("login"));
$("sidebarLogin").addEventListener("click", () => {
  closeSidebar();
  openAuth("login");
});
$("closeAuth").addEventListener("click", closeAuth);

authModal.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuth();
});

function setAuthMode(mode) {
  authTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.auth === mode));
  const signup = mode === "signup";

  $("authHeading").textContent = signup ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = signup
    ? "Create a case-file account and save your investigations."
    : "Login to continue your investigations.";
  $("authSubmit").textContent = signup ? "Create Account" : "Login";
  $("nameField").classList.toggle("hidden", !signup);
  $("confirmField").classList.toggle("hidden", !signup);
  $("loginOptions").classList.toggle("hidden", signup);
}
authTabs.forEach(tab => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.auth));
});

$("authForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const signup = document.querySelector(".auth-tab.active").dataset.auth === "signup";
  showToast(signup ? "Account created — demo mode." : "Login successful — demo mode.");
  closeAuth();
});

/* ---------- Investigation ---------- */
const input = $("claimInput");
const resultSection = $("resultSection");

input.addEventListener("input", () => {
  $("clearSearch").classList.toggle("show", input.value.trim().length > 0);
});
$("clearSearch").addEventListener("click", () => {
  input.value = "";
  $("clearSearch").classList.remove("show");
  input.focus();
});

function classifyClaim(text) {
  const value = text.toLowerCase();

  // Frontend demo logic only — replace with your ML/API later.
  const fakeWords = ["miracle", "shocking", "100% proven", "secret cure", "you won't believe", "breaking"];
  const realWords = ["official", "government", "report", "study", "research", "published"];

  const fakeHits = fakeWords.filter(word => value.includes(word)).length;
  const realHits = realWords.filter(word => value.includes(word)).length;

  if (fakeHits > realHits) {
    return {
      label: "FAKE",
      confidence: Math.min(94, 76 + fakeHits * 5),
      title: "Suspicious signals detected",
      signal: "The text contains patterns commonly associated with sensational or unsupported claims.",
      action: "Verify the original publisher and look for independent primary sources."
    };
  }

  if (realHits > fakeHits) {
    return {
      label: "REAL",
      confidence: Math.min(91, 72 + realHits * 5),
      title: "Signals appear consistent",
      signal: "The claim contains source-oriented language, but a frontend check cannot establish truth by itself.",
      action: "Confirm the information against the original report or primary source."
    };
  }

  return {
    label: "UNCERTAIN",
    confidence: 68,
    title: "More evidence is needed",
    signal: "The available text does not provide enough evidence for a confident classification.",
    action: "Cross-reference multiple credible sources before sharing."
  };
}

function investigate(value = input.value.trim()) {
  if (!value) {
    showToast("Enter a claim or URL first.");
    input.focus();
    return;
  }

  const result = classifyClaim(value);

  $("resultTitle").textContent = result.title;
  $("resultBadge").textContent = result.label;
  $("resultBadge").className = "result-badge " + result.label.toLowerCase();
  $("confidenceText").textContent = result.confidence + "%";
  $("confidenceBar").style.width = result.confidence + "%";
  $("signalText").textContent = result.signal;
  $("actionText").textContent = result.action;

  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "center" });

  if (localStorage.getItem("autoClear") === "true") {
    setTimeout(() => {
      input.value = "";
      $("clearSearch").classList.remove("show");
    }, 600);
  }
}

$("investigateBtn").addEventListener("click", () => investigate());
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") investigate();
});

/* ---------- Upload image ---------- */
$("uploadBtn").addEventListener("click", () => $("imageInput").click());

$("imageInput").addEventListener("change", () => {
  const file = $("imageInput").files[0];
  if (!file) return;

  input.value = `Image selected: ${file.name}`;
  $("clearSearch").classList.add("show");
  showToast("Image loaded. Starting media investigation...");

  setTimeout(() => {
    $("resultTitle").textContent = "Image analysis ready";
    $("resultBadge").textContent = "UNCERTAIN";
    $("resultBadge").className = "result-badge";
    $("confidenceText").textContent = "64%";
    $("confidenceBar").style.width = "64%";
    $("signalText").textContent = "The image has been loaded for forensic analysis.";
    $("actionText").textContent = "Connect your image-forensics backend here for actual manipulation detection.";
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 700);
});

/* ---------- Four method cards ---------- */
document.querySelectorAll(".method-card").forEach(card => {
  card.addEventListener("click", async (e) => {
    if (e.target.closest(".card-action")) e.preventDefault();

    const method = card.dataset.method;

    if (method === "image") {
      $("imageInput").click();
      return;
    }

    if (method === "share") {
      const shareData = {
        title: "Fake News Detector",
        text: "Check this claim with the Fake News Detector.",
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          showToast("Share sheet opened.");
        } catch (_) {}
      } else {
        await navigator.clipboard?.writeText(window.location.href);
        showToast("Link copied — share it anywhere.");
      }
      return;
    }

    input.focus();
    if (method === "link") input.placeholder = "Paste the article URL here...";
    if (method === "search") input.placeholder = "Type the claim you want to investigate...";
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

/* ---------- Settings ---------- */
const settingsPanel = $("settingsPanel");

document.querySelector('[data-section="settings"]').addEventListener("click", () => {
  closeSidebar();
  settingsPanel.classList.add("open");
});
$("closeSettings").addEventListener("click", () => settingsPanel.classList.remove("open"));

const motionToggle = $("motionToggle");
const confidenceToggle = $("confidenceToggle");
const autoClearToggle = $("autoClearToggle");

motionToggle.checked = localStorage.getItem("reducedMotion") === "true";
confidenceToggle.checked = localStorage.getItem("showConfidence") !== "false";
autoClearToggle.checked = localStorage.getItem("autoClear") === "true";

function applySettings() {
  document.body.classList.toggle("no-motion", motionToggle.checked);
  document.querySelector(".confidence").style.display =
    confidenceToggle.checked ? "" : "none";
}
applySettings();

motionToggle.addEventListener("change", () => {
  localStorage.setItem("reducedMotion", motionToggle.checked);
  applySettings();
});
confidenceToggle.addEventListener("change", () => {
  localStorage.setItem("showConfidence", confidenceToggle.checked);
  applySettings();
});
autoClearToggle.addEventListener("change", () => {
  localStorage.setItem("autoClear", autoClearToggle.checked);
});

/* ---------- Sidebar demo navigation ---------- */
document.querySelectorAll(".side-link[data-section]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-link[data-section]")
      .forEach(x => x.classList.remove("active"));
    btn.classList.add("active");

    const section = btn.dataset.section;
    closeSidebar();

    if (section === "dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (section === "history") {
      showToast("History panel is ready to connect to your backend/database.");
    }
  });
});

$("logoutBtn").addEventListener("click", () => {
  closeSidebar();
  showToast("Logged out — connect this action to your authentication API.");
});

$("homeLink").addEventListener("click", (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
