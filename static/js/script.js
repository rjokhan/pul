// === Базовые настройки API ===
const ANALYTICS_BASE = "/api/track";
const LEADS_ENDPOINT = "/api/leads/free-lesson/";

// локальное видео
const TRAILER_SRC = "media/trailer.mp4";
const TRAILER_POSTER = "media/trailer.png";
const FREE_LESSON_SRC = "media/free-lesson.mp4";
const FREE_LESSON_POSTER = "media/14.png";

// ================= SESSION ID =================
function getSessionId() {
    const KEY = "ilmi_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
            .replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        localStorage.setItem(KEY, id);
    }
    return id;
}

const SESSION_ID = getSessionId();

function safeFetch(url, payload) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify(payload)
    }).catch(err => console.warn("Analytics error:", err));
}

// ==================================================
// ============== УНИВЕРСАЛЬНЫЙ ВИДЕОПЛЕЕР =========
// ==================================================
function initVideoPlayer({
    wrapperId,
    videoId,
    bigPlayId,
    controlsId,
    playBtnId,
    progressFillId,
    volumeId,
    muteBtnId,
    fsBtnId,
    progressContainerSelector = ".vc-progress",
    poster,
    src,
    analyticsEventId
}) {
    const wrapper  = document.getElementById(wrapperId);
    const video    = document.getElementById(videoId);
    const bigPlay  = document.getElementById(bigPlayId);
    const controls = document.getElementById(controlsId);

    if (!wrapper || !video || !bigPlay || !controls) return null;

    const playBtn        = document.getElementById(playBtnId);
    const progressFill   = document.getElementById(progressFillId);
    const volumeSlider   = document.getElementById(volumeId);
    const muteBtn        = document.getElementById(muteBtnId);
    const fsBtn          = document.getElementById(fsBtnId);
    const timeLabel      = controls.querySelector(".vc-time");
    const progressHolder = controls.querySelector(progressContainerSelector);

    if (!playBtn || !progressFill || !volumeSlider || !muteBtn || !fsBtn || !timeLabel || !progressHolder) {
        return null;
    }

    // защита: убираем стандартные контролы и ограничиваем загрузку/шэринг
    video.removeAttribute("controls");
    video.setAttribute("controlslist", "nodownload noremoteplayback");
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute("playsinline", "");

    // постер/источник
    if (poster && !video.getAttribute("poster")) {
        video.setAttribute("poster", poster);
    }
    if (src && !video.querySelector("source")) {
        const srcEl = document.createElement("source");
        srcEl.src = src;
        srcEl.type = "video/mp4";
        video.appendChild(srcEl);
    }

    controls.classList.add("hide");

    let seeking = false;
    let analyticsSent = false;

    function formatTime(sec) {
        if (!isFinite(sec)) return "0:00";
        const s = Math.floor(sec);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, "0")}`;
    }

    function updateTimeAndProgress() {
        const cur = video.currentTime || 0;
        const dur = video.duration || 0;

        timeLabel.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;

        const percent = dur ? (cur / dur) * 100 : 0;
        progressFill.style.width = `${percent}%`;
    }

    function updatePlayUI() {
        if (video.paused || video.ended) {
            playBtn.textContent = "▶";
            bigPlay.classList.remove("hidden");
        } else {
            playBtn.textContent = "❚❚";
            bigPlay.classList.add("hidden");
            controls.classList.remove("hide");
        }
    }

    function startAnalyticsOnce() {
        if (analyticsSent || !analyticsEventId) return;
        analyticsSent = true;
        safeFetch(`${ANALYTICS_BASE}/event/`, {
            session_id: SESSION_ID,
            page_path: window.location.pathname || "/",
            event_id: analyticsEventId
        });
    }

    function togglePlay() {
        if (video.paused || video.ended) {
            video.play().then(() => startAnalyticsOnce());
        } else {
            video.pause();
        }
    }

    // события видео
    video.addEventListener("loadedmetadata", updateTimeAndProgress);
    video.addEventListener("timeupdate", updateTimeAndProgress);
    video.addEventListener("play", updatePlayUI);
    video.addEventListener("pause", updatePlayUI);
    video.addEventListener("ended", () => {
        video.pause();
        updateTimeAndProgress();
        updatePlayUI();
    });

    // защита: контекстное меню
    video.addEventListener("contextmenu", e => e.preventDefault());

    // PLAY
    bigPlay.addEventListener("click", e => { e.stopPropagation(); togglePlay(); });
    playBtn.addEventListener("click", e => { e.stopPropagation(); togglePlay(); });
    video.addEventListener("click", togglePlay);

    // ПЕРЕМОТКА
    function seekByEvent(ev) {
        const rect = progressHolder.getBoundingClientRect();
        const x = Math.min(Math.max(ev.clientX - rect.left, 0), rect.width);
        const ratio = x / rect.width;
        video.currentTime = (video.duration || 0) * ratio;
        updateTimeAndProgress();
    }

    progressHolder.addEventListener("mousedown", (e) => {
        seeking = true;
        seekByEvent(e);
    });

    window.addEventListener("mousemove", (e) => {
        if (seeking) seekByEvent(e);
    });

    window.addEventListener("mouseup", () => { seeking = false; });

    // ГРОМКОСТЬ
    volumeSlider.addEventListener("input", () => {
        const v = Number(volumeSlider.value);
        video.volume = v;
        video.muted = v === 0;
        muteBtn.textContent = video.muted ? "🔇" : "🔊";
    });

    muteBtn.addEventListener("click", () => {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? "🔇" : "🔊";
        volumeSlider.value = video.muted ? 0 : video.volume;
    });

    // FULLSCREEN
    fsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const doc = document;
        const isFs = doc.fullscreenElement;
        if (!isFs) wrapper.requestFullscreen?.();
        else doc.exitFullscreen?.();
    });

    updateTimeAndProgress();
    updatePlayUI();

    return video;
}

// ================= SECTION VIEW =================
function setupSectionObserver() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const sectionId = entry.target.dataset.trackSection;
            if (entry.isIntersecting && sectionId) {
                safeFetch(`${ANALYTICS_BASE}/section-view/`, {
                    session_id: SESSION_ID,
                    page_path: window.location.pathname || "/",
                    section_id: sectionId,
                    visible_ratio: entry.intersectionRatio
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll("[data-track-section]").forEach(el => observer.observe(el));
}

// ================= CLICK TRACKING =================
function initClickTracking() {
    document.body.addEventListener("click", (e) => {
        const target = e.target.closest("[data-event-id]");
        if (!target) return;

        safeFetch(`${ANALYTICS_BASE}/event/`, {
            session_id: SESSION_ID,
            page_path: window.location.pathname || "/",
            event_id: target.dataset.eventId
        });
    });
}

// ==================================================
// =============== КАСТОМНЫЙ ТРЕЙЛЕР =================
// ==================================================
function initTrailerPlayer() {
    initVideoPlayer({
        wrapperId: "trailer-block",
        videoId: "courseTrailer",
        bigPlayId: "trailerBigPlay",
        controlsId: "trailerControls",
        playBtnId: "trailerPlayBtn",
        progressFillId: "trailerProgressFill",
        volumeId: "trailerVolume",
        muteBtnId: "trailerMuteBtn",
        fsBtnId: "trailerFullscreenBtn",
        progressContainerSelector: ".vc-progress",
        poster: TRAILER_POSTER,
        src: TRAILER_SRC,
        analyticsEventId: "trailer_play"
    });
}

// ==================================================
// ========= ПОПАП БЕСПЛАТНОГО УРОКА (MP4) ==========
// ==================================================
function initFreeLessonModal() {

    const freeLessonModal = document.getElementById("freeLessonModal");
    const freeLessonMain  = document.getElementById("freeLessonMain");
    const btnFreeLesson   = document.getElementById("btn-free-lesson");
    const modalCloseBtn   = document.getElementById("modalCloseBtn");

    const freeLessonForm  = document.getElementById("freeLessonForm");
    const modalStepForm   = document.getElementById("modalStepForm");
    const modalStepVideo  = document.getElementById("modalStepVideo");

    const bottomSheet     = document.getElementById("lessonBottomSheet");
    const bottomCtaBtn    = document.getElementById("lessonBottomCta");
    const gotobuyEl       = document.getElementById("gotobuy");

    let bottomTimer = null;
    let freeVideoInstance = null;

    if (!freeLessonModal || !freeLessonMain) return;

    function scrollToGotobuyCentered() {
        if (!gotobuyEl) return;

        const rect = gotobuyEl.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        const elementTop     = rect.top + scrollTop;
        const elementHeight  = rect.height;
        const viewportHeight = window.innerHeight;

        const targetScroll = elementTop - (viewportHeight / 2) + (elementHeight / 2);

        window.scrollTo({
            top: targetScroll,
            behavior: "smooth"
        });
    }

    function showBottomSheetDelayed() {
        if (!bottomSheet) return;
        bottomTimer = setTimeout(() => {
            bottomSheet.classList.add("is-visible");
        }, 5000);
    }

    function hideBottomSheet() {
        if (!bottomSheet) return;
        bottomSheet.classList.remove("is-visible");
        bottomSheet.classList.remove("lesson-slide-down");
    }

    function openModal() {
        freeLessonModal.classList.add("is-visible");
        document.body.style.overflow = "hidden";

        modalStepForm.classList.add("is-active");
        modalStepVideo.classList.remove("is-active");
        hideBottomSheet();

        if (bottomTimer) {
            clearTimeout(bottomTimer);
            bottomTimer = null;
        }
    }

    function closeModal() {
        if (freeVideoInstance) {
            freeVideoInstance.pause();
        }

        freeLessonModal.classList.remove("is-visible");
        document.body.style.overflow = "";
        hideBottomSheet();
        freeLessonMain.classList.remove("modal-slide-up");

        if (bottomTimer) {
            clearTimeout(bottomTimer);
            bottomTimer = null;
        }
    }

    if (btnFreeLesson) {
        btnFreeLesson.addEventListener("click", (e) => {
            e.preventDefault();
            openModal();
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", closeModal);
    }

    freeLessonModal.addEventListener("click", (e) => {
        if (e.target === freeLessonModal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal();
        }
    });

    // отправка формы -> переход на шаг видео + инициализация плеера
    if (freeLessonForm) {
        freeLessonForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const formData = new FormData(freeLessonForm);
            const payload = {
                session_id: SESSION_ID,
                full_name: formData.get("full_name"),
                phone: formData.get("phone"),
                course_slug: "pulni-boshqarish-sanhati"
            };

            if (String(payload.phone).replace(/\D/g, "").length < 9) {
                alert("Телефон рақамингизни тўғри киритинг.");
                return;
            }

            safeFetch(LEADS_ENDPOINT, payload);

            modalStepForm.classList.remove("is-active");
            modalStepVideo.classList.add("is-active");

            // инициализируем кастомный плеер для бесплатного урока
            freeVideoInstance = initVideoPlayer({
                wrapperId:  "freeLessonBlock",
                videoId:    "freeLessonVideo",
                bigPlayId:  "freeLessonBigPlay",
                controlsId: "freeLessonControls",
                playBtnId:  "freeLessonPlayBtn",
                progressFillId: "freeLessonProgressFill",
                volumeId:   "freeLessonVolume",
                muteBtnId:  "freeLessonMuteBtn",
                fsBtnId:    "freeLessonFullscreenBtn",
                progressContainerSelector: ".vc-progress",
                poster: FREE_LESSON_POSTER,
                src:    FREE_LESSON_SRC,
                analyticsEventId: "free_lesson_play"
            });

            if (freeVideoInstance) {
                freeVideoInstance.play().catch(() => {});
            }

            showBottomSheetDelayed();
        });
    }

    // Клик по нижней кнопке: два попапа анимированно уходят + скролл
    if (bottomCtaBtn && bottomSheet) {
        bottomCtaBtn.addEventListener("click", () => {
            const animDuration = 320;

            freeLessonMain.classList.add("modal-slide-up");
            bottomSheet.classList.add("lesson-slide-down");

            setTimeout(() => {
                closeModal();
                scrollToGotobuyCentered();
            }, animDuration + 30);
        });
    }
}

// ==================================================
// ========= ПРОЧИЙ ФУНКЦИОНАЛ СТРАНИЦЫ =============
// ==================================================

// Аккордеон программы
document.addEventListener("DOMContentLoaded", () => {
    const sections = document.querySelectorAll(".cp-section");
    if (!sections.length) return;

    const first = sections[0];
    const firstBody = first.querySelector(".cp-lessons");
    const firstArrow = first.querySelector(".cp-arrow");
    if (firstBody && firstArrow) {
        firstBody.style.display = "block";
        first.classList.add("open");
        firstArrow.textContent = "▴";
    }

    sections.forEach((section) => {
        const header = section.querySelector(".cp-section-header");
        const body   = section.querySelector(".cp-lessons");
        const arrow  = section.querySelector(".cp-arrow");
        if (!header || !body || !arrow) return;

        header.addEventListener("click", () => {
            const isOpen = body.style.display === "block";

            sections.forEach(sec => {
                const b = sec.querySelector(".cp-lessons");
                const a = sec.querySelector(".cp-arrow");
                if (!b || !a) return;
                b.style.display = "none";
                sec.classList.remove("open");
                a.textContent = "▾";
            });

            if (!isOpen) {
                body.style.display = "block";
                section.classList.add("open");
                arrow.textContent = "▴";
            }
        });
    });
});

// ILMI-flow (вариант с .ilmi-flow-section – если используется)
document.addEventListener("DOMContentLoaded", () => {
    const section = document.querySelector(".ilmi-flow-section");
    if (!section) return;

    const items = Array.from(section.querySelectorAll(".ilmi-line, .ilmi-pill"));
    if (!items.length) return;

    function updateFlow() {
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        const triggerY = scrollY + vh * 0.6;
        const zone = vh * 0.4;

        items.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const elCenter = scrollY + rect.top + rect.height / 2;

            const dist = elCenter - triggerY;
            let progress = 1 - Math.abs(dist) / zone;
            progress = Math.max(0, Math.min(1, progress));

            if (progress > 0) {
                el.classList.add("is-visible");
            } else {
                el.classList.remove("is-visible");
            }

            el.style.setProperty("--flow-progress", progress.toFixed(3));
        });
    }

    window.addEventListener("scroll", updateFlow, { passive: true });
    window.addEventListener("resize", updateFlow);
    updateFlow();
});

// ILMI vertical flow animation (.ilmi-flow)
document.addEventListener("DOMContentLoaded", () => {
    const flowRoot = document.querySelector(".ilmi-flow");
    if (!flowRoot) return;

    const steps = flowRoot.querySelectorAll(".ilmi-flow-step");
    const lines = flowRoot.querySelectorAll(".ilmi-flow-line");

    const MIN_FULL_RATIO = 0.55;

    const options = {
        root: null,
        rootMargin: "0px 0px -200px 0px",
        threshold: Array.from({ length: 41 }, (_, i) => i / 40)
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const el = entry.target;

            let ratio = entry.intersectionRatio;
            if (ratio < 0) ratio = 0;
            if (ratio > 1) ratio = 1;

            let t = ratio / MIN_FULL_RATIO;
            if (t > 1) t = 1;

            if (el.classList.contains("ilmi-flow-step")) {
                el.style.transform = `scale(${t})`;
                el.style.opacity = t;
            }

            if (el.classList.contains("ilmi-flow-line")) {
                el.style.transform = `scaleY(${t})`;
                el.style.opacity = t;
            }
        });
    }, options);

    steps.forEach((step) => {
        step.style.transform = "scale(0)";
        step.style.opacity = "0";
        observer.observe(step);
    });

    lines.forEach((line) => {
        line.style.transform = "scaleY(0)";
        line.style.opacity = "0";
        observer.observe(line);
    });
});

// typing effect
document.addEventListener("DOMContentLoaded", () => {

    const texts = [
        "ILMI - ҳар қадамда сиз билан!",
        "Дунёнинг қайси нуқтасида бўлманг,",
        "қайси вақт минтақасида яшаманг,",
        "ILMI сизнинг ривожланишингизни таъминлайди.",
        "ILMI - сизнинг янги босқичга чиқишингиз учун барчаси шу ерда!"
    ];

    const el = document.getElementById("typing");
    if (!el) return;

    let i = 0;
    let char = 0;
    let deleting = false;

    function type() {
        const current = texts[i];

        if (!deleting) {
            el.textContent = current.substring(0, char + 1);
            char++;

            if (char === current.length) {
                deleting = true;
                setTimeout(type, 1200);
                return;
            }
        } else {
            el.textContent = current.substring(0, char - 1);
            char--;

            if (char === 0) {
                deleting = false;
                i = (i + 1) % texts.length;
            }
        }

        setTimeout(type, deleting ? 35 : 55);
    }

    type();
});

// intl-tel-input для формы внизу
document.addEventListener("DOMContentLoaded", function () {
    const phoneInput = document.querySelector("#phone");
    if (!phoneInput || !window.intlTelInput) return;

    const iti = window.intlTelInput(phoneInput, {
        initialCountry: "uz",
        preferredCountries: ["uz", "ru", "kz"],
        separateDialCode: true,
        nationalMode: false,
        utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js"
    });

    const form = phoneInput.closest("form");
    if (form) {
        form.addEventListener("submit", function () {
            const fullNumber = iti.getNumber();
            phoneInput.value = fullNumber;
        });
    }
});

// ==========================
// ДАННЫЕ ОТЗЫВОВ
// ==========================
const reviewsData = [
  {
    name: "ГУЛШОДА",
    text: `Шу эфирдан кейин ҳаётим “до” ва “после” бўлиб қолди. Олдин бир сўмга қаттиқлик қилиб, эконом қиламан дердим, пул барибир кетаверарди. Бараканинг аслида қандай кўпайишини билиб, онгим очилди. Амирахон, сизга раҳмат – қарашларимни ўзгартириб, баракамни оширишни ўргатдингиз.`
  },
  {
    name: "НИГИНА",
    text: `Вооой, это нечто, қизлар. Амира опа, Паризода опа, Азиза опа – яхшиям борсизлар. Шу видеода ўзимнинг кўп хатоларимни кўрдим ва бой бўлиш учун нима қилишим кераклигини тушундим.`
  },
  {
    name: "РОЗАХОН",
    text: `Спасибо огромное за этот урок! Были моменты, когда мурашки по коже бежали! Я поняла, что готова к новому, к лучшему и что я этого достойна.\nБлагодаря вашим эфирам сменила старую нелюбимую работу на новую, которая приносит непередаваемое удовольствие и деньги каждый день!`
  },
  {
    name: "НОДИРА",
    text: `Амира, отангизга раҳмат! Бир қарашда оддий кўринадиган мавзуни шунақа чуқур ўргатиб, очиб берибсиз – қойил қолдим. “Мени гапиряптику бу қиз”, деб эфирни йиғлаб кўрдим.\нЭртадан мен бошқа Нодира бўламан: шукр қилиб, ниятни пок қилиб, барака ичида яшайман.`
  },
  {
    name: "ДИЛЯ",
    text: `Шу эфирдан кейин машина олдим. Қачондан бери орзу қилиб юрардим, лекин ҳеч журъат қилолмасдим – худди машина олсам, пулим тугаб қоладигандек.\nАмира опа кўзимни очдингиз. Ҳозир оппоқ янги Cobalt ҳайдаб юрибман ва пул яна келаяпти, баракам ошди, минг шукр.`
  },
  {
    name: "ДИЛБАР",
    text: `Мен Нукусдан кўрдим эфирни. Ҳар бир гап эгасини топадиган бўлди – шартта-шартта тушунтирибсизлар.\nАввало Аллоҳга, кейин шу эфирни ташкил қилганларга раҳмат. Пулимни қандай кўпайтиришни, нима бизнес қилишни энди биламан!`
  },
  {
    name: "ЗАРИНАХОН",
    text: `Кўпинча ўзимизни ўзимиз камбағал қиларканмиз нотўғри установкалар билан. Кейин “Эй Худо, нега менга пул бермайсан?” деб хафа бўлиб юрамиз.\нЭфирда мени Аллоҳ севишини ва баракали аёл эканимни тушундим. Раҳмат эфир учун.`
  },
  {
    name: "ГУЛРУХ",
    text: `Менинг баракамни кесадиган установкаларим кўп экан. Шу курсдан кейин ўзимга яхши қарайдиган, эрим билан очиқ ва эркин муносабат қиладиган бўлдим.\нЛайли-мажнунга айландик: гуллар, совғалар, шоколадлар – деярли ҳар ҳафта мени сийлайдилар.`
  },
  {
    name: "БАРНО",
    text: `“Бойлар ёмон, бой бўлсанг проблеманг кўпаяди, бойлар зиқна” деган гаплар билан катта бўлганмиз. Шунинг учун бойлик ёмон деб ўйлардим.\нКурсдан кейин бу фикрлардан қутилдим. Бойлик ичкаридан бошланишини тушуниб, ҳозир пул потогига очилганман.`
  }
];

// STACK отзывов
document.addEventListener("DOMContentLoaded", () => {
    const stackEl = document.getElementById("reviewStack");
    if (!stackEl) return;

    const cards = Array.from(stackEl.querySelectorAll(".review-card-stack-item"));
    if (!cards.length) return;

    let currentIndex = 0;
    let isAnimating = false;

    function putDataIntoCard(cardEl, reviewIndex) {
        const nameEl = cardEl.querySelector(".review-name");
        const textEl = cardEl.querySelector(".review-text");
        const avatarEl = cardEl.querySelector(".review-avatar");

        const data = reviewsData[reviewIndex];

        if (nameEl)   nameEl.textContent = data.name;
        if (textEl)   textEl.textContent = data.text;
        if (avatarEl) avatarEl.textContent = data.name[0] || "A";
    }

    function applyContentForCurrentState() {
        cards.forEach(card => {
            const pos = Number(card.dataset.pos);
            const reviewIdx = (currentIndex + pos) % reviewsData.length;
            putDataIntoCard(card, reviewIdx);
        });
    }

    function initStack() {
        cards.forEach((card, i) => {
            card.dataset.pos = i;
            card.classList.remove("stack-pos-0", "stack-pos-1", "stack-pos-2");
            card.classList.add(`stack-pos-${i}`);
        });
        applyContentForCurrentState();
    }

    function rotate(direction) {
        if (isAnimating) return;
        isAnimating = true;

        if (direction === 1) currentIndex = (currentIndex + 1) % reviewsData.length;
        else currentIndex = (currentIndex - 1 + reviewsData.length) % reviewsData.length;

        cards.forEach(card => {
            let pos = Number(card.dataset.pos);

            if (direction === 1) pos = (pos + 1) % 3;
            else pos = (pos + 2) % 3;

            card.dataset.pos = pos;
            card.classList.remove("stack-pos-0", "stack-pos-1", "stack-pos-2");
            card.classList.add(`stack-pos-${pos}`);
        });

        setTimeout(() => {
            applyContentForCurrentState();
            isAnimating = false;
        }, 300);
    }

    stackEl.addEventListener("click", () => rotate(1));

    let touchStartX = null;
    stackEl.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].clientX;
    });
    stackEl.addEventListener("touchend", e => {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;

        if (Math.abs(dx) > 40) {
            if (dx < 0) rotate(1);
            else rotate(-1);
        }
        touchStartX = null;
    });

    // выравнивание высоты карточек по самой большой
    function setUnifiedReviewHeight() {
        if (!cards.length) return;

        const tempCard = cards[0];
        const tempInner = tempCard.querySelector(".review-card-inner");
        if (!tempInner) return;

        tempInner.style.height = "auto";

        let maxH = 0;

        for (let i = 0; i < reviewsData.length; i++) {
            putDataIntoCard(tempCard, i);
            const h = tempInner.offsetHeight;
            if (h > maxH) maxH = h;
        }

        applyContentForCurrentState();

        cards.forEach(card => {
            const inner = card.querySelector(".review-card-inner");
            if (inner) inner.style.height = maxH + "px";
        });

        stackEl.style.height = maxH + "px";
    }

    initStack();
    setUnifiedReviewHeight();

    window.addEventListener("resize", () => {
        cards.forEach(card => {
            const inner = card.querySelector(".review-card-inner");
            if (inner) inner.style.height = "auto";
        });
        stackEl.style.height = "auto";

        setUnifiedReviewHeight();
    });
});

// ================= INIT ГЛАВНЫЙ =================
document.addEventListener("DOMContentLoaded", () => {
    safeFetch(`${ANALYTICS_BASE}/page-view/`, {
        session_id: SESSION_ID,
        page_path: window.location.pathname || "/",
        user_agent: navigator.userAgent || ""
    });

    setupSectionObserver();
    initClickTracking();
    initTrailerPlayer();
    initFreeLessonModal();
});
