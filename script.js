// Billow landing page interactions. No dependencies.
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // True when focus came from the keyboard rather than a mouse click or tap
  function isKeyboardFocus(el) {
    try { return el.matches(":focus-visible"); } catch (err) { return true; }
  }

  // Nav hairline once the page scrolls
  var nav = document.getElementById("nav");
  var onScrollNav = function () { nav.classList.toggle("is-scrolled", window.scrollY > 8); };
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  // Hero photo carousel: slides, matching card and dots move together
  var carousel = document.getElementById("hero-carousel");
  var slides = carousel.querySelectorAll(".hero__slide");
  var cards = carousel.querySelectorAll(".hero__card-item");
  var dots = carousel.querySelectorAll(".hero__dots button");
  var current = 0;
  var paused = false;
  var onScreen = true;

  var n = slides.length;

  // Which side of the active item a state sits on: 1 next, -1 prev, 0 active
  function sideOf(state) {
    return state.indexOf("next") > -1 ? 1 : state.indexOf("prev") > -1 ? -1 : 0;
  }

  // Where item k rests when `active` is showing
  function restingState(k, active, dir) {
    if (k === active) return "active";
    if (k === (active + 1) % n) return "next";
    if (k === (active - 1 + n) % n) return "prev";
    return dir < 0 ? "hidden-prev" : "hidden-next";
  }

  // Move to `target`. dir 1 brings it in from the right (cards from below),
  // dir -1 from the left (cards from behind). Items that must jump to the
  // other side are moved instantly so they never sweep across the photo.
  function showSlide(target, dir) {
    target = (target + n) % n;
    if (target === current) return;
    [slides, cards].forEach(function (group) {
      var finals = [];
      for (var k = 0; k < n; k++) {
        var el = group[k];
        var state = el.getAttribute("data-state");
        var final = restingState(k, target, dir);
        if (k === current && final.indexOf("hidden") === 0) final = dir > 0 ? "hidden-prev" : "hidden-next";
        finals.push(final);
        if (k === target) {
          // Start the incoming item on the side it enters from
          if (sideOf(state) !== dir) {
            el.classList.add("no-anim");
            el.setAttribute("data-state", dir > 0 ? "hidden-next" : "hidden-prev");
          }
        } else if (k !== current && sideOf(final) !== sideOf(state)) {
          el.classList.add("no-anim");
          el.setAttribute("data-state", final);
        }
      }
      void carousel.offsetWidth; // commit the instant moves before animating
      for (var j = 0; j < n; j++) {
        group[j].classList.remove("no-anim");
        group[j].setAttribute("data-state", finals[j]);
        group[j].setAttribute("aria-hidden", String(j !== target));
      }
    });
    dots[current].removeAttribute("aria-current");
    dots[target].setAttribute("aria-current", "true");
    current = target;
  }

  // The active dot's fill animation is the timer: pausing it pauses the
  // carousel, and its animationend moves to the next slide.
  function scheduleRotate() {
    carousel.classList.toggle("is-paused", paused || !onScreen || document.hidden);
  }

  carousel.querySelector(".hero__dots").addEventListener("animationend", function (e) {
    if (reduceMotion || e.animationName !== "dot-fill") return;
    showSlide(current + 1, 1);
  });

  dots.forEach(function (d, i) {
    d.addEventListener("click", function () {
      showSlide(i, i > current ? 1 : -1);
    });
  });
  // Keeps running on hover and after mouse clicks. It pauses only while
  // keyboard focus is inside, so keyboard users can stop the motion.
  function pause(on) { paused = on; scheduleRotate(); }
  carousel.addEventListener("focusin", function (e) { if (isKeyboardFocus(e.target)) pause(true); });
  carousel.addEventListener("focusout", function () { pause(false); });
  document.addEventListener("visibilitychange", scheduleRotate);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      scheduleRotate();
    }).observe(carousel);
  }
  for (var s = 1; s < n; s++) {
    slides[s].setAttribute("aria-hidden", "true");
    cards[s].setAttribute("aria-hidden", "true");
  }
  scheduleRotate();

  // Stats: odometer roll. Each digit becomes a reel of 0–9 that rolls up into
  // place the first time the section is in view; punctuation and words stay
  // still. Reels run one full turn before landing (the last digit two), so
  // it reads like a mechanical counter. Screen readers use the sr-only copy.
  var statsGrid = document.getElementById("stats-grid");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var ROLL_MS = 1800;
    statsGrid.querySelectorAll(".stats__count").forEach(function (el, statIndex) {
      var text = el.textContent;
      var digitCount = text.replace(/\D/g, "").length;
      var seen = 0;
      el.textContent = "";
      el.classList.add("odo");
      text.split("").forEach(function (ch) {
        if (!/\d/.test(ch)) {
          var still = document.createElement("span");
          still.className = "odo__still";
          still.textContent = ch;
          el.appendChild(still);
          return;
        }
        var turns = seen === digitCount - 1 ? 2 : 1;
        var stop = turns * 10 + Number(ch);
        var cell = document.createElement("span");
        var reel = document.createElement("span");
        cell.className = "odo__cell";
        reel.className = "odo__reel";
        for (var n = 0; n <= stop; n++) {
          var d = document.createElement("span");
          d.textContent = String(n % 10);
          reel.appendChild(d);
        }
        reel.style.setProperty("--stop", stop);
        reel.style.setProperty("--delay", (statIndex * 90 + seen * 70) + "ms");
        reel.style.setProperty("--roll", ROLL_MS + "ms");
        cell.appendChild(reel);
        el.appendChild(cell);
        seen++;
      });
    });
    var statsObs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        statsObs.disconnect();
        statsGrid.classList.add("is-rolling");
      }
    }, { threshold: 0.35 });
    statsObs.observe(statsGrid);
  }

  // Testimonials: tabs with one panel each. The active tab's progress-line
  // animation is the timer (7.5s); its animationend moves to the next tab.
  // Arrow keys, Home and End move between tabs (roving tabindex).
  var quotes = document.getElementById("quotes");
  var quoteTabs = Array.prototype.slice.call(quotes.querySelectorAll('[role="tab"]'));
  var quotePanels = quoteTabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
  var quoteIndex = 0;
  var quoteFocus = false;
  var quoteOnScreen = false;

  function showQuote(i, moveFocus) {
    quoteIndex = (i + quoteTabs.length) % quoteTabs.length;
    quoteTabs.forEach(function (t, k) {
      var on = k === quoteIndex;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      quotePanels[k].classList.toggle("is-active", on);
    });
    var tab = quoteTabs[quoteIndex];
    // Keep the active tab visible when the row scrolls sideways on phones
    var row = tab.parentElement;
    if (tab.offsetLeft < row.scrollLeft || tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: tab.offsetLeft - 16, behavior: reduceMotion ? "auto" : "smooth" });
    }
    if (moveFocus) tab.focus();
  }

  function updateQuotePause() {
    quotes.classList.toggle("is-paused", quoteFocus || !quoteOnScreen || document.hidden);
  }

  quoteTabs.forEach(function (t, k) {
    t.addEventListener("click", function () { showQuote(k, false); });
    t.addEventListener("keydown", function (e) {
      var next = { ArrowRight: quoteIndex + 1, ArrowLeft: quoteIndex - 1, Home: 0, End: quoteTabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      showQuote(next, true);
    });
  });
  quotes.addEventListener("animationend", function (e) {
    if (reduceMotion || e.animationName !== "quote-fill") return;
    showQuote(quoteIndex + 1, false);
  });
  // Same rule as the hero: no pause on hover or click, only for keyboard focus
  quotes.addEventListener("focusin", function (e) { quoteFocus = isKeyboardFocus(e.target); updateQuotePause(); });
  quotes.addEventListener("focusout", function () { quoteFocus = false; updateQuotePause(); });
  document.addEventListener("visibilitychange", updateQuotePause);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      quoteOnScreen = entries[0].isIntersecting;
      updateQuotePause();
    }, { threshold: 0.3 }).observe(quotes);
  } else {
    quoteOnScreen = true;
  }
  updateQuotePause();

  // How we do it: photos scale in once when the section comes into view
  var method = document.getElementById("method");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    method.classList.add("is-in");
  } else {
    var methodObs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        method.classList.add("is-in");
        methodObs.disconnect();
      }
    }, { threshold: 0.2 });
    methodObs.observe(method);
  }

  // How it works: reveal steps once in view. Each cell's UI plays once just
  // after its card appears, and replays when a mouse enters the cell. With
  // reduced motion the UIs simply show their finished state.
  var how = document.getElementById("how-list");
  var steps = Array.prototype.slice.call(how.children);

  function playStep(step) {
    step.classList.remove("is-playing");
    void step.offsetWidth; // restart the animations
    step.classList.add("is-playing");
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    how.classList.add("is-in");
  } else {
    var howObs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        how.classList.add("is-in");
        howObs.disconnect();
        steps.forEach(function (step, i) {
          setTimeout(function () { playStep(step); }, 450 + i * 120);
        });
      }
    }, { threshold: 0.25 });
    howObs.observe(how);
    steps.forEach(function (step) {
      step.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") playStep(step); });
    });
  }

  // Statement: fill letters in as the paragraph scrolls through the viewport.
  // Each word is wrapped (.wd) so lines never break mid-word; each letter is
  // its own span (.c). Screen readers get the plain sentence.
  var statement = document.getElementById("statement-text");
  var sentence = statement.textContent.trim();
  var visual = sentence.split(/\s+/).map(function (w) {
    return '<span class="wd">' + w.split("").map(function (ch) {
      return '<span class="c">' + ch + "</span>";
    }).join("") + "</span>";
  }).join(" ");
  statement.innerHTML = '<span class="sr-only">' + sentence + '</span><span aria-hidden="true">' + visual + "</span>";
  var spans = statement.querySelectorAll(".c");

  if (reduceMotion) {
    spans.forEach(function (s) { s.classList.add("is-on"); });
  } else {
    var ticking = false;
    var lastLit = -1;
    var paint = function () {
      ticking = false;
      var r = statement.getBoundingClientRect();
      var vh = window.innerHeight;
      // 0 when the top reaches 85% of the viewport, 1 when the bottom reaches 45%
      var start = vh * 0.85;
      var end = vh * 0.45;
      var progress = (start - r.top) / (start - end + r.height);
      progress = Math.max(0, Math.min(1, progress));
      var lit = Math.round(progress * spans.length);
      if (lit === lastLit) return;
      lastLit = lit;
      for (var i = 0; i < spans.length; i++) spans[i].classList.toggle("is-on", i < lit);
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  // CTA photos: every few seconds the six slots blur out in a staggered
  // wave, swap to the next set of photos, and blur back in. Each img lists its
  // photos in data-srcs. Paused off screen or in a hidden tab; with reduced
  // motion the first set simply stays.
  var strip = document.querySelector(".cta__photos");
  if (strip && !reduceMotion) {
    var ctaSlots = Array.prototype.slice.call(strip.querySelectorAll(".cta__slot"));
    var ctaSets = ctaSlots.map(function (slot) {
      return slot.querySelector("img").getAttribute("data-srcs").split("|");
    });
    var ctaIndex = 0;
    var ctaVisible = false;
    var ctaTimer = null;
    ctaSets.forEach(function (srcs) { srcs.forEach(function (src) { new Image().src = src; }); });

    var ctaCycle = function () {
      ctaTimer = null;
      if (!ctaVisible || document.hidden) return;
      ctaIndex++;
      ctaSlots.forEach(function (slot, i) {
        setTimeout(function () { slot.classList.add("is-out"); }, i * 150);
        setTimeout(function () {
          var srcs = ctaSets[i];
          slot.querySelector("img").src = srcs[ctaIndex % srcs.length];
          slot.classList.remove("is-out");
        }, i * 150 + 900);
      });
      ctaTimer = setTimeout(ctaCycle, 4500);
    };
    var ctaResume = function () {
      if (ctaVisible && !document.hidden && !ctaTimer) ctaTimer = setTimeout(ctaCycle, 2500);
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        ctaVisible = entries[0].isIntersecting;
        ctaResume();
      }).observe(strip);
    }
    document.addEventListener("visibilitychange", ctaResume);
  }

  // CTA photos: mouse parallax. Each photo drifts against the cursor, larger
  // photos further (up to ~24px) so they read as closer. Movement eases toward
  // the target each frame and settles back when the mouse leaves. Uses the
  // separate `translate` property, so it combines with the blur cycle above.
  var ctaSection = document.getElementById("start");
  var ctaPhotos = Array.prototype.slice.call(document.querySelectorAll(".cta__slot"));
  if (ctaSection && ctaPhotos.length && !reduceMotion) {
    var driftDepths = ctaPhotos.map(function (slot) { return slot.offsetWidth / 182 * 24 || 20; });
    var driftTo = { x: 0, y: 0 };   // where the photos are heading
    var driftAt = { x: 0, y: 0 };   // where they are now (own names: `current` is the hero slide index)
    var drifting = false;
    var drift = function () {
      driftAt.x += (driftTo.x - driftAt.x) * 0.08;
      driftAt.y += (driftTo.y - driftAt.y) * 0.08;
      ctaPhotos.forEach(function (slot, i) {
        slot.style.translate = (-driftAt.x * driftDepths[i]).toFixed(2) + "px " + (-driftAt.y * driftDepths[i]).toFixed(2) + "px";
      });
      if (Math.abs(driftTo.x - driftAt.x) > 0.001 || Math.abs(driftTo.y - driftAt.y) > 0.001) {
        requestAnimationFrame(drift);
      } else {
        drifting = false;
      }
    };
    var startDrift = function () {
      if (!drifting) { drifting = true; requestAnimationFrame(drift); }
    };
    ctaSection.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = ctaSection.getBoundingClientRect();
      driftTo.x = (e.clientX - r.left) / r.width * 2 - 1;  // -1 left edge, 1 right edge
      driftTo.y = (e.clientY - r.top) / r.height * 2 - 1;
      startDrift();
    });
    ctaSection.addEventListener("pointerleave", function () {
      driftTo.x = 0; driftTo.y = 0;
      startDrift();
    });
  }

  // Footer heading: the last word deletes itself and types the next one, on a
  // loop. Screen readers get the full sentence; with reduced motion the
  // first word simply stays.
  var footerWord = document.getElementById("footer-word");
  if (footerWord && !reduceMotion) {
    var footerWords = ["freelancers", "studios", "agencies", "consultants", "photographers"];
    var wordIndex = 0;
    var typeWord = function () {
      var current = footerWord.textContent;
      if (current.length) {
        footerWord.textContent = current.slice(0, -1);
        setTimeout(typeWord, 45);
        return;
      }
      wordIndex = (wordIndex + 1) % footerWords.length;
      var next = footerWords[wordIndex];
      var typed = 0;
      var typeNext = function () {
        typed++;
        footerWord.textContent = next.slice(0, typed);
        if (typed < next.length) setTimeout(typeNext, 80);
        else setTimeout(typeWord, 2200);
      };
      setTimeout(typeNext, 250);
    };
    setTimeout(typeWord, 2200);
  }

  // Sign-up forms: inline validation, no network call (wire to your backend)
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  ["hero-form", "footer-form"].forEach(function (id) {
    var form = document.getElementById(id);
    var input = form.querySelector("input");
    var msg = form.querySelector(".signup__msg");

    function show(text, kind) {
      msg.textContent = text;
      msg.className = "signup__msg" + (kind ? " is-" + kind : "");
      form.classList.toggle("is-invalid", kind === "error");
      input.setAttribute("aria-invalid", String(kind === "error"));
    }

    input.addEventListener("input", function () { if (msg.textContent) show("", null); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = input.value.trim();
      if (!value) { show("Enter your work email to get started.", "error"); input.focus(); return; }
      if (!emailPattern.test(value)) { show("That email doesn’t look right. Check it and try again.", "error"); input.focus(); return; }
      var ok = form.getAttribute("data-ok") || "You’re in. Check {email} for your sign-in link.";
      show(ok.replace("{email}", value), "ok");
      input.value = "";
    });
  });
})();
