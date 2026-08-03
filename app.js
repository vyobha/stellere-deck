(function () {
  "use strict";

  const TOTAL = CONFIG.TOTAL_SLIDES;
  const STORAGE_KEY = "stellere_deck_visitor";

  let currentSlide = 1;
  let slideEnterTime = null;
  let viewer = { visitorId: null, tag: "" };
  let geo = { country: "", city: "" };

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

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Optional ?to=SomeInvestor in the URL — lets you send a personalised link
  // without making the viewer type anything. Falls back to "" if absent.
  function getTagFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get("to") || "").trim().slice(0, 60);
    } catch (e) { return ""; }
  }

  function getOrCreateVisitorId() {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch (e) {
      return uuid();
    }
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

    videoHotspot.style.display = (currentSlide === CONFIG.VIDEO_SLIDE) ? "block" : "none";

    const onTeamSlide = currentSlide === CONFIG.TEAM_SLIDE;
    emailHotspotArnav.style.display = onTeamSlide ? "block" : "none";
    emailHotspotGavneesh.style.display = onTeamSlide ? "block" : "none";
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
      name: viewer.tag,   // reused field: the ?to= label, if any, otherwise blank
      email: "",
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
    viewerTag.textContent = viewer.tag || "";
    currentSlide = 1;
    slideEnterTime = Date.now();
    buildDots();
    renderSlide();
    sendEvent("session_start", { page: 1 });
  }

  // ── Init ──
  fetchGeo();

  viewer.visitorId = getOrCreateVisitorId();
  viewer.tag = getTagFromUrl();

  startViewer();

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
    } else {
      slideEnterTime = Date.now();
    }
  });
})();
