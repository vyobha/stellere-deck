(function () {
  "use strict";

  const TOTAL = CONFIG.TOTAL_SLIDES;
  const STORAGE_KEY = "stellere_deck_viewer";

  let currentSlide = 1;
  let slideEnterTime = null;
  let viewer = { visitorId: null, name: "", email: "" };
  let geo = { country: "", city: "" };

  const gateEl = document.getElementById("gate");
  const viewerEl = document.getElementById("viewer");
  const slideImg = document.getElementById("slide-img");
  const counterEl = document.getElementById("counter");
  const dotsEl = document.getElementById("dots");
  const videoHotspot = document.getElementById("video-hotspot");
  const emailHotspotArnav = document.getElementById("email-hotspot-arnav");
  const emailHotspotGavneesh = document.getElementById("email-hotspot-gavneesh");
  const viewerTag = document.getElementById("viewer-tag");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const gateForm = document.getElementById("gate-form");
  const gateError = document.getElementById("gate-error");

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function slidePath(n) {
    const num = String(n).padStart(2, "0");
    return "slides/slide-" + num + ".jpg";
  }

  function buildDots() {
    dotsEl.innerHTML = "";
    for (let i = 1; i <= TOTAL; i++) {
      const d = document.createElement("div");
      d.className = "dot" + (i === currentSlide ? " active" : "");
      d.dataset.slide = i;
      d.addEventListener("click", function () { goToSlide(i); });
      dotsEl.appendChild(d);
    }
  }

  function updateDots() {
    Array.from(dotsEl.children).forEach(function (d, idx) {
      d.classList.toggle("active", idx + 1 === currentSlide);
    });
  }

  function renderSlide() {
    slideImg.src = slidePath(currentSlide);
    counterEl.textContent = currentSlide + " / " + TOTAL;
    btnPrev.disabled = currentSlide === 1;
    btnNext.disabled = currentSlide === TOTAL;
    updateDots();

    if (currentSlide === CONFIG.VIDEO_SLIDE) {
      videoHotspot.style.display = "block";
    } else {
      videoHotspot.style.display = "none";
    }

    if (currentSlide === CONFIG.TEAM_SLIDE) {
      emailHotspotArnav.style.display = "block";
      emailHotspotGavneesh.style.display = "block";
    } else {
      emailHotspotArnav.style.display = "none";
      emailHotspotGavneesh.style.display = "none";
    }
  }

  function logSlideTime() {
    if (slideEnterTime === null) return;
    const seconds = Math.round((Date.now() - slideEnterTime) / 1000);
    if (seconds >= 1) {
      sendEvent("slide_time", { page: currentSlide, seconds: seconds });
    }
  }

  function goToSlide(n) {
    if (n < 1 || n > TOTAL || n === currentSlide) return;
    logSlideTime();
    currentSlide = n;
    slideEnterTime = Date.now();
    renderSlide();
    sendEvent("slide_view", { page: currentSlide });
    if (currentSlide === TOTAL) {
      sendEvent("deck_complete", { page: currentSlide });
    }
  }

  function sendEvent(type, extra) {
    const payload = Object.assign({
      type: type,
      visitorId: viewer.visitorId,
      name: viewer.name,
      email: viewer.email,
      ts: Date.now(),
      referrer: document.referrer || "",
      ua: navigator.userAgent,
      country: geo.country,
      city: geo.city,
    }, extra || {});

    const endpoint = CONFIG.ANALYTICS_ENDPOINT;
    if (!endpoint || endpoint.indexOf("PASTE_YOUR") === 0) return; // not configured yet

    try {
      if (navigator.sendBeacon && (type === "slide_time" || type === "deck_complete")) {
        const blob = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=UTF-8" });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify(payload),
        }).catch(function () {});
      }
    } catch (e) { /* fail silently, never block the viewer */ }
  }

  function fetchGeo() {
    fetch("https://ipapi.co/json/")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        geo.country = d.country_name || "";
        geo.city = d.city || "";
      })
      .catch(function () {});
  }

  function startViewer() {
    gateEl.classList.add("hidden");
    viewerEl.classList.remove("hidden");
    viewerTag.textContent = viewer.name || viewer.email;
    currentSlide = 1;
    slideEnterTime = Date.now();
    buildDots();
    renderSlide();
    sendEvent("session_start", { page: 1 });
  }

  function loadStoredViewer() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function saveViewer(v) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch (e) {}
  }

  // ── Init ──
  fetchGeo();

  const stored = loadStoredViewer();
  if (stored && stored.email) {
    viewer = stored;
    startViewer();
    sendEvent("return_visit", { page: 1 });
  }

  gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("viewer-name").value.trim();
    const email = document.getElementById("viewer-email").value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!name || !emailOk) {
      gateError.textContent = "Please enter your name and a valid email.";
      return;
    }
    gateError.textContent = "";

    viewer = { visitorId: uuid(), name: name, email: email };
    saveViewer(viewer);
    startViewer();
  });

  btnPrev.addEventListener("click", function () { goToSlide(currentSlide - 1); });
  btnNext.addEventListener("click", function () { goToSlide(currentSlide + 1); });

  videoHotspot.addEventListener("click", function () {
    sendEvent("video_click", { page: currentSlide });
    window.open(CONFIG.VIDEO_URL, "_blank", "noopener");
  });

  emailHotspotArnav.addEventListener("click", function () {
    sendEvent("email_click", { page: currentSlide, target: "arnav" });
    window.location.href = "mailto:" + CONFIG.ARNAV_EMAIL;
  });

  emailHotspotGavneesh.addEventListener("click", function () {
    sendEvent("email_click", { page: currentSlide, target: "gavneesh" });
    window.location.href = "mailto:" + CONFIG.GAVNEESH_EMAIL;
  });

  document.addEventListener("keydown", function (e) {
    if (viewerEl.classList.contains("hidden")) return;
    if (e.key === "ArrowRight") goToSlide(currentSlide + 1);
    if (e.key === "ArrowLeft") goToSlide(currentSlide - 1);
  });

  // basic touch swipe
  let touchStartX = null;
  document.addEventListener("touchstart", function (e) {
    touchStartX = e.changedTouches[0].screenX;
  });
  document.addEventListener("touchend", function (e) {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goToSlide(currentSlide + 1);
      else goToSlide(currentSlide - 1);
    }
    touchStartX = null;
  });

  window.addEventListener("beforeunload", function () {
    logSlideTime();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      logSlideTime();
      slideEnterTime = null;
    } else if (!viewerEl.classList.contains("hidden")) {
      slideEnterTime = Date.now();
    }
  });
})();
