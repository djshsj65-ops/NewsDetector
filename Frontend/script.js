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
const confidenceCard = $("confidenceCard");
const confidenceValue = $("confidenceValue");
const confidenceTrack = $("confidenceTrack");
const confidenceBar = $("confidenceBar");
const signalText = $("signalText");
const actionText = $("actionText");
const newsEvidence = $("newsEvidence");
const evidenceStatus = $("evidenceStatus");
const evidenceList = $("evidenceList");

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
  $("openAuthBtn").classList.toggle("hidden", loggedIn);
  $("avatarBtn").classList.toggle("hidden", !loggedIn);
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

$("closeAuth").addEventListener("click", closeAuth);

authModal.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuth();
});


function setAuthMode(mode) {
  const signup = mode === "signup";

  $("authHeading").textContent = signup ? "Create Account" : "Sign In";
  $("authSubtitle").textContent = signup
    ? "Create a profile in this browser."
    : "Sign in using this browser.";
  $("authSubmit").textContent = signup ? "Create Account" : "Login";
  $("authSubmit").dataset.mode = signup ? "signup" : "login";
  $("nameField").classList.toggle("hidden", !signup);
  $("confirmField").classList.toggle("hidden", !signup);
  $("loginOptions").classList.toggle("hidden", signup);

  $("switchPrompt").textContent = signup ? "Already have an account?" : "Need an account?";
  authSwitchLink.textContent = signup ? "Sign In" : "Create one";
  authSwitchLink.dataset.auth = signup ? "login" : "signup";
}


authSwitchLink.addEventListener("click", () => {
  setAuthMode(authSwitchLink.dataset.auth);
});


$("authForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const signup = $("authSubmit").dataset.mode === "signup";
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
  } else {
    const oldProfile = getProfile();
    localStorage.setItem("fncProfile", JSON.stringify({ name: oldProfile.name || "", email }));
  }

  localStorage.setItem("fncDemoLoggedIn", "true");
  $("authForm").reset();
  updateAuthUI();
  closeAuth();
  showToast(signup ? "Account profile created in this browser." : "Signed in.");
});


$("forgotPasswordBtn").addEventListener("click", () => {
  showToast("Password recovery is not available.");
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

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
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
  resultSection.classList.remove("hidden");
  resultSection.classList.add("show");
  resultSection.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}


function closeResult() {
  resultSection.classList.remove("show");
  resultSection.classList.add("hidden");
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
  const sourceSearchUrl = new URL("https://news.google.com/search");

  factCheckUrl.searchParams.set("q", `${searchText} fact check`);
  sourceSearchUrl.searchParams.set("q", searchText);
  $("factCheckLink").href = factCheckUrl.href;
  $("independentSourcesLink").href = sourceSearchUrl.href;
  resultSources.classList.remove("hidden");
}


function checkListedAuthor() {
  const articleUrl = normalizeArticleUrl(input.value.trim());

  if (!articleUrl) {
    showToast("Paste an article URL to check its listed author.");
    input.focus();
    return;
  }

  investigate(articleUrl);
}


function crossReferenceSources() {
  const value = input.value.trim();

  if (!value) {
    showToast("Enter a claim or article URL to search for other coverage.");
    input.focus();
    return;
  }

  const query = normalizeArticleUrl(value) || value;
  resetResultExtras();
  setResult({
    state: "",
    icon: "fa-link",
    title: "Compare source coverage",
    subtitle: "Search for fact checks and other news coverage of this claim.",
    badge: "SOURCE SEARCH",
    action: "Search results are leads, not proof. Compare dates, evidence, and the original sources yourself.",
    checks: [
      { ok: true, icon: "fa-magnifying-glass", text: "Fact-check search prepared" },
      { ok: true, icon: "fa-newspaper", text: "News coverage search prepared" }
    ]
  });
  buildSourceLinks(query);
  openResult();
}


function resetResultExtras() {
  confidenceCard.classList.add("hidden");
  articleDetails.classList.add("hidden");
  resultSources.classList.add("hidden");
  newsEvidence.classList.add("hidden");
  evidenceList.innerHTML = "";
}

function renderNewsEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return;

  evidenceStatus.textContent = evidence.message || "Related news articles are unavailable.";
  const articles = Array.isArray(evidence.articles) ? evidence.articles : [];

  evidenceList.innerHTML = articles
    .map((article) => {
      const safeUrl = safeHttpUrl(article.url);
      if (!safeUrl) return "";

      const description = article.description
        ? `<p>${escapeHTML(article.description)}</p>`
        : "";
      const date = article.published_at
        ? `<small>${escapeHTML(article.published_at)}</small>`
        : "";

      return `
        <li>
          <a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(article.title || "Untitled article")}
          </a>
          <span>${escapeHTML(article.publisher || "Unknown publisher")} ${date}</span>
          ${description}
        </li>
      `;
    })
    .join("");

  newsEvidence.classList.remove("hidden");
}


function setResult({
  state,
  icon,
  title,
  subtitle,
  badge,
  action,
 checks,
 confidence = null
}) {
 resultPopup.className = "result-popup" + (state ? " " + state : "");
  resultIconI.className = "fa-solid " + icon;

  resultTitle.textContent = title;
  signalText.textContent = subtitle;
  actionText.textContent = action;

  resultBadge.textContent = badge;
  resultBadge.className = "result-badge" + (state ? " " + state : "");

  setConfidence(confidence);

  renderChecks(checks || []);
}


function setConfidence(confidence) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    confidenceCard.classList.add("hidden");
    return;
  }

  const percentage = Math.round(confidence * 100);
  confidenceValue.textContent = `${percentage}%`;
  confidenceBar.style.width = `${percentage}%`;
  confidenceTrack.setAttribute("aria-valuenow", String(percentage));
  confidenceCard.classList.remove("hidden");
}


function normalizeArticleUrl(value) {
  const candidate = value.trim();

  if (/^https?:\/\//i.test(candidate)) return candidate;

  const bareDomain = /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i;
  return bareDomain.test(candidate) ? `https://${candidate}` : null;
}


async function investigate(value = input.value.trim()) {

  if (!value) {
    showToast("Enter a claim or article URL first.");
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
    title: "Checking...",
    subtitle: isUrl
      ? "Reading the article from this URL."
      : "Checking the claim text.",
    badge: "CHECKING",
    action: "One moment...",
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

    if (!Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1) {
      throw new Error("The backend returned an invalid confidence score.");
    }

    renderNewsEvidence(data.evidence);

    let authorCheck = null;
    if (isUrl) {
      const article = data.article;
      const hasArticleDetails =
        article &&
        typeof article.title === "string" &&
        typeof article.publisher === "string" &&
        typeof article.preview === "string" &&
        typeof article.url === "string";

      if (!hasArticleDetails) {
        throw new Error("The backend did not return article details.");
      }

      const listedAuthor =
        typeof article.author === "string" ? article.author.trim() : "";
      authorCheck = {
        ok: Boolean(listedAuthor),
        icon: "fa-user",
        text: listedAuthor ? "Listed author found in article metadata" : "No listed author metadata found"
      };
      $("articleAuthor").textContent = listedAuthor || "No author metadata found";
      $("articleTitle").textContent = article.title;
      $("articlePublisher").textContent = article.publisher;
      $("articleSourceLink").href = article.url;
      $("articlePreview").textContent = article.preview;
      articleDetails.classList.remove("hidden");
      buildSourceLinks(article.title || article.preview || value);
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
        confidence: data.confidence,
        checks: [
          { ok: false, icon: "fa-circle-question", text: "The model could not confidently choose TRUE or FAKE" },
          wordsCheck,
          ...(authorCheck ? [authorCheck] : []),
          { ok: false, icon: "fa-link", text: "Verify with independent, trusted sources" }
        ]
      });

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
        confidence: data.confidence,
        checks: [
          { ok: true, icon: "fa-check", text: "The model leans toward TRUE" },
          { ok: true, icon: "fa-language", text: isUrl ? "Article text extracted from the supplied URL" : "Writing patterns match the TRUE class in the training data" },
          wordsCheck,
          ...(authorCheck ? [authorCheck] : []),
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
        confidence: data.confidence,
        checks: [
          { ok: false, icon: "fa-circle-exclamation", text: "The model leans toward FAKE" },
          { ok: false, icon: "fa-language", text: isUrl ? "Article text extracted from the supplied URL" : "Writing patterns match the FAKE class in the training data" },
          wordsCheck,
          ...(authorCheck ? [authorCheck] : []),
          { ok: false, icon: "fa-link", text: "Do not share before checking the source" }
        ]
      });

    }

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
      action: "Make sure Flask is running with: py app.py",
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
        text: "Take a look at the Fake News Detector website.",
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

    quickAuthorship: "Find listed author",
    quickArticles: "Check articles",
    quickSources: "Cross-Reference Sources",
    aiDisclaimer: "AI can make mistakes. Verify important claims with trusted sources.",
    publisher: "Publisher",
    authorLabel: "Listed author",
    articlePreview: "Extracted text preview",
    openArticle: "Open original article",
    sourceLinks: "Look up this claim",
    factChecks: "Search fact checks",
    independentSources: "Search news coverage",
    authorLabel: "Listed author",

    methodsTitle: "What do you want to check?",

    methodsDescription:
      "Choose a link, claim, or sharing option.",

    linkTitle: "Check by Link",
    linkDescription: "Paste an article or website URL and inspect its source signals.",
    linkAction: "Start link check",

    searchTitle: "Search a Claim",
    searchDescription: "Enter a statement and compare it against your verification workflow.",
    searchAction: "Search claim",

    shareTitle: "Share this website",
    shareDescription: "Send a link to this website to someone.",
    shareAction: "Share link"

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

    quickAuthorship: "लेख में लेखक देखें",
    quickArticles: "आर्टिकल जांचें",
    quickSources: "सोर्स क्रॉस-चेक करें",
    aiDisclaimer: "AI गलतियाँ कर सकता है। ज़रूरी दावों की विश्वसनीय स्रोतों से पुष्टि करें।",
    publisher: "प्रकाशक",
    authorLabel: "सूचीबद्ध लेखक",
    articlePreview: "निकाला गया टेक्स्ट",
    openArticle: "मूल आर्टिकल खोलें",
    sourceLinks: "इस दावे की और जानकारी देखें",
    factChecks: "फैक्ट-चेक खोजें",
    independentSources: "खबरों में खोजें",
    authorLabel: "लेख में दिया लेखक",

    methodsTitle: "आप क्या जांचना चाहते हैं?",

    methodsDescription:
      "लिंक, दावा या शेयर करने का विकल्प चुनें।",

    linkTitle: "लिंक से चेक करें",
    linkDescription: "आर्टिकल या वेबसाइट URL डालकर उसके source signals देखें।",
    linkAction: "लिंक चेक करें",

    searchTitle: "दावा सर्च करें",
    searchDescription: "किसी statement को डालकर verification workflow में जांचें।",
    searchAction: "दावा सर्च करें",

    shareTitle: "वेबसाइट शेयर करें",
    shareDescription: "किसी को इस वेबसाइट का लिंक भेजें।",
    shareAction: "लिंक शेयर करें"

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
  $("authorLabel").textContent = t.authorLabel;
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

function renderHistory(history) {

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
    const evidenceLinks = (Array.isArray(item.evidence) ? item.evidence : [])
      .map((article) => {
        const url = safeHttpUrl(article.url);
        if (!url) return "";
        return `<li><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(article.title || "Related article")}</a> — ${escapeHTML(article.publisher || "Unknown publisher")}</li>`;
      })
      .join("");

    return `
          <div class="history-entry">

            <div class="history-entry-top">
              <span class="history-chip ${className}">${escapeHTML(item.prediction)}</span>
              <small>${escapeHTML(item.date)}</small>
            </div>

            <p>${escapeHTML(item.text)}</p>
            ${evidenceLinks ? `<ul class="history-evidence">${evidenceLinks}</ul>` : ""}

          </div>
        `;

  }).join("")}

    </div>
  `;

}

/* =========================================================
   INVESTIGATION HISTORY
========================================================= */

async function showHistory() {

  openSettingsAction(

    "Investigation history",

    "Stored in the local SQLite database on this server; records are shared with other users of this local app.",

    `
      <p>Loading investigation history...</p>
    `

  );

  try {
    const response = await fetch("/history");
    const history = await response.json();

    if (!response.ok) {
      throw new Error(history.error || "Could not load investigation history.");
    }

    settingsActionContent.innerHTML = `
      ${renderHistory(history)}
      <button type="button" class="settings-secondary-btn" id="clearHistoryBtn">
        <i class="fa-solid fa-trash"></i>
        Clear history
      </button>
    `;

    $("clearHistoryBtn").addEventListener("click", async () => {
      try {
        const clearResponse = await fetch("/history", { method: "DELETE" });
        const clearResult = await clearResponse.json();

        if (!clearResponse.ok) {
          throw new Error(clearResult.error || "Could not clear investigation history.");
        }

        showToast("History cleared.");
        showHistory();
      } catch (error) {
        showToast(error.message || "Could not clear investigation history.");
      }
    });
  } catch (error) {
    settingsActionContent.innerHTML = `<p>${escapeHTML(error.message || "Could not load investigation history.")}</p>`;
  }

}


function openHistorySettings() {
  showHistory();
}


/* =========================================================
   SETTINGS BUTTONS
========================================================= */

document.querySelectorAll(".setting-action").forEach((button) => {

  button.addEventListener("click", () => {

    const action = button.dataset.settingAction;

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


$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("fncDemoLoggedIn");
  closeSidebar();
  settingsPanel.classList.remove("open");
  updateAuthUI();
  showToast("Logged out.");
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

document.querySelectorAll(".quick-tools [data-tool]").forEach((tool) => {
  tool.addEventListener("click", () => {
    if (tool.dataset.tool === "article") {
      checkListedAuthor();
    } else if (tool.dataset.tool === "sources") {
      crossReferenceSources();
    } else {
      investigate();
    }
  });
});


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener("keydown", (event) => {

  if (event.key === "Escape") {

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