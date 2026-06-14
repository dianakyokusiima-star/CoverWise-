// State
let currentImageBase64 = null;
let currentImageUrl = null;
let currentResult = null;
let currentMeta = {};

// DOM
const views = {
  upload: document.getElementById("uploadView"),
  loading: document.getElementById("loadingView"),
  results: document.getElementById("resultsView"),
  history: document.getElementById("historyView"),
  share: document.getElementById("shareView")
};

// Utility: show a view
function showView(name) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  views[name].classList.add("active");
}

// Toast
function toast(msg, duration = 2500) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), duration);
}

// --- UPLOAD VIEW ---

const fileInput = document.getElementById("fileInput");
const uploadZone = document.getElementById("uploadZone");
const previewWrap = document.getElementById("previewWrap");
const previewImg = document.getElementById("previewImg");
const analyzeBtn = document.getElementById("analyzeBtn");

document.getElementById("chooseFileBtn").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

// Drag and drop
uploadZone.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.classList.add("dragging");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragging"));
uploadZone.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.classList.remove("dragging");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    previewImg.src = dataUrl;
    previewWrap.classList.remove("hidden");
    // Extract base64 (remove data:image/...;base64, prefix)
    const parts = dataUrl.split(",");
    currentImageBase64 = parts[1];
    currentImageUrl = null;
    analyzeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

document.getElementById("clearBtn").addEventListener("click", () => {
  currentImageBase64 = null;
  currentImageUrl = null;
  previewWrap.classList.add("hidden");
  previewImg.src = "";
  fileInput.value = "";
  analyzeBtn.disabled = true;
});

// URL analyze
document.getElementById("urlAnalyzeBtn").addEventListener("click", () => {
  const url = document.getElementById("imageUrl").value.trim();
  if (!url) return toast("Paste an image URL first");
  loadImageFromUrl(url);
});

document.getElementById("imageUrl").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("urlAnalyzeBtn").click();
});

function loadImageFromUrl(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      previewImg.src = dataUrl;
      previewWrap.classList.remove("hidden");
      currentImageBase64 = dataUrl.split(",")[1];
      currentImageUrl = url;
      analyzeBtn.disabled = false;
    } catch {
      // CORS fallback — send URL directly
      previewImg.src = url;
      previewWrap.classList.remove("hidden");
      currentImageUrl = url;
      currentImageBase64 = null;
      analyzeBtn.disabled = false;
    }
  };
  img.onerror = () => toast("Could not load that image URL");
  img.src = url;
}

// Check for pending image from context menu
chrome.storage.local.get("pendingImageUrl", ({ pendingImageUrl }) => {
  if (pendingImageUrl) {
    chrome.storage.local.remove("pendingImageUrl");
    document.getElementById("imageUrl").value = pendingImageUrl;
    loadImageFromUrl(pendingImageUrl);
  }
});

// ANALYZE
analyzeBtn.addEventListener("click", startAnalysis);

async function startAnalysis() {
  currentMeta = {
    title: document.getElementById("bookTitle").value.trim(),
    genre: document.getElementById("bookGenre").value,
    audience: document.getElementById("bookAudience").value.trim()
  };

  showView("loading");
  animateLoadingSteps();

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: "ANALYZE_COVER",
        imageBase64: currentImageBase64,
        imageUrl: currentImageUrl,
        metadata: currentMeta
      }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (response.success) resolve(response.result);
        else reject(new Error(response.error));
      });
    });

    currentResult = result;
    renderResults(result);
    saveAnalysis(result);
    showView("results");

  } catch (err) {
    showView("upload");
    toast("Analysis failed: " + err.message);
  }
}

function animateLoadingSteps() {
  const steps = ["step1","step2","step3","step4","step5"];
  let i = 0;
  steps.forEach(id => document.getElementById(id).classList.remove("active","done"));
  document.getElementById("step1").classList.add("active");

  const interval = setInterval(() => {
    document.getElementById(steps[i]).classList.remove("active");
    document.getElementById(steps[i]).classList.add("done");
    i++;
    if (i >= steps.length) { clearInterval(interval); return; }
    document.getElementById(steps[i]).classList.add("active");
  }, 900);
}

// --- RESULTS ---

function renderResults(r) {
  // Score
  const scoreNum = document.getElementById("scoreNum");
  const scoreArc = document.getElementById("scoreArc");
  const total = 213.6;
  const offset = total - (total * r.overallScore / 100);

  // Animate score number
  let count = 0;
  const target = r.overallScore;
  const inc = setInterval(() => {
    count = Math.min(count + 2, target);
    scoreNum.textContent = count;
    if (count >= target) clearInterval(inc);
  }, 20);

  setTimeout(() => {
    scoreArc.style.strokeDashoffset = offset;
    // Color the arc
    if (r.overallScore >= 80) scoreArc.style.stroke = "#1D9E75";
    else if (r.overallScore >= 60) scoreArc.style.stroke = "#639922";
    else if (r.overallScore >= 40) scoreArc.style.stroke = "#BA7517";
    else scoreArc.style.stroke = "#E24B4A";
  }, 100);

  // Verdict
  const vb = document.getElementById("verdictBadge");
  vb.textContent = r.verdict;
  vb.className = "verdict-badge";
  const v = r.verdict?.toLowerCase();
  if (v === "poor" || v === "weak") vb.classList.add("poor");
  else if (v === "decent") vb.classList.add("decent");

  document.getElementById("scoreTitleDisplay").textContent = currentMeta.title || "Your cover";
  document.getElementById("scoreGenreDisplay").textContent =
    [currentMeta.genre, currentMeta.audience].filter(Boolean).join(" · ") || r.genreExpectations?.detected || "";

  // Dimension bars
  const dims = r.dimensions || {};
  const dimLabels = {
    genreMatch: "Genre match",
    thumbnailClarity: "Thumbnail clarity",
    readability: "Readability",
    clickPotential: "Click potential",
    professionalDesign: "Professional design",
    emotionalImpact: "Emotional impact"
  };

  const barsEl = document.getElementById("dimBars");
  barsEl.innerHTML = "";
  Object.entries(dimLabels).forEach(([key, label]) => {
    const val = dims[key] ?? 0;
    const color = val >= 80 ? "#1D9E75" : val >= 60 ? "#639922" : val >= 40 ? "#BA7517" : "#E24B4A";
    barsEl.innerHTML += `
      <div class="dim-row">
        <span class="dim-label">${label}</span>
        <div class="dim-track"><div class="dim-fill" id="fill-${key}" style="background:${color};"></div></div>
        <span class="dim-val" style="color:${color};">${val}</span>
      </div>`;
  });

  // Animate bars after render
  setTimeout(() => {
    Object.entries(dimLabels).forEach(([key]) => {
      const el = document.getElementById(`fill-${key}`);
      if (el) el.style.width = (dims[key] ?? 0) + "%";
    });
  }, 80);

  // Thumbnail test
  const tt = r.thumbnailTest || {};
  const thumbItems = [
    { key: "titleVisible", label: "Title readable" },
    { key: "subtitleVisible", label: "Subtitle readable" },
    { key: "imageRecognizable", label: "Image clear" },
    { key: "authorVisible", label: "Author visible" },
    { key: "mobileReady", label: "Mobile ready" }
  ];
  document.getElementById("thumbGrid").innerHTML = thumbItems.map(({ key, label }) => `
    <div class="thumb-item">
      <span class="thumb-icon ${tt[key] ? "thumb-pass" : "thumb-fail"}">${tt[key] ? "✓" : "✗"}</span>
      <span>${label}</span>
    </div>`).join("");

  // Suggestions
  const sugs = r.suggestions || [];
  document.getElementById("suggestionsList").innerHTML = sugs.map(s => `
    <div class="sug-item">
      <div class="sug-dot ${s.type || "warn"}"></div>
      <span>${s.text}</span>
    </div>`).join("") || "<p style='font-size:11px;color:var(--text-tertiary)'>No suggestions.</p>";

  // Genre expectations
  const ge = r.genreExpectations || {};
  document.getElementById("genreGrid").innerHTML = `
    <div class="genre-item">
      <div class="genre-item-label">Colours</div>
      <div class="genre-fit-badge ${fitClass(ge.colorPaletteFit)}">${ge.colorPaletteFit || "—"}</div>
    </div>
    <div class="genre-item">
      <div class="genre-item-label">Typography</div>
      <div class="genre-fit-badge ${fitClass(ge.typographyFit)}">${ge.typographyFit || "—"}</div>
    </div>
    <div class="genre-item">
      <div class="genre-item-label">Imagery</div>
      <div class="genre-fit-badge ${fitClass(ge.imageryFit)}">${ge.imageryFit || "—"}</div>
    </div>`;
}

function fitClass(val) {
  if (!val) return "fit-moderate";
  const v = val.toLowerCase();
  if (v === "strong") return "fit-strong";
  if (v === "weak") return "fit-weak";
  return "fit-moderate";
}

function saveAnalysis(result) {
  const analysis = {
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    title: currentMeta.title || "Untitled",
    genre: currentMeta.genre || "Unknown",
    score: result.overallScore,
    verdict: result.verdict,
    result
  };
  chrome.runtime.sendMessage({ type: "SAVE_ANALYSIS", analysis });
}

// New analysis
document.getElementById("newAnalysisBtn").addEventListener("click", () => {
  currentImageBase64 = null;
  currentImageUrl = null;
  currentResult = null;
  document.getElementById("previewWrap").classList.add("hidden");
  document.getElementById("previewImg").src = "";
  document.getElementById("fileInput").value = "";
  document.getElementById("imageUrl").value = "";
  document.getElementById("analyzeBtn").disabled = true;
  showView("upload");
});

// --- HISTORY ---

document.getElementById("historyBtn").addEventListener("click", () => {
  loadHistory();
  showView("history");
});
document.getElementById("backFromHistoryBtn").addEventListener("click", () => {
  showView(currentResult ? "results" : "upload");
});

function loadHistory() {
  chrome.runtime.sendMessage({ type: "GET_ANALYSES" }, ({ analyses }) => {
    const list = document.getElementById("historyList");
    const empty = document.getElementById("historyEmpty");
    list.innerHTML = "";

    if (!analyses || analyses.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    analyses.forEach(a => {
      const scoreClass = a.score >= 75 ? "" : a.score >= 50 ? "mid" : "low";
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <div class="history-score ${scoreClass}">${a.score}</div>
        <div class="history-info">
          <div class="history-title">${a.title}</div>
          <div class="history-meta">${a.genre} · ${a.date}</div>
        </div>`;
      item.addEventListener("click", () => {
        currentResult = a.result;
        currentMeta = { title: a.title, genre: a.genre };
        renderResults(a.result);
        showView("results");
      });
      list.appendChild(item);
    });
  });
}

// --- SHARE ---

document.getElementById("shareBtn").addEventListener("click", () => {
  if (!currentResult) return;
  buildShareCard(currentResult);
  showView("share");
});
document.getElementById("backFromShareBtn").addEventListener("click", () => showView("results"));

function buildShareCard(r) {
  document.getElementById("shareScore").textContent = r.overallScore;
  document.getElementById("shareBookName").textContent = currentMeta.title || "My Book Cover";
  document.getElementById("shareBookGenre").textContent = currentMeta.genre || r.genreExpectations?.detected || "Book";

  // Badges from passing thumbnail tests
  const tt = r.thumbnailTest || {};
  const badges = [];
  if (tt.titleVisible) badges.push("Title readable ✓");
  if (tt.mobileReady) badges.push("Mobile ready ✓");
  if ((r.dimensions?.professionalDesign || 0) >= 75) badges.push("Pro design ✓");
  if ((r.dimensions?.genreMatch || 0) >= 75) badges.push("Genre fit ✓");
  if ((r.dimensions?.clickPotential || 0) >= 75) badges.push("High click potential ✓");

  document.getElementById("shareBadges").innerHTML = badges.slice(0, 4).map(b =>
    `<span class="share-badge">${b}</span>`).join("");

  const shareText = `My "${currentMeta.title || "book cover"}" scored ${r.overallScore}/100 on CoverWise™ – AI cover analysis for self-publishers. Analyze yours free → coverwise.app`;
  document.getElementById("shareText").textContent = shareText;
}

document.getElementById("copyShareBtn").addEventListener("click", () => {
  const text = document.getElementById("shareText").textContent;
  navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard!"));
});

document.getElementById("downloadCardBtn").addEventListener("click", () => {
  toast("Screenshot the card above to save it!");
});

// --- SIDEBAR TOGGLE ---

document.getElementById("sidebarBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_SIDEBAR" }, (response) => {
      if (chrome.runtime.lastError) {
        toast("Reload the page to enable sidebar");
        return;
      }
      toast(response?.visible ? "Sidebar opened on page" : "Sidebar closed");
    });
  });
});
