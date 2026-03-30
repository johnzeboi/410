/**
 * SkillSwap — client-side demo: reports, bans, messages, analytics, calendar helper.
 * Wire to a real API for production.
 */
(function (window) {
  var KEYS = {
    BANS: "skillswap_bans",
    REPORTS: "skillswap_reports",
    MESSAGES: "skillswap_messages_v1",
    ANALYTICS: "skillswap_analytics_v1",
    SCHOOL: "skillswap_school_verified",
    SESSIONS: "skillswap_sessions_v1",
    REFERRAL: "skillswap_referral_code",
  };

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (e) {
      return fallback;
    }
  }

  function getJSON(key, fallback) {
    return safeParse(localStorage.getItem(key) || "null", fallback);
  }

  function setJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getBans() {
    var b = getJSON(KEYS.BANS, []);
    return Array.isArray(b) ? b : [];
  }

  function setBans(ids) {
    setJSON(KEYS.BANS, ids);
  }

  function banUser(id) {
    id = String(id);
    var b = getBans();
    if (b.indexOf(id) === -1) {
      b.push(id);
      setBans(b);
    }
    logEvent("admin_ban", { userId: id });
  }

  function unbanUser(id) {
    id = String(id);
    setBans(getBans().filter(function (x) {
      return x !== id;
    }));
    logEvent("admin_unban", { userId: id });
  }

  function isBanned(id) {
    return getBans().indexOf(String(id)) !== -1;
  }

  function getReports() {
    var r = getJSON(KEYS.REPORTS, []);
    return Array.isArray(r) ? r : [];
  }

  function addReport(entry) {
    var list = getReports();
    list.unshift(
      Object.assign(
        {
          id: "r-" + Date.now(),
          at: new Date().toISOString(),
        },
        entry
      )
    );
    setJSON(KEYS.REPORTS, list);
    logEvent("report_submitted", { type: entry.type || "user" });
  }

  function logEvent(name, payload) {
    var ev = getJSON(KEYS.ANALYTICS, []);
    if (!Array.isArray(ev)) ev = [];
    ev.push({
      name: name,
      payload: payload || {},
      t: Date.now(),
    });
    if (ev.length > 500) ev = ev.slice(-500);
    setJSON(KEYS.ANALYTICS, ev);
  }

  function getAnalyticsSummary() {
    var ev = getJSON(KEYS.ANALYTICS, []);
    if (!Array.isArray(ev)) ev = [];
    var byName = {};
    ev.forEach(function (e) {
      byName[e.name] = (byName[e.name] || 0) + 1;
    });
    return { events: ev, byName: byName, total: ev.length };
  }

  function getMessages() {
    var m = getJSON(KEYS.MESSAGES, null);
    if (m && typeof m === "object") return m;
    return null;
  }

  function defaultThreads() {
    return {
      jordan: {
        title: "Jordan Lee",
        peerRole: "tutor",
        messages: [
          { from: "them", text: "Hey! Ready for calc tonight? 🧮", t: Date.now() - 86400000 },
          { from: "me", text: "Yes — can we focus on related rates?", t: Date.now() - 86000000 },
        ],
      },
      sam: {
        title: "Sam Rivera",
        peerRole: "tutor",
        messages: [
          { from: "them", text: "Send your assignment PDF when you can.", t: Date.now() - 3600000 },
        ],
      },
    };
  }

  function ensureMessages() {
    var m = getMessages();
    if (!m) {
      m = defaultThreads();
      setJSON(KEYS.MESSAGES, m);
    }
    return m;
  }

  function saveMessages(m) {
    setJSON(KEYS.MESSAGES, m);
  }

  function appendChat(threadId, from, text) {
    var m = ensureMessages();
    if (!m[threadId]) return;
    m[threadId].messages.push({ from: from, text: text, t: Date.now() });
    saveMessages(m);
    logEvent("message_sent", { thread: threadId });
  }

  function getSchoolVerified() {
    return localStorage.getItem(KEYS.SCHOOL) === "1";
  }

  function setSchoolVerified(v) {
    if (v) localStorage.setItem(KEYS.SCHOOL, "1");
    else localStorage.removeItem(KEYS.SCHOOL);
  }

  function referralCode() {
    var existing = localStorage.getItem(KEYS.REFERRAL);
    if (!existing) {
      existing = "SW-" + Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900);
      localStorage.setItem(KEYS.REFERRAL, existing);
    }
    return existing;
  }

  function renderCalendar(container, year, month, eventDays) {
    if (!container) return;
    eventDays = eventDays || {};
    var first = new Date(year, month, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = new Date();
    var isToday = function (d) {
      return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var head =
      '<div class="calendar-nav"><button type="button" class="btn btn--ghost btn--sm" data-cal-prev aria-label="Previous month">←</button><h2>' +
      monthNames[month] +
      " " +
      year +
      '</h2><button type="button" class="btn btn--ghost btn--sm" data-cal-next aria-label="Next month">→</button></div>';
    var grid = '<div class="calendar-grid">';
    var labels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    labels.forEach(function (L) {
      grid += '<div class="cal-head">' + L + "</div>";
    });
    var prevMonthDays = new Date(year, month, 0).getDate();
    for (var i = 0; i < startPad; i++) {
      var d = prevMonthDays - startPad + i + 1;
      grid += '<div class="cal-cell cal-cell--muted">' + d + "</div>";
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var cls = "cal-cell";
      if (isToday(day)) cls += " cal-cell--today";
      if (eventDays[day]) cls += " cal-cell--event";
      grid += '<div class="' + cls + '" data-day="' + day + '">' + day + "</div>";
    }
    var totalCells = startPad + daysInMonth;
    var rem = totalCells % 7;
    if (rem !== 0) {
      for (var j = 1; j <= 7 - rem; j++) {
        grid += '<div class="cal-cell cal-cell--muted">' + j + "</div>";
      }
    }
    grid += "</div>";
    container.innerHTML = head + grid;
    container.dataset.year = String(year);
    container.dataset.month = String(month);

    container.querySelector("[data-cal-prev]").addEventListener("click", function () {
      var m = month - 1;
      var y = year;
      if (m < 0) {
        m = 11;
        y--;
      }
      renderCalendar(container, y, m, eventDays);
    });
    container.querySelector("[data-cal-next]").addEventListener("click", function () {
      var m = month + 1;
      var y = year;
      if (m > 11) {
        m = 0;
        y++;
      }
      renderCalendar(container, y, m, eventDays);
    });
  }

  function initReportModal() {
    var overlay = document.getElementById("report-modal");
    if (!overlay) return;
    var form = document.getElementById("report-form");
    var targetInput = document.getElementById("report-target");
    var roleInput = document.getElementById("report-target-role");
    var closeEls = overlay.querySelectorAll("[data-close-report]");

    function open(targetName, targetRole) {
      if (targetInput) targetInput.value = targetName || "";
      if (roleInput) roleInput.value = targetRole || "tutor";
      overlay.hidden = false;
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }

    function close() {
      overlay.classList.remove("is-open");
      document.body.style.overflow = "";
      setTimeout(function () {
        overlay.hidden = true;
      }, 200);
    }

    document.querySelectorAll("[data-report-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        open(btn.getAttribute("data-report-user"), btn.getAttribute("data-report-role"));
      });
    });

    closeEls.forEach(function (el) {
      el.addEventListener("click", close);
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var type = (document.getElementById("report-type") || {}).value || "safety";
        var details = (document.getElementById("report-details") || {}).value || "";
        addReport({
          reporter: "You (demo)",
          target: targetInput ? targetInput.value : "",
          targetRole: roleInput ? roleInput.value : "",
          type: type,
          details: details,
        });
        alert("Report submitted (demo — stored in this browser only). Admins can review it on the Admin page.");
        close();
        form.reset();
      });
    }
  }

  function initMessagesPage() {
    var listEl = document.getElementById("thread-list");
    var paneTitle = document.getElementById("msg-pane-title");
    var paneBody = document.getElementById("msg-pane-body");
    var input = document.getElementById("msg-input");
    var form = document.getElementById("msg-form");
    if (!listEl || !paneBody) return;

    var threads = ensureMessages();
    var currentId = Object.keys(threads)[0];

    function renderList() {
      listEl.innerHTML = "";
      Object.keys(threads).forEach(function (id) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = threads[id].title;
        btn.setAttribute("aria-current", id === currentId ? "true" : "false");
        btn.addEventListener("click", function () {
          currentId = id;
          renderList();
          renderThread();
        });
        li.appendChild(btn);
        listEl.appendChild(li);
      });
    }

    function renderThread() {
      var t = threads[currentId];
      if (!t) return;
      if (paneTitle) paneTitle.textContent = t.title;
      paneBody.innerHTML = "";
      t.messages.forEach(function (m) {
        var div = document.createElement("div");
        div.className = "msg-bubble " + (m.from === "me" ? "msg-bubble--me" : "msg-bubble--them");
        div.textContent = m.text;
        paneBody.appendChild(div);
      });
      paneBody.scrollTop = paneBody.scrollHeight;
    }

    renderList();
    renderThread();

    if (form && input) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        appendChat(currentId, "me", text);
        threads = ensureMessages();
        input.value = "";
        renderThread();
      });
    }
  }

  function initAdminPage() {
    var tbody = document.querySelector("[data-admin-users]");
    if (!tbody) return;

    var demoUsers = [
      { id: "u1", name: "Jordan Lee", role: "Tutor", sessions: 34 },
      { id: "u2", name: "Sam Rivera", role: "Tutor", sessions: 51 },
      { id: "u3", name: "Alex Chen", role: "Tutor", sessions: 19 },
      { id: "s1", name: "Jamie Student", role: "Student", sessions: 12 },
      { id: "s2", name: "Riley Kim", role: "Student", sessions: 8 },
    ];

    function renderUsers() {
      var bans = getBans();
      tbody.innerHTML = "";
      demoUsers.forEach(function (u) {
        var banned = bans.indexOf(u.id) !== -1;
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          u.name +
          "</td><td>" +
          u.role +
          "</td><td>" +
          u.sessions +
          '</td><td><span class="' +
          (banned ? "badge-ban" : "status-pill status-pill--ok") +
          '">' +
          (banned ? "Banned" : "Active") +
          "</span></td><td>" +
          (banned
            ? '<button type="button" class="btn btn--secondary btn--sm" data-unban="' +
              u.id +
              '">Unban</button>'
            : '<button type="button" class="btn btn--danger btn--sm" data-ban="' + u.id + '">Ban</button>') +
          "</td>";
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll("[data-ban]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          banUser(btn.getAttribute("data-ban"));
          renderUsers();
        });
      });
      tbody.querySelectorAll("[data-unban]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          unbanUser(btn.getAttribute("data-unban"));
          renderUsers();
        });
      });
    }

    renderUsers();

    var repBody = document.querySelector("[data-admin-reports]");
    if (repBody) {
      function renderReports() {
        var reps = getReports();
        repBody.innerHTML = "";
        if (!reps.length) {
          repBody.innerHTML = "<tr><td colspan='4'>No reports yet.</td></tr>";
          return;
        }
        reps.slice(0, 25).forEach(function (r) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" +
            (r.at || "").slice(0, 19).replace("T", " ") +
            "</td><td>" +
            (r.target || "") +
            "</td><td>" +
            (r.type || "") +
            "</td><td>" +
            (r.details || "").slice(0, 80) +
            (r.details && r.details.length > 80 ? "…" : "") +
            "</td>";
          repBody.appendChild(tr);
        });
      }
      renderReports();
    }

    var volEl = document.getElementById("analytics-volume");
    var perfEl = document.getElementById("analytics-tutor-perf");
    if (volEl || perfEl) {
      var s = getAnalyticsSummary();
      if (volEl) {
        volEl.innerHTML =
          "<p><strong>Total tracked events:</strong> " +
          s.total +
          "</p>" +
          "<p class='admin-note'>Demo analytics stay in your browser (localStorage). In production, stream events to your analytics backend.</p>";
      }
      if (perfEl) {
        var tutors = [
          { name: "Jordan Lee", score: 92 },
          { name: "Sam Rivera", score: 98 },
          { name: "Alex Chen", score: 78 },
        ];
        var extra = s.byName.page_view || 0;
        perfEl.innerHTML = "";
        tutors.forEach(function (t) {
          var w = Math.min(100, t.score - 10 + (extra % 7));
          var row = document.createElement("div");
          row.className = "analytics-bar";
          row.innerHTML =
            "<span>" +
            t.name +
            '</span><div class="analytics-bar__track"><div class="analytics-bar__fill" style="width:' +
            w +
            '%"></div></div><span>' +
            w +
            "%</span>";
          perfEl.appendChild(row);
        });
      }
    }
  }

  function initDashboardPage() {
    var schoolBtn = document.getElementById("school-verify-btn");
    var schoolStatus = document.getElementById("school-status");
    if (schoolStatus) {
      schoolStatus.innerHTML = getSchoolVerified()
        ? '<span class="status-pill status-pill--ok">School verified ✓</span>'
        : '<span class="status-pill status-pill--pending">Not verified — use a .edu email</span>';
    }
    if (schoolBtn) {
      schoolBtn.addEventListener("click", function () {
        var email = (document.getElementById("school-email") || {}).value || "";
        if (email.indexOf(".edu") !== -1) {
          setSchoolVerified(true);
          logEvent("school_verified", {});
          if (schoolStatus) {
            schoolStatus.innerHTML = '<span class="status-pill status-pill--ok">School verified ✓ (demo)</span>';
          }
          alert("Demo: your .edu looks good. A real app would email a magic link.");
        } else {
          alert("Please enter a school email ending in .edu (demo check).");
        }
      });
    }

    var codeDemo = document.getElementById("session-code-demo");
    if (codeDemo) {
      codeDemo.textContent = "847291";
    }

    var verifyStudent = document.getElementById("verify-student-btn");
    var verifyTutor = document.getElementById("verify-tutor-btn");
    var studentInput = document.getElementById("verify-code-input");
    if (verifyStudent && studentInput) {
      verifyStudent.addEventListener("click", function () {
        if (studentInput.value.replace(/\s/g, "") === "847291") {
          logEvent("session_verified_student", {});
          alert("Session verified on your side (demo).");
        } else {
          alert("Code does not match — ask your tutor for the 6-digit code.");
        }
      });
    }
    if (verifyTutor) {
      verifyTutor.addEventListener("click", function () {
        logEvent("session_verified_tutor", {});
        alert("Marked complete for tutor (demo). Both sides can log verification in a real backend.");
      });
    }

    var refDisplay = document.getElementById("referral-code");
    if (refDisplay) refDisplay.textContent = referralCode();

    var copyBtn = document.getElementById("referral-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(referralCode()).then(function () {
          logEvent("referral_copy", {});
          alert("Copied referral code!");
        });
      });
    }

    var calHost = document.getElementById("dashboard-calendar");
    if (calHost) {
      var now = new Date();
      renderCalendar(calHost, now.getFullYear(), now.getMonth(), { 5: true, 12: true, 18: true, 22: true });
    }
  }

  function initSchedulePage() {
    var calHost = document.getElementById("schedule-calendar");
    if (calHost) {
      var now = new Date();
      renderCalendar(calHost, now.getFullYear(), now.getMonth(), { 3: true, 7: true, 14: true, 21: true, 28: true });
    }
  }

  function trackPageView() {
    var path = window.location.pathname.split("/").pop() || "index.html";
    logEvent("page_view", { page: path });
  }

  window.SkillSwap = {
    KEYS: KEYS,
    getBans: getBans,
    banUser: banUser,
    unbanUser: unbanUser,
    isBanned: isBanned,
    addReport: addReport,
    getReports: getReports,
    logEvent: logEvent,
    getAnalyticsSummary: getAnalyticsSummary,
    renderCalendar: renderCalendar,
    initReportModal: initReportModal,
    initMessagesPage: initMessagesPage,
    initAdminPage: initAdminPage,
    initDashboardPage: initDashboardPage,
    initSchedulePage: initSchedulePage,
    trackPageView: trackPageView,
    referralCode: referralCode,
  };

  document.addEventListener("DOMContentLoaded", function () {
    trackPageView();
    initReportModal();
    if (document.getElementById("thread-list")) initMessagesPage();
    if (document.querySelector("[data-admin-users]")) initAdminPage();
    if (document.getElementById("dashboard-calendar")) initDashboardPage();
    if (document.getElementById("schedule-calendar")) initSchedulePage();
  });
})(window);
