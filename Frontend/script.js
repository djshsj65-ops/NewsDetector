/* =========================================================
   BASIC HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   DOM REFERENCES
========================================================= */

const sidebar = $("sidebar");
const sidebarOverlay = $("sidebarOverlay");

const input = $("claimInput");
const clearSearch = $("clearSearch");

const resultSection = $("resultSection");
const resultTitle = $("resultTitle");
const resultBadge = $("resultBadge");
const signalText = $("signalText");
const actionText = $("actionText");

const authModal = $("authModal");
const authSwitchLink = $("authSwitchLink");

const notificationToggle = $("notificationToggle");
const darkToggle = $("darkToggle");

const settingsPanel = $("settingsPanel");
const settingsActionBackdrop = $("settingsActionBackdrop");
const settingsActionTitle = $("settingsActionTitle");
const settingsActionSubtitle = $("settingsActionSubtitle");
const settingsActionContent = $("settingsActionContent");

let toastTimer;
let pendingHistory = false; /* open history right after login */


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

  const toast = $("toast");
  const toastText = $("toastText");

  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);

}


/* =========================================================
   AUTH STATE (avatar + login / logout visibility)
========================================================= */

function isLoggedIn() {
  return localStorage.getItem("fncDemoLoggedIn") === "true";
}


function getProfile() {

  try {
    return JSON.parse(localStorage.getItem("fncProfile") || "{}");
  } catch {
    return {};
  }

}


function updateAuthUI() {

  const loggedIn = isLoggedIn();
  const profile = getProfile();

  const source = (profile.name || profile.email || "U").trim();

  $("avatarLetter").textContent = source.charAt(0).toUpperCase() || "U";
  $("avatarBtn").title = profile.name || profile.email || "Account";

  /* navbar */
  $("openAuthBtn").classList.toggle("hidden", loggedIn);
  $("avatarBtn").classList.toggle("hidden", !loggedIn);

  /* sidebar */
  $("sidebarLogin").classList.toggle("hidden", loggedIn);
  $("sidebarBottom").classList.toggle("hidden", !loggedIn);

}


$("avatarBtn").addEventListener("click", () => {
  settingsPanel.classList.add("open");
});


/* =========================================================
   DARK MODE
========================================================= */

function applyTheme(dark) {

  document.body.classList.toggle("dark", dark);

  darkToggle.checked = dark;

  $("themeBtn").innerHTML = dark
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';

  localStorage.setItem("fncDark", dark ? "true" : "false");

}


darkToggle.addEventListener("change", () => {
  applyTheme(darkToggle.checked);
});


$("themeBtn").addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
});


/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
}


function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
}


$("menuBtn").addEventListener("click", openSidebar);
$("closeSidebar").addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);


/* =========================================================
   AUTH MODAL
========================================================= */

function openAuth(mode = "login") {

  authModal.classList.add("show");
  document.body.classList.add("modal-open");

  setAuthMode(mode);

}


function closeAuth() {

  authModal.classList.remove("show");
  document.body.classList.remove("modal-open");

}


$("openAuthBtn").addEventListener("click", () => openAuth("login"));


$("sidebarLogin").addEventListener("click", () => {
  closeSidebar();
  openAuth("login");
});


$("closeAuth").addEventListener("click", () => {
  pendingHistory = false;
  closeAuth();
});


authModal.addEventListener("click", (event) => {

  if (event.target === authModal) {
    pendingHistory = false;
    closeAuth();
  }

});


/* =========================================================
   LOGIN / SIGNUP
========================================================= */

function setAuthMode(mode) {

  const signup = mode === "signup";

  $("authHeading").textContent = signup ? "Create account" : "Welcome back";

  $("authSubtitle").textContent = signup
    ? "Create your case file and start tracking investigations."
    : "Login to continue your investigations.";

  $("authSubmit").textContent = signup ? "Create Account" : "Login";

  $("nameField").classList.toggle("hidden", !signup);
  $("confirmField").classList.toggle("hidden", !signup);
  $("loginOptions").classList.toggle("hidden", signup);

  if (signup) {

    $("switchPrompt").textContent = "Already have an account?";
    authSwitchLink.textContent = "Log in";
    authSwitchLink.dataset.auth = "login";

  } else {

    $("switchPrompt").textContent = "Need an account?";
    authSwitchLink.textContent = "Create one";
    authSwitchLink.dataset.auth = "signup";

  }

}


authSwitchLink.addEventListener("click", () => {
  setAuthMode(authSwitchLink.dataset.auth);
});


/* =========================================================
   AUTH FORM
========================================================= */

$("authForm").addEventListener("submit", (event) => {

  event.preventDefault();

  const signup = $("authSubmit").textContent === "Create Account";

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  if (!email || !password) {
    showToast("Please fill in all required fields.");
    return;
  }

  if (signup) {

    const name = $("authName").value.trim();
    const confirmPassword = $("authConfirmPassword").value;

    if (!name) {
      showToast("Please enter your name.");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.");
      return;
    }

    localStorage.setItem("fncProfile", JSON.stringify({ name, email }));
    localStorage.setItem("fncDemoLoggedIn", "true");

    showToast("Account created successfully.");

  } else {

    const oldProfile = getProfile();

    localStorage.setItem(
      "fncProfile",
      JSON.stringify({
        name: oldProfile.name || "",
        email
      })
    );

    localStorage.setItem("fncDemoLoggedIn", "true");

    showToast("Login successful.");

  }

  $("authForm").reset();

  updateAuthUI();
  closeAuth();

  /* user tried to open history before login */
  if (pendingHistory) {
    pendingHistory = false;
    showHistory();
  }

});


/* =========================================================
   FORGOT PASSWORD
========================================================= */

$("forgotPasswordBtn").addEventListener("click", () => {
  showToast("Password recovery will be connected to the authentication backend later.");
});


/* =========================================================
   INPUT CLEAR
========================================================= */

function updateClearButton() {
  clearSearch.classList.toggle("show", input.value.trim().length > 0);
}


input.addEventListener("input", updateClearButton);


clearSearch.addEventListener("click", () => {
  input.value = "";
  updateClearButton();
  input.focus();
});


/* =========================================================
   HISTORY STORAGE
========================================================= */

function getHistory() {

  try {
    return JSON.parse(localStorage.getItem("fncHistory") || "[]");
  } catch {
    return [];
  }

}


function saveHistory(text, prediction) {

  const history = getHistory();

  history.unshift({
    text,
    prediction,
    date: new Date().toLocaleString()
  });

  localStorage.setItem("fncHistory", JSON.stringify(history.slice(0, 30)));

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

  return String(value).replace(/[&<>'"]/g, (char) => {

    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char];

  });

}


/* =========================================================
   REAL ML ANALYSIS
========================================================= */

const resultPopup = $("resultPopup");
const resultChecks = $("resultChecks");
const resultIconI = $("resultIconI");
const articleDetails = $("articleDetails");
const resultSources = $("resultSources");


function openResult() {
  resultSection.classList.add("show");
  resultSection.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}


function closeResult() {
  resultSection.classList.remove("show");
  resultSection.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}


$("closeResult").addEventListener("click", closeResult);

resultSection.addEventListener("click", (event) => {
  if (event.target === resultSection) closeResult();
});


function renderChecks(items) {

  resultChecks.innerHTML = items.map((item) => `
    <li class="${item.ok ? "ok" : "warn"}">
      <span class="check-icon"><i class="fa-solid ${item.icon}"></i></span>
      <span>${escapeHTML(item.text)}</span>
      <i class="fa-solid ${item.ok ? "fa-check" : "fa-triangle-exclamation"} check-mark"></i>
    </li>
  `).join("");

}


function buildSourceLinks(query) {
  const searchText = query.trim().slice(0, 200);
  const factCheckUrl = new URL("https://www.google.com/search");
  const sourceSearchUrl = new URL("https://www.google.com/search");

  factCheckUrl.searchParams.set("q", `${searchText} fact check`);
  sourceSearchUrl.searchParams.set("q", searchText);
  $("factCheckLink").href = factCheckUrl.href;
  $("independentSourcesLink").href = sourceSearchUrl.href;
  resultSources.classList.remove("hidden");
}


function resetResultExtras() {
  articleDetails.classList.add("hidden");
  resultSources.classList.add("hidden");
}


function setResult({ state, icon, title, subtitle, badge, action, checks }) {

  resultPopup.className = "result-popup" + (state ? " " + state : "");
  resultIconI.className = "fa-solid " + icon;

  resultTitle.textContent = title;
  signalText.textContent = subtitle;
  actionText.textContent = action;

  resultBadge.textContent = badge;
  resultBadge.className = "result-badge" + (state ? " " + state : "");

  renderChecks(checks || []);

}


function normalizeArticleUrl(value) {
  const candidate = value.trim();

  if (/^https?:\/\//i.test(candidate)) return candidate;

  const bareDomain = /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i;
  return bareDomain.test(candidate) ? `https://${candidate}` : null;
}


async function investigate(value = input.value.trim()) {

  if (!value) {
    showToast("Enter news text first.");
    input.focus();
    return;
  }

  const articleUrl = normalizeArticleUrl(value);
  const isUrl = articleUrl !== null;
  const analysisInput = articleUrl || value;
  resetResultExtras();

  setResult({
    state: "",
    icon: "fa-spinner fa-spin",
    title: "Analyzing...",
    subtitle: isUrl
      ? "Fetching article text from the supplied URL."
      : "Sending the news text to the Python ML backend.",
    badge: "ANALYZING",
    action: "Please wait while the trained model processes the input.",
    checks: []
  });

  openResult();

  input.value = "";
  updateClearButton();

  try {

    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: analysisInput, is_url: isUrl })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The Flask server returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "The ML backend returned an error.");
    }

    if (isUrl) {
      if (!data.article || typeof data.article.title !== "string" || typeof data.article.publisher !== "string" || typeof data.article.preview !== "string" || typeof data.article.url !== "string") {
        throw new Error("The backend did not return article details.");
      }

      $("articleTitle").textContent = data.article.title;
      $("articlePublisher").textContent = data.article.publisher;
      $("articleSourceLink").href = data.article.url;
      $("articlePreview").textContent = data.article.preview;
      articleDetails.classList.remove("hidden");
      buildSourceLinks(data.article.title || data.article.preview || value);
    } else {
      buildSourceLinks(value);
    }

    const prediction = data.prediction;

    if (prediction !== true && prediction !== false) {
      throw new Error("Prediction was not returned correctly by the backend.");
    }

    if (typeof data.uncertain !== "boolean") {
      throw new Error("Uncertainty status was not returned correctly by the backend.");
    }

    const words = Number(data.word_count) || analysisInput.split(/\s+/).filter(Boolean).length;

    const wordsCheck = {
      ok: true,
      icon: "fa-file-lines",
      text: `${words} words analyzed`
    };

    const resultLabel = data.uncertain ? "UNCERTAIN" : prediction ? "LIKELY REAL" : "LIKELY FAKE";

    if (data.uncertain) {
      setResult({
        state: "uncertain",
        icon: "fa-circle-question",
        title: "UNCERTAIN",
        subtitle: isUrl
          ? "The article text did not produce a strong enough signal for a likely label."
          : "The model did not find a strong enough signal for a likely label.",
        badge: "UNCERTAIN",
        action: "The model signal was not strong enough to choose TRUE or FAKE. Cross-check the claim with reliable sources.",
        checks: [
          { ok: false, icon: "fa-circle-question", text: "The model could not confidently choose TRUE or FAKE" },
          wordsCheck,
          { ok: false, icon: "fa-link", text: "Verify with independent, trusted sources" }
        ]
      });

      saveHistory(analysisInput, resultLabel);
      return;
    }


    if (prediction === true) {

      setResult({
        state: "real",
        icon: "fa-shield-halved",
        title: "LIKELY REAL",
        subtitle: isUrl
          ? "The linked article text leans toward TRUE in the ML model."
          : "The model leans toward TRUE; this is not independent fact verification.",
        badge: "LIKELY REAL",
        action: "The model result is not independent fact verification. Cross-check important claims with reliable sources.",
        checks: [
          { ok: true, icon: "fa-check", text: "The model leans toward TRUE" },
          { ok: true, icon: "fa-language", text: isUrl ? "Article text extracted from the supplied URL" : "Writing patterns match the TRUE class in the training data" },
          wordsCheck,
          { ok: false, icon: "fa-link", text: "Verify with a trusted source before sharing" }
        ]
      });

    } else {

      setResult({
        state: "fake",
        icon: "fa-triangle-exclamation",
        title: "LIKELY FAKE",
        subtitle: isUrl
          ? "The linked article text leans toward FAKE in the ML model."
          : "The model leans toward FAKE; this is not independent fact verification.",
        badge: "LIKELY FAKE",
        action: "Check the original publisher and compare the claim with reliable independent sources before sharing.",
        checks: [
          { ok: false, icon: "fa-circle-exclamation", text: "The model leans toward FAKE" },
          { ok: false, icon: "fa-language", text: isUrl ? "Article text extracted from the supplied URL" : "Writing patterns match the FAKE class in the training data" },
          wordsCheck,
          { ok: false, icon: "fa-link", text: "Do not share before checking the source" }
        ]
      });

    }

    saveHistory(
      analysisInput,
      resultLabel
    );

  } catch (error) {

    console.error("ML connection error:", error);
    resetResultExtras();

    if (!input.value) {
      input.value = value;
      updateClearButton();
    }

    const connectionFailed = error instanceof TypeError && error.message === "Failed to fetch";

    setResult({
      state: "fake",
      icon: "fa-circle-exclamation",
      title: "ERROR",
      subtitle: connectionFailed
        ? "The Flask API could not be reached."
        : error.message || "Unable to connect to the Python backend.",
      badge: "ERROR",
      action: connectionFailed
        ? "Start Flask with: py app.py, then open the app at http://127.0.0.1:5000/app/."
        : "Make sure Flask is running with: py app.py",
      checks: []
    });

  }

}


/* =========================================================
   INVESTIGATE BUTTON
========================================================= */

$("investigateBtn").addEventListener("click", () => investigate());


input.addEventListener("keydown", (event) => {

  if (event.key === "Enter") {
    event.preventDefault();
    investigate();
  }

});


/* =========================================================
   METHOD CARDS
========================================================= */

document.querySelectorAll(".method-card").forEach((card) => {

  card.addEventListener("click", async () => {

    const method = card.dataset.method;

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
        } catch {
          /* User cancelled share. */
        }

      } else {

        try {
          await navigator.clipboard.writeText(window.location.href);
          showToast("Link copied. Share it anywhere.");
        } catch {
          showToast("Share is not available in this browser.");
        }

      }

      return;

    }

    input.focus();

    if (method === "link") {

      input.placeholder = "Paste the article URL here...";

      showToast("Paste an article URL above, then select Investigate.");

    }

    if (method === "search") {
      input.placeholder = "Type the claim or paste news text here...";
    }

    input.scrollIntoView({ behavior: "smooth", block: "center" });

  });

});


/* =========================================================
   SETTINGS PANEL
========================================================= */

document.querySelector('[data-section="settings"]').addEventListener("click", () => {
  closeSidebar();
  settingsPanel.classList.add("open");
});


$("closeSettings").addEventListener("click", () => {
  settingsPanel.classList.remove("open");
});


/* =========================================================
   SETTINGS ACTION MODAL
========================================================= */

function openSettingsAction(title, subtitle, contentHTML) {

  settingsActionTitle.textContent = title;
  settingsActionSubtitle.textContent = subtitle;
  settingsActionContent.innerHTML = contentHTML;

  settingsActionBackdrop.classList.add("show");
  settingsActionBackdrop.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

}


function closeSettingsAction() {

  settingsActionBackdrop.classList.remove("show");
  settingsActionBackdrop.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

}


$("closeSettingsAction").addEventListener("click", closeSettingsAction);


settingsActionBackdrop.addEventListener("click", (event) => {

  if (event.target === settingsActionBackdrop) {
    closeSettingsAction();
  }

});


/* =========================================================
   MANAGE ACCOUNT
========================================================= */

function openAccountSettings() {

  const profile = getProfile();

  openSettingsAction(

    "Manage account",

    "Update your local profile information.",

    `
      <form class="settings-form" id="accountSettingsForm">

        <label class="field">
          <span>Full name</span>
          <div>
            <i class="fa-regular fa-user"></i>
            <input id="profileName" type="text" value="${escapeHTML(profile.name || "")}" placeholder="Your name" />
          </div>
        </label>

        <label class="field">
          <span>Email</span>
          <div>
            <i class="fa-regular fa-envelope"></i>
            <input id="profileEmail" type="email" value="${escapeHTML(profile.email || "")}" placeholder="you@example.com" />
          </div>
        </label>

        <button class="auth-submit settings-save-btn" type="submit">Save profile</button>

      </form>
    `

  );

  $("accountSettingsForm").addEventListener("submit", (event) => {

    event.preventDefault();

    const profileData = {
      name: $("profileName").value.trim(),
      email: $("profileEmail").value.trim()
    };

    if (!profileData.name) {
      showToast("Please enter your name.");
      return;
    }

    if (!profileData.email) {
      showToast("Please enter your email.");
      return;
    }

    localStorage.setItem("fncProfile", JSON.stringify(profileData));

    updateAuthUI();

    showToast("Profile saved locally.");

    closeSettingsAction();

  });

}


/* =========================================================
   MANAGE PASSWORD
========================================================= */

function openPasswordSettings() {

  openSettingsAction(

    "Manage password",

    "Update your password settings.",

    `
      <form class="settings-form" id="passwordSettingsForm">

        <label class="field">
          <span>Current password</span>
          <div>
            <i class="fa-solid fa-lock"></i>
            <input type="password" id="currentPassword" placeholder="Current password" required />
          </div>
        </label>

        <label class="field">
          <span>New password</span>
          <div>
            <i class="fa-solid fa-lock"></i>
            <input type="password" id="newPassword" placeholder="New password" required />
          </div>
        </label>

        <label class="field">
          <span>Confirm new password</span>
          <div>
            <i class="fa-solid fa-shield-halved"></i>
            <input type="password" id="confirmNewPassword" placeholder="Repeat new password" required />
          </div>
        </label>

        <button class="auth-submit settings-save-btn" type="submit">Update password</button>

        <p class="settings-modal-note">
          This is currently a frontend demo screen.
          Secure password authentication will be handled
          by the authentication backend later.
        </p>

      </form>
    `

  );

  $("passwordSettingsForm").addEventListener("submit", (event) => {

    event.preventDefault();

    const currentPassword = $("currentPassword").value;
    const newPassword = $("newPassword").value;
    const confirmPassword = $("confirmNewPassword").value;

    if (!currentPassword) {
      showToast("Enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.");
      return;
    }

    localStorage.setItem("fncPasswordUpdated", "true");

    showToast("Password settings updated locally.");

    closeSettingsAction();

  });

}


/* =========================================================
   LANGUAGE
========================================================= */

const translations = {

  English: {

    navHome: "Home",
    navAbout: "About",
    signIn: "Sign In",

    dashboard: "Dashboard",
    history: "History",
    settings: "Settings",
    login: "Login",
    logout: "Logout",

    heroTitle: "Don't Just Read It.",

    heroDescription:
      "Check a claim, article or URL and uncover signals that help you decide whether the information looks Real, Fake or Uncertain.",

    investigate: "Investigate",

    quickAuthorship: "Check Authorship",
    quickArticles: "Check articles",
    quickSources: "Cross-Reference Sources",
    aiDisclaimer: "AI can make mistakes. Verify important claims with trusted sources.",
    publisher: "Publisher",
    articlePreview: "Extracted text preview",
    openArticle: "Open original article",
    sourceLinks: "Look up this claim",
    factChecks: "Search fact checks",
    independentSources: "Search independent sources",

    methodsTitle: "Choose your evidence.",

    methodsDescription:
      "Each route starts a different type of verification workflow. Click a card to use it.",

    linkTitle: "Check by Link",
    linkDescription: "Paste an article or website URL and inspect its source signals.",
    linkAction: "Start link check",

    searchTitle: "Search a Claim",
    searchDescription: "Enter a statement and compare it against your verification workflow.",
    searchAction: "Search claim",

    shareTitle: "Check by Sharing",
    shareDescription: "Share a claim into the detector workflow from your device.",
    shareAction: "Share to check"

  },


  Hindi: {

    navHome: "होम",
    navAbout: "अबाउट",
    signIn: "साइन इन",

    dashboard: "डैशबोर्ड",
    history: "हिस्ट्री",
    settings: "सेटिंग्स",
    login: "लॉगिन",
    logout: "लॉगआउट",

    heroTitle: "सिर्फ पढ़ें नहीं।",

    heroDescription:
      "किसी दावे, आर्टिकल या URL को चेक करें और ऐसे संकेत देखें जो जानकारी को Real, Fake या Uncertain समझने में मदद करें।",

    investigate: "जांच करें",

    quickAuthorship: "ऑथरशिप चेक करें",
    quickArticles: "आर्टिकल जांचें",
    quickSources: "सोर्स क्रॉस-चेक करें",
    aiDisclaimer: "AI गलतियाँ कर सकता है। ज़रूरी दावों की विश्वसनीय स्रोतों से पुष्टि करें।",
    publisher: "प्रकाशक",
    articlePreview: "निकाला गया टेक्स्ट",
    openArticle: "मूल आर्टिकल खोलें",
    sourceLinks: "इस दावे की और जानकारी देखें",
    factChecks: "फैक्ट-चेक खोजें",
    independentSources: "स्वतंत्र स्रोत खोजें",

    methodsTitle: "अपने सबूत चुनें।",

    methodsDescription:
      "हर विकल्प एक अलग verification workflow शुरू करता है। इस्तेमाल करने के लिए कार्ड पर क्लिक करें।",

    linkTitle: "लिंक से चेक करें",
    linkDescription: "आर्टिकल या वेबसाइट URL डालकर उसके source signals देखें।",
    linkAction: "लिंक चेक करें",

    searchTitle: "दावा सर्च करें",
    searchDescription: "किसी statement को डालकर verification workflow में जांचें।",
    searchAction: "दावा सर्च करें",

    shareTitle: "शेयर करके चेक करें",
    shareDescription: "अपने device से किसी claim को detector workflow में शेयर करें।",
    shareAction: "शेयर करके चेक करें"

  }

};


function applyLanguage(language) {

  const t = translations[language] || translations.English;

  $("navHome").textContent = t.navHome;
  $("navAbout").textContent = t.navAbout;
  $("signInText").textContent = t.signIn;

  $("dashboardText").textContent = t.dashboard;
  $("historyText").textContent = t.history;
  $("settingsText").textContent = t.settings;
  $("loginText").textContent = t.login;
  $("logoutText").textContent = t.logout;

  $("heroDescription").textContent = t.heroDescription;

  $("investigateText").textContent = t.investigate;

  $("quickAuthorship").textContent = t.quickAuthorship;
  $("quickArticles").textContent = t.quickArticles;
  $("quickSources").textContent = t.quickSources;
  $("aiDisclaimer").textContent = t.aiDisclaimer;
  $("publisherLabel").textContent = t.publisher;
  $("articlePreviewLabel").textContent = t.articlePreview;
  $("articleSourceLink").textContent = t.openArticle;
  $("sourceLinksLabel").textContent = t.sourceLinks;
  $("factCheckLink").textContent = t.factChecks;
  $("independentSourcesLink").textContent = t.independentSources;

  $("methodsTitle").textContent = t.methodsTitle;
  $("methodsDescription").textContent = t.methodsDescription;

  $("linkTitle").textContent = t.linkTitle;
  $("linkDescription").textContent = t.linkDescription;
  $("linkAction").textContent = t.linkAction;

  $("searchTitle").textContent = t.searchTitle;
  $("searchDescription").textContent = t.searchDescription;
  $("searchAction").textContent = t.searchAction;

  $("shareTitle").textContent = t.shareTitle;
  $("shareDescription").textContent = t.shareDescription;
  $("shareAction").textContent = t.shareAction;

  $("languageSettingText").textContent = language;

  document.documentElement.lang = language === "Hindi" ? "hi" : "en";

}


function openLanguageSettings() {

  const savedLanguage = localStorage.getItem("fncLanguage") || "English";

  openSettingsAction(

    "Language",

    "Choose your preferred interface language.",

    `
      <div class="language-options">

        <label class="language-option">
          <input type="radio" name="language" value="English" ${savedLanguage === "English" ? "checked" : ""} />
          <span>English</span>
        </label>

        <label class="language-option">
          <input type="radio" name="language" value="Hindi" ${savedLanguage === "Hindi" ? "checked" : ""} />
          <span>Hindi</span>
        </label>

      </div>

      <button type="button" class="auth-submit settings-save-btn" id="saveLanguage">
        Save language
      </button>
    `

  );

  $("saveLanguage").addEventListener("click", () => {

    const choice =
      document.querySelector('input[name="language"]:checked')?.value || "English";

    localStorage.setItem("fncLanguage", choice);

    applyLanguage(choice);

    showToast(`Language set to ${choice}.`);

    closeSettingsAction();

  });

}


/* =========================================================
   HISTORY RENDER
========================================================= */

function renderHistory() {

  const history = getHistory();

  if (!history.length) {

    return `
      <div class="empty-history">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <p>No investigations saved yet.</p>
        <small>Run a news analysis and it will appear here.</small>
      </div>
    `;

  }

  return `
    <div class="history-list">

      ${history.map((item) => {

    const isReal = item.prediction === "TRUE" || item.prediction === "LIKELY REAL";
    const isFake = item.prediction === "FAKE" || item.prediction === "LIKELY FAKE";
    const className = isReal ? "real" : isFake ? "fake" : "uncertain";

    return `
          <div class="history-entry">

            <div class="history-entry-top">
              <span class="history-chip ${className}">${escapeHTML(item.prediction)}</span>
              <small>${escapeHTML(item.date)}</small>
            </div>

            <p>${escapeHTML(item.text)}</p>

          </div>
        `;

  }).join("")}

    </div>
  `;

}

/* =========================================================
   HISTORY (login required)
========================================================= */

function showHistory() {

  openSettingsAction(

    "Investigation history",

    "Your latest ML checks are stored locally in this browser.",

    `
      ${renderHistory()}

      <button type="button" class="settings-secondary-btn" id="clearHistoryBtn">
        <i class="fa-solid fa-trash"></i>
        Clear history
      </button>
    `

  );

  $("clearHistoryBtn").addEventListener("click", () => {

    localStorage.removeItem("fncHistory");

    showToast("History cleared.");

    showHistory();

  });

}


function openHistorySettings() {

  if (!isLoggedIn()) {

    pendingHistory = true;

    settingsPanel.classList.remove("open");

    showToast("Please log in to access your history.");

    openAuth("login");

    return;

  }

  showHistory();

}


/* =========================================================
   SETTINGS BUTTONS
========================================================= */

document.querySelectorAll(".setting-action").forEach((button) => {

  button.addEventListener("click", () => {

    const action = button.dataset.settingAction;

    if (action === "account") {
      openAccountSettings();
      return;
    }

    if (action === "password") {
      openPasswordSettings();
      return;
    }

    if (action === "language") {
      openLanguageSettings();
      return;
    }

    if (action === "history") {
      openHistorySettings();
      return;
    }

  });

});


/* =========================================================
   NOTIFICATIONS
========================================================= */

const savedNotifications = localStorage.getItem("fncNotifications");

if (savedNotifications !== null) {
  notificationToggle.checked = savedNotifications === "true";
}


notificationToggle.addEventListener("change", () => {

  const enabled = notificationToggle.checked;

  localStorage.setItem("fncNotifications", enabled ? "true" : "false");

  showToast(enabled ? "Notifications enabled." : "Notifications disabled.");

});


/* =========================================================
   SIDEBAR SECTIONS
========================================================= */

document.querySelectorAll(".side-link[data-section]").forEach((button) => {

  button.addEventListener("click", () => {

    document.querySelectorAll(".side-link[data-section]").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    const section = button.dataset.section;

    if (section === "dashboard") {

      closeSidebar();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;

    }

    if (section === "history") {

      closeSidebar();
      openHistorySettings();
      return;

    }

  });

});


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener("click", () => {

  localStorage.removeItem("fncDemoLoggedIn");

  closeSidebar();
  settingsPanel.classList.remove("open");

  updateAuthUI();

  showToast("Logged out successfully.");

});


/* =========================================================
   HOME LINK
========================================================= */

$("homeLink").addEventListener("click", (event) => {

  event.preventDefault();

  closeSidebar();

  window.scrollTo({ top: 0, behavior: "smooth" });

});


/* =========================================================
   QUICK TOOLS
========================================================= */

document.querySelectorAll(".quick-tools > span").forEach((tool) => {

  tool.addEventListener("click", () => {
    showToast("This investigation route will be connected in the next backend stage.");
  });

});


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener("keydown", (event) => {

  if (event.key === "Escape") {

    pendingHistory = false;

    closeSidebar();
    closeAuth();
    closeResult();
    closeSettingsAction();

    settingsPanel.classList.remove("open");

  }

});


/* =========================================================
   STARTUP
========================================================= */

localStorage.removeItem("fncBackground");

const startupLanguage = localStorage.getItem("fncLanguage") || "English";

applyLanguage(startupLanguage);

const savedDark = localStorage.getItem("fncDark");

applyTheme(
  savedDark !== null
    ? savedDark === "true"
    : window.matchMedia("(prefers-color-scheme: dark)").matches
);

updateAuthUI();
updateClearButton();