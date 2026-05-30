// Automatically unregister any conflicting service workers from previous projects on localhost
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    if (registrations.length > 0) {
      for (const registration of registrations) {
        registration.unregister();
      }
      console.log("Cleaned up conflicting localhost service workers.");
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  });
}

/* 
 * App Controller: Digital Anxiety Intervention Research Project
 * Orchestrates SPA routing, page rendering, event handling, and SVG visualizations.
 */

class AppController {
  constructor() {
    this.currentUser = null;
    this.activeView = "landing";
    this.selectedFeedbackRatings = {
      usability: 0,
      clarity: 0,
      trust: 0,
      usefulness: 0,
      personalization: 0,
      ruleUnderstanding: 0,
      continueUse: 0
    };
  }

  async init() {
    // Check session on load
    await this.checkSession();

    // Listen to hash routing
    window.addEventListener("hashchange", () => this.handleRouting());
    
    // Initial routing
    await this.handleRouting();
    
    // Setup general listeners
    this.setupListeners();
  }

  async checkSession() {
    this.currentUser = await DB.getCurrentUser();
    this.updateNavbar();
  }

  calculateTrends(assessments) {
    if (!assessments || assessments.length === 0) {
      return {
        daily: { val: "--", desc: "No assessment logged yet." },
        weekly: { val: "--", desc: "No assessment logged yet." },
        monthly: { val: "--", desc: "No assessment logged yet." }
      };
    }

    const latest = assessments[assessments.length - 1];
    
    // 1. Daily Progress: Compare latest log with previous log
    let dailyVal = "--";
    let dailyDesc = "Log assessment tomorrow to calculate daily trend.";
    
    if (assessments.length > 1) {
      const prev = assessments[assessments.length - 2];
      const timeDiff = latest.timestamp - prev.timestamp;
      const daysDiff = Math.round(timeDiff / (24 * 60 * 60 * 1000));
      const diff = latest.score - prev.score;
      const sign = diff > 0 ? "+" : "";
      
      dailyVal = `${sign}${diff}`;
      if (diff > 0) {
        dailyDesc = "Anxiety increased compared to your last check-in. Focus on grounding exercises.";
      } else if (diff < 0) {
        dailyDesc = "Anxiety decreased compared to your last check-in. Continue with your support routines.";
      } else {
        dailyDesc = "Anxiety remained stable compared to your last check-in. Consistency supports stabilization.";
      }
    }

    // 2. Weekly Progress: Compare last 7 days average with prior 7 days average (days 8-14)
    let weeklyVal = "--";
    let weeklyDesc = "Requires at least 7 days of historical logs.";
    
    const refTime = latest.timestamp;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    const timeBuffer = 60 * 60 * 1000; // 1 hour buffer for boundary timestamps
    
    // Check if the user has data spanning at least 7 days (earliest log is >= 7 days ago relative to latest log)
    const firstLog = assessments[0];
    if (refTime - firstLog.timestamp >= oneWeekMs - timeBuffer) {
      const thisWeekLogs = assessments.filter(a => {
        const age = refTime - a.timestamp;
        return age >= 0 && age < oneWeekMs;
      });
      const lastWeekLogs = assessments.filter(a => {
        const age = refTime - a.timestamp;
        return age >= oneWeekMs && age <= twoWeeksMs + timeBuffer;
      });
      
      if (thisWeekLogs.length > 0 && lastWeekLogs.length > 0) {
        const thisWeekAvg = thisWeekLogs.reduce((sum, a) => sum + a.score, 0) / thisWeekLogs.length;
        const lastWeekAvg = lastWeekLogs.reduce((sum, a) => sum + a.score, 0) / lastWeekLogs.length;
        
        const diff = thisWeekAvg - lastWeekAvg;
        const sign = diff > 0 ? "+" : "";
        weeklyVal = `${sign}${diff.toFixed(1)}`;
        if (diff > 0) {
          weeklyDesc = "Weekly average anxiety increased. Consider scheduling structured activity goals.";
        } else if (diff < 0) {
          weeklyDesc = "Weekly average anxiety decreased. Your scheduled habits are showing positive results.";
        } else {
          weeklyDesc = "Weekly average anxiety is stable. Continue maintaining your current strategies.";
        }
      } else {
        weeklyDesc = "Insufficient daily logs in comparing weeks.";
      }
    }

    // 3. Monthly Progress: Compare last 30 days average with prior 30 days average (days 31-60)
    let monthlyVal = "--";
    let monthlyDesc = "Requires at least 30 days of historical logs.";
    
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const twoMonthsMs = 60 * 24 * 60 * 60 * 1000;
    
    if (refTime - firstLog.timestamp >= oneMonthMs - timeBuffer) {
      const thisMonthLogs = assessments.filter(a => {
        const age = refTime - a.timestamp;
        return age >= 0 && age < oneMonthMs;
      });
      const lastMonthLogs = assessments.filter(a => {
        const age = refTime - a.timestamp;
        return age >= oneMonthMs && age <= twoMonthsMs + timeBuffer;
      });
      
      if (thisMonthLogs.length > 0 && lastMonthLogs.length > 0) {
        const thisMonthAvg = thisMonthLogs.reduce((sum, a) => sum + a.score, 0) / thisMonthLogs.length;
        const lastMonthAvg = lastMonthLogs.reduce((sum, a) => sum + a.score, 0) / lastMonthLogs.length;
        
        const diff = thisMonthAvg - lastMonthAvg;
        const sign = diff > 0 ? "+" : "";
        monthlyVal = `${sign}${diff.toFixed(1)}`;
        if (diff > 0) {
          monthlyDesc = "Monthly average anxiety increased. Reach out to your supportive contacts or professional help.";
        } else if (diff < 0) {
          monthlyDesc = "Monthly average anxiety decreased. Steady progress over the month stabilizes wellbeing.";
        } else {
          monthlyDesc = "Monthly average anxiety is stable. Consistent check-ins build long-term emotional balance.";
        }
      } else {
        monthlyDesc = "Insufficient daily logs in comparing months.";
      }
    }

    return {
      daily: { val: dailyVal, desc: dailyDesc },
      weekly: { val: weeklyVal, desc: weeklyDesc },
      monthly: { val: monthlyVal, desc: monthlyDesc }
    };
  }

  renderTrend(valueId, descId, trendData) {
    const valEl = document.getElementById(valueId);
    const descEl = document.getElementById(descId);
    if (!valEl || !descEl) return;

    valEl.innerText = trendData.val;
    descEl.innerText = trendData.desc;

    // Reset styles
    valEl.style.color = "var(--text-primary)";

    // Style dynamically based on value
    let circleId = "";
    if (valueId === "prog-trend-daily-val") circleId = "pathway-daily-circle";
    else if (valueId === "prog-trend-weekly-val") circleId = "pathway-weekly-circle";
    else if (valueId === "prog-trend-monthly-val") circleId = "pathway-monthly-circle";
    else if (valueId === "dash-trend-daily-val") circleId = "dash-daily-circle";
    else if (valueId === "dash-trend-weekly-val") circleId = "dash-weekly-circle";
    else if (valueId === "dash-trend-monthly-val") circleId = "dash-monthly-circle";

    const circleEl = document.getElementById(circleId);
    if (circleEl) {
      circleEl.style.borderColor = "var(--border-color)"; // Reset default
    }

    if (trendData.val !== "--") {
      const num = parseFloat(trendData.val);
      if (num < 0) {
        valEl.style.color = "var(--accent-sage)"; // Improvement (Anxiety decreased)
        if (circleEl) circleEl.style.borderColor = "var(--accent-sage)";
      } else if (num > 0) {
        valEl.style.color = "var(--alert-red)";   // Regression (Anxiety increased)
        if (circleEl) circleEl.style.borderColor = "var(--alert-red)";
      } else {
        if (circleEl) circleEl.style.borderColor = "var(--accent-slate)";
      }
    }
  }

  getSeverityFromScore(score) {
    const numericScore = Number(score) || 0;
    if (numericScore >= 15) return "Severe";
    if (numericScore >= 10) return "Moderate";
    if (numericScore >= 5) return "Mild";
    return "Minimal";
  }

  renderAttentionBanner(indicators, gad7Score) {
    const banner = document.getElementById("attention-banner");
    const itemsList = document.getElementById("attention-items-list");
    const subtitle = document.getElementById("attention-banner-subtitle");
    if (!banner || !itemsList) return;

    // Each item: { label, score, scoreMax, advice, isHigh }
    const attentionItems = [];

    if (indicators.sleep < 4) {
      attentionItems.push({
        label: "Poor Sleep Quality",
        score: `${indicators.sleep}/10`,
        advice: "Low sleep quality is strongly linked to anxiety amplification. Try a consistent wind-down routine, limit screens before bed, and consider relaxation techniques like progressive muscle relaxation.",
        isHigh: indicators.sleep <= 2
      });
    }
    if (indicators.avoidance > 6) {
      attentionItems.push({
        label: "High Avoidance Behaviors",
        score: `${indicators.avoidance}/10`,
        advice: "Avoidance provides short-term relief but strengthens anxiety long-term. Gradual, structured exposure to avoided situations is a core evidence-based strategy. Consider starting with the least feared tasks.",
        isHigh: indicators.avoidance >= 9
      });
    }
    if (indicators.concentration < 4) {
      attentionItems.push({
        label: "Impaired Concentration",
        score: `${indicators.concentration}/10`,
        advice: "Difficulty concentrating is a common anxiety symptom. Breaking tasks into smaller steps, scheduled focus blocks, and mindfulness exercises can help rebuild attentional control.",
        isHigh: indicators.concentration <= 2
      });
    }
    if (indicators.irritability > 6) {
      attentionItems.push({
        label: "Elevated Irritability",
        score: `${indicators.irritability}/10`,
        advice: "High irritability often signals emotional exhaustion or unmet needs. Regular physical activity, time boundaries, and communication strategies can reduce reactivity.",
        isHigh: indicators.irritability >= 9
      });
    }
    if (indicators.tension > 6) {
      attentionItems.push({
        label: "High Physical Tension",
        score: `${indicators.tension}/10`,
        advice: "Muscle tension and physical anxiety symptoms benefit from body-focused practices such as diaphragmatic breathing, stretching, or progressive muscle relaxation exercises.",
        isHigh: indicators.tension >= 9
      });
    }
    if (indicators.withdrawal > 6) {
      attentionItems.push({
        label: "Social Withdrawal",
        score: `${indicators.withdrawal}/10`,
        advice: "Withdrawing socially can reinforce feelings of isolation and worry. Small, low-pressure social interactions — even brief ones — help rebuild a sense of connection and normalcy.",
        isHigh: indicators.withdrawal >= 9
      });
    }
    if (indicators.functioning < 4) {
      attentionItems.push({
        label: "Impaired Daily Functioning",
        score: `${indicators.functioning}/10`,
        advice: "When anxiety affects your ability to complete daily tasks, prioritizing and simplifying your routine can help. Focus on essentials first and allow yourself recovery time.",
        isHigh: indicators.functioning <= 2
      });
    }
    if (indicators.confidence < 4) {
      attentionItems.push({
        label: "Low Coping Confidence",
        score: `${indicators.confidence}/10`,
        advice: "Low confidence in managing anxiety is addressable. Reviewing past successes, using structured coping plans, and incremental challenges can steadily rebuild self-efficacy.",
        isHigh: indicators.confidence <= 2
      });
    }
    if (gad7Score >= 10) {
      attentionItems.push({
        label: "Moderate–Severe GAD-7",
        score: `${gad7Score}/21`,
        advice: "Your GAD-7 score is in the moderate-to-severe range. Recommendations in this program are active to support you. Please also consider consulting a mental health professional.",
        isHigh: gad7Score >= 15
      });
    }

    if (attentionItems.length === 0) {
      banner.style.display = "none";
      return;
    }

    // Render card grid
    itemsList.innerHTML = "";
    attentionItems.forEach(item => {
      const el = document.createElement("div");
      el.className = "attention-item";
      el.innerHTML = `
        <div class="attention-item-top">
          <div class="attention-item-label">${item.label}</div>
          <span class="attention-item-badge ${item.isHigh ? 'high' : 'moderate'}">${item.score}</span>
        </div>
        <div class="attention-item-advice">${item.advice}</div>
      `;
      itemsList.appendChild(el);
    });

    const highCount = attentionItems.filter(i => i.isHigh).length;
    if (subtitle) {
      subtitle.innerText = `${attentionItems.length} flagged${highCount > 0 ? ` · ${highCount} critical` : ""}`;
    }
    banner.style.display = "block";
  }

  updateNavbar() {

    const nav = document.getElementById("main-nav");
    const brand = document.getElementById("nav-brand");
    if (!nav) return;

    if (!this.currentUser) {
      brand.href = "#landing";
      nav.innerHTML = `
        <a href="#landing">Home</a>
        <a href="#auth">Login / Register</a>
        <a href="#safety">Crisis Help</a>
      `;
    } else if (!this.currentUser.isConsentGiven) {
      brand.href = "#consent";
      nav.innerHTML = `
        <a href="#consent" class="active">Study Consent</a>
        <button onclick="app.logout()">Log Out</button>
      `;
    } else if (this.currentUser.isAdmin) {
      brand.href = "#admin";
      nav.innerHTML = `
        <a href="#admin">Admin Panel</a>
        <button onclick="app.logout()">Log Out</button>
      `;
    } else {
      brand.href = "#dashboard";
      nav.innerHTML = `
        <a href="#dashboard">Dashboard</a>
        <a href="#progress">Progress</a>
        <a href="#history">History</a>
        <a href="#rules-logic">Rules</a>
        <a href="#feedback">Feedback</a>
        <a href="#clinician-report">Clinician Summary</a>
        <a href="#safety">Crisis Help</a>
        <button onclick="app.logout()" style="color: var(--alert-red);">Logout</button>
      `;
    }

    // Highlight current hash
    const currentHash = window.location.hash || "#landing";
    const links = nav.querySelectorAll("a");
    links.forEach(link => {
      if (link.getAttribute("href") === currentHash) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  async handleRouting() {
    const hash = window.location.hash.replace("#", "") || "landing";
    
    // Guard routes based on auth status
    if (!this.currentUser) {
      if (hash !== "landing" && hash !== "auth" && hash !== "safety") {
        window.location.hash = "#landing";
        return;
      }
    } else {
      // User is logged in
      if (!this.currentUser.isConsentGiven) {
        if (hash !== "consent") {
          window.location.hash = "#consent";
          return;
        }
      } else if (this.currentUser.isAdmin) {
        if (hash !== "admin") {
          window.location.hash = "#admin";
          return;
        }
      } else {
        // Regular consented user trying to access landing/auth
        if (hash === "landing" || hash === "auth" || hash === "consent" || hash === "admin") {
          window.location.hash = "#dashboard";
          return;
        }
        if (hash === "assessment") {
          const assessments = await DB.getAssessments(this.currentUser.email);
          if (assessments.length > 0) {
            const latest = assessments[assessments.length - 1];
            const nextCheckinTime = latest.timestamp + (24 * 60 * 60 * 1000); // 24 hours lock
            if (Date.now() < nextCheckinTime) {
              alert(`Your next assessment is scheduled for ${new Date(nextCheckinTime).toLocaleString()}. You cannot check in until that time.`);
              window.location.hash = "#dashboard";
              return;
            }
          }
        }
      }
    }

    this.activeView = hash;
    await this.renderView(hash);
    this.updateNavbar();
  }

  navigateTo(view, mode = null) {
    if (view === "auth" && mode) {
      window.location.hash = `#auth`;
      setTimeout(() => {
        const submitBtn = document.getElementById("auth-submit-btn");
        if (submitBtn) {
          const currentMode = submitBtn.innerText === "Register" ? "signup" : "login";
          if (mode !== currentMode) {
            this.toggleAuthMode();
          }
        }
      }, 50);
    } else {
      window.location.hash = `#${view}`;
    }
  }

  async logout() {
    await DB.logout();
    this.currentUser = null;
    window.location.hash = "#landing";
    this.updateNavbar();
  }

  setupListeners() {
    // Reset range sliders in weekly assessment to show correct values
    document.querySelectorAll('#view-assessment input[type="range"]').forEach(input => {
      input.value = 5;
    });
  }

  // Render Page Content
  async renderView(view) {
    // Hide all views, display current
    document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
    const activeEl = document.getElementById(`view-${view}`);
    if (activeEl) {
      activeEl.classList.add("active");
    }

    // Trigger page-specific loaders
    switch (view) {
      case "dashboard":
        await this.loadDashboard();
        break;
      case "results":
        await this.loadResults();
        break;
      case "progress":
        await this.loadProgress();
        break;
      case "history":
        await this.loadHistory();
        break;
      case "rules-logic":
        this.loadRulesLogic();
        break;
      case "feedback":
        await this.loadFeedbackForm();
        break;
      case "clinician-report":
        await this.loadClinicianReport();
        break;
      case "admin":
        await this.loadAdminDashboard();
        break;
    }
  }

  // 1. Landing View - static
  // 2. Auth View - Sign-up / Login Page
  toggleAuthMode() {
    const title = document.getElementById("auth-title");
    const desc = document.getElementById("auth-desc");
    const submitBtn = document.getElementById("auth-submit-btn");
    const toggleBtn = document.getElementById("auth-toggle-btn");
    const nameGroup = document.getElementById("group-full-name");
    const nameInput = document.getElementById("auth-full-name");

    if (submitBtn.innerText === "Register") {
      title.innerText = "Participant Login";
      desc.innerText = "Log in with your email and password to access your dashboard.";
      submitBtn.innerText = "Log In";
      toggleBtn.innerText = "Need an account? Register";
      if (nameGroup) nameGroup.style.display = "none";
      if (nameInput) nameInput.removeAttribute("required");
    } else {
      title.innerText = "Create Participant Account";
      desc.innerText = "Enter your email and name details below. Your personal identity is kept minimal for privacy compliance.";
      submitBtn.innerText = "Register";
      toggleBtn.innerText = "Already registered? Login";
      if (nameGroup) nameGroup.style.display = "block";
      if (nameInput) nameInput.setAttribute("required", "required");
    }
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const isRegister = document.getElementById("auth-submit-btn").innerText === "Register";

    const submitBtn = document.getElementById("auth-submit-btn");
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    try {
      if (isRegister) {
        const studyCode = "P-" + Math.floor(100 + Math.random() * 900);
        const fullName = document.getElementById("auth-full-name").value;
        const res = await DB.signUp(email, password, studyCode, fullName);
        if (res.success) {
          this.currentUser = res.user;
          window.location.hash = this.currentUser.isAdmin ? "#admin" : "#consent";
        } else {
          alert(res.message);
        }
      } else {
        const res = await DB.login(email, password);
        if (res.success) {
          this.currentUser = res.user;
          if (this.currentUser.isAdmin) {
            window.location.hash = "#admin";
          } else {
            window.location.hash = this.currentUser.isConsentGiven ? "#dashboard" : "#consent";
          }
        } else {
          alert(res.message);
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      alert("An error occurred during authentication.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }

  // 3. Consent View
  async handleConsentSubmit(e) {
    e.preventDefault();
    if (this.currentUser) {
      await DB.giveConsent(this.currentUser.email);
      this.currentUser.isConsentGiven = true;
      window.location.hash = "#dashboard";
    }
  }

  // 4. User Dashboard Loader
  async loadDashboard() {
    if (!this.currentUser) return;
    
    document.getElementById("dash-participant-id").innerText = this.currentUser.participantId;
    const nameEl = document.getElementById("dash-participant-name");
    if (nameEl) {
      nameEl.innerText = this.currentUser.fullName || "Participant";
    }
    
    const assessments = await DB.getAssessments(this.currentUser.email);
    const completions = await DB.getCompletions(this.currentUser.email);
    const coping = await DB.getCopingPlan(this.currentUser.email);
    
    const reminderBanner = document.getElementById("checkin-reminder-banner");
    const safetyBanner = document.getElementById("clinical-safety-banner");
    
    // Check if there are assessments
    const logBtn = document.getElementById("dash-log-btn");
    const checkinDesc = document.getElementById("dash-next-checkin-desc");

    if (assessments.length === 0) {
      document.getElementById("dash-latest-score").innerText = "--";
      document.getElementById("dash-latest-severity").innerText = "No assessment logged";
      document.getElementById("dash-latest-severity").className = "severity-indicator";
      document.getElementById("dash-latest-date").innerText = "Please complete your baseline assessment.";
      document.getElementById("dash-next-checkin-val").innerText = "Immediate";
      if (checkinDesc) checkinDesc.innerText = "Please complete your first assessment to begin study tracks.";
      if (logBtn) logBtn.removeAttribute("disabled");
      reminderBanner.style.display = "block";
      safetyBanner.style.display = "none";
      
      const emptyTrend = { val: "--", desc: "Please complete your baseline assessment." };
      this.renderTrend("dash-trend-daily-val", "dash-trend-daily-desc", emptyTrend);
      this.renderTrend("dash-trend-weekly-val", "dash-trend-weekly-desc", emptyTrend);
      this.renderTrend("dash-trend-monthly-val", "dash-trend-monthly-desc", emptyTrend);

      const summaryContainer = document.getElementById("dash-active-interventions-summary");
      if (summaryContainer) {
        summaryContainer.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">No active interventions yet. Log your baseline check-in to generate suggestions.</span>`;
      }
      const logHistoryList = document.getElementById("dash-log-history-list");
      if (logHistoryList) {
        logHistoryList.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">No log history available yet. Please complete your baseline check-in.</span>`;
      }

      const attentionBannerEl = document.getElementById("attention-banner");
      if (attentionBannerEl) attentionBannerEl.style.display = "none";
      return;
    }

    const latest = assessments[assessments.length - 1];
    
    // Set Latest Stats
    document.getElementById("dash-latest-score").innerText = latest.score;
    const severityBadge = document.getElementById("dash-latest-severity");
    severityBadge.innerText = latest.severity + " Anxiety";
    severityBadge.className = "severity-indicator " + latest.severity.toLowerCase();

    const formattedDate = new Date(latest.timestamp).toLocaleDateString();
    document.getElementById("dash-latest-date").innerText = `Completed on: ${formattedDate}`;

    // Manage Check-in Reminder: 24 hours lock
    const nextCheckinTime = latest.timestamp + (24 * 60 * 60 * 1000); // 24 hours lock
    const nextCheckinDate = new Date(nextCheckinTime);
    const nextCheckinDateString = nextCheckinDate.toLocaleString();
    const isOverdue = Date.now() >= nextCheckinTime;
    
    if (isOverdue) {
      document.getElementById("dash-next-checkin-val").innerText = `Open Now`;
      document.getElementById("dash-next-checkin-val").style.color = "var(--notification-red)";
      if (checkinDesc) checkinDesc.innerText = "Your daily check-in is open. You may log your assessment.";
      if (logBtn) logBtn.removeAttribute("disabled");
      reminderBanner.style.display = "block";
    } else {
      document.getElementById("dash-next-checkin-val").innerText = nextCheckinDateString;
      document.getElementById("dash-next-checkin-val").style.color = "var(--text-primary)";
      if (checkinDesc) checkinDesc.innerText = "You cannot log another assessment until the scheduled time.";
      if (logBtn) logBtn.setAttribute("disabled", "disabled");
      reminderBanner.style.display = "none";
    }

    // Render GAD-7 clinical progress trends on dashboard
    const trends = this.calculateTrends(assessments);
    this.renderTrend("dash-trend-daily-val", "dash-trend-daily-desc", trends.daily);
    this.renderTrend("dash-trend-weekly-val", "dash-trend-weekly-desc", trends.weekly);
    this.renderTrend("dash-trend-monthly-val", "dash-trend-monthly-desc", trends.monthly);

    // Manage Safety Banner for severe GAD-7 scores
    if (latest.score >= 15) {
      safetyBanner.style.display = "block";
    } else {
      safetyBanner.style.display = "none";
    }

    // Render Flagged Indicators Checklist
    const indicatorsList = document.getElementById("dash-indicators-list");
    indicatorsList.innerHTML = "";
    
    const flags = [];
    if (latest.indicators.sleep < 4) flags.push(`Sleep Quality: Poor (${latest.indicators.sleep}/10)`);
    if (latest.indicators.avoidance > 6) flags.push(`Avoidance Behaviors: High (${latest.indicators.avoidance}/10)`);
    if (latest.indicators.concentration < 4) flags.push(`Concentration: Impaired (${latest.indicators.concentration}/10)`);
    if (latest.indicators.irritability > 6) flags.push(`Irritability: High (${latest.indicators.irritability}/10)`);
    if (latest.indicators.tension > 6) flags.push(`Muscle/Physical Tension: High (${latest.indicators.tension}/10)`);
    if (latest.indicators.withdrawal > 6) flags.push(`Social Withdrawal: High (${latest.indicators.withdrawal}/10)`);
    if (latest.indicators.functioning < 4) flags.push(`Daily Functioning: Impaired (${latest.indicators.functioning}/10)`);
    if (latest.indicators.confidence < 4) flags.push(`Coping Confidence: Low (${latest.indicators.confidence}/10)`);
    
    if (flags.length === 0) {
      indicatorsList.innerHTML = "<li>All checked indicators fall in healthy levels.</li>";
    } else {
      flags.forEach(flag => {
        indicatorsList.innerHTML += `<li>${flag}</li>`;
      });
    }

    // Render Areas That Need Attention banner
    this.renderAttentionBanner(latest.indicators, latest.score);

    // Load coping status message

    if (coping.triggers || coping.strategies || coping.supports) {
      document.getElementById("dash-coping-status").innerText = "Your coping plan is active. Take a moment to review it.";
    } else {
      document.getElementById("dash-coping-status").innerText = "Your plan has not been filled out yet. Click below to establish anchors.";
    }

    // Load recent journal note
    const journals = await DB.getJournal(this.currentUser.email);
    const recentJournal = document.getElementById("dash-recent-journal");
    if (journals.length > 0) {
      const recent = journals[0];
      recentJournal.innerHTML = `
        <strong>Last Logged (${new Date(recent.timestamp).toLocaleDateString()}):</strong><br>
        Mood: ${recent.mood}/10<br>
        Note: "${recent.note.substring(0, 80)}${recent.note.length > 80 ? '...' : ''}"
      `;
    } else {
      recentJournal.innerHTML = "No recent entries. Keeping a journal helps map triggers.";
    }

    // Render Active Interventions Summary Card
    const activeRecommendations = RulesEngine.evaluateRules(assessments, completions);
    const summaryContainer = document.getElementById("dash-active-interventions-summary");
    if (summaryContainer) {
      if (activeRecommendations.length === 0) {
        summaryContainer.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">No active interventions yet. Log your baseline check-in to generate suggestions.</span>`;
      } else {
        const itemsHtml = activeRecommendations.map(rec => {
          const isCompleted = completions.some(c => c.recommendationId === rec.id);
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding: 0.2rem 0; border-bottom: 1px dashed var(--border-color); font-weight: 500;">
              <span style="color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 75%;">${rec.title}</span>
              <span class="severity-indicator ${isCompleted ? 'mild' : 'moderate'}" style="font-size: 0.7rem; padding: 0.05rem 0.3rem;">
                ${isCompleted ? '✓ Done' : 'Active'}
              </span>
            </div>
          `;
        }).join('');
        summaryContainer.innerHTML = itemsHtml;
      }
    }

    // Render Log History
    const logHistoryList = document.getElementById("dash-log-history-list");
    if (logHistoryList) {
      if (assessments.length === 0) {
        logHistoryList.innerHTML = `<span style="font-style: italic; color: var(--text-secondary);">No log history available yet. Please complete your baseline check-in.</span>`;
      } else {
        // Render in reverse chronological order
        const historyHtml = [...assessments].reverse().map(a => {
          const dateLogged = new Date(a.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' });
          const upcomingTime = a.timestamp + (24 * 60 * 60 * 1000);
          const upcomingDate = new Date(upcomingTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
          const severity = a.severity || this.getSeverityFromScore(a.score);
          const severityClass = severity.toLowerCase();
          return `
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-weight: 600; color: var(--text-primary);">📅 ${dateLogged}</span>
                <span class="severity-indicator ${severityClass}" style="font-size: 0.75rem; padding: 0.1rem 0.4rem;">
                  Logged (Score: ${a.score}/21 - ${severity} Anxiety)
                </span>
              </div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">
                ⏰ Next Check-In: ${upcomingDate}
              </div>
            </div>
          `;
        }).join('');
        logHistoryList.innerHTML = historyHtml;
      }
    }

  }

  async toggleInterventionCompletion(recId, isChecked) {
    if (!this.currentUser) return;
    await DB.toggleIntervention(this.currentUser.email, recId, isChecked);
    // Refresh the progress view where recs now live
    await this.loadProgress();
  }

  // 5. Weekly Assessment Form Submission
  updateSliderLabel(name, val) {
    const valEl = document.getElementById(`val-${name}`);
    if (valEl) valEl.innerText = val;
  }

  async handleAssessmentSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    // Collect GAD-7 answers
    const gad7Answers = [];
    for (let i = 1; i <= 7; i++) {
      const selected = document.querySelector(`input[name="gad7_q${i}"]:checked`);
      if (!selected) {
        alert("Please answer all 7 GAD-7 questions.");
        return;
      }
      gad7Answers.push(parseInt(selected.value, 10));
    }

    // Collect Behavioral indicators
    const indicators = {
      sleep: document.getElementById("ind-sleep").value,
      avoidance: document.getElementById("ind-avoidance").value,
      concentration: document.getElementById("ind-concentration").value,
      irritability: document.getElementById("ind-irritability").value,
      tension: document.getElementById("ind-tension").value,
      withdrawal: document.getElementById("ind-withdrawal").value,
      functioning: document.getElementById("ind-functioning").value,
      confidence: document.getElementById("ind-confidence").value,
      triggers: document.getElementById("ind-triggers").value,
      support: document.getElementById("ind-support").value
    };

    // Disable submit button / show loader
    const submitBtn = document.querySelector('#view-assessment button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "Saving...";

    try {
      // Save GAD-7 assessment
      await DB.saveAssessment(this.currentUser.email, gad7Answers, indicators);

      // Reset Form sliders back to default
      document.querySelectorAll('#view-assessment input[type="radio"]').forEach(el => el.checked = false);
      document.querySelectorAll('#view-assessment input[type="range"]').forEach(input => {
        input.value = 5;
      });
      document.getElementById("ind-triggers").value = "";
      document.getElementById("ind-support").selectedIndex = 0;
      
      // Reset labels
      ["sleep", "avoidance", "concentration", "irritability", "tension", "withdrawal", "functioning", "confidence"].forEach(lbl => {
        this.updateSliderLabel(lbl, 5);
      });

      // Go to Results View
      window.location.hash = "#results";
    } catch (err) {
      console.error("Assessment submit error:", err);
      alert("An error occurred while saving your assessment.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }

  // 6. Results View Page Loader
  async loadResults() {
    if (!this.currentUser) return;
    const assessments = await DB.getAssessments(this.currentUser.email);
    if (assessments.length === 0) {
      window.location.hash = "#dashboard";
      return;
    }

    const latest = assessments[assessments.length - 1];
    
    document.getElementById("results-score-val").innerText = latest.score;
    const severityBadge = document.getElementById("results-severity-badge");
    severityBadge.innerText = latest.severity + " Anxiety";
    severityBadge.className = "severity-indicator " + latest.severity.toLowerCase();

    // Render safety warning if severe GAD-7 score
    const safetyBox = document.getElementById("results-safety-box");
    if (latest.score >= 15) {
      safetyBox.style.display = "block";
    } else {
      safetyBox.style.display = "none";
    }

    // Load flagged items
    const flagsList = document.getElementById("results-flags-list");
    flagsList.innerHTML = "";
    const flags = [];
    if (latest.indicators.sleep < 4) flags.push(`Physiological Sleep quality is poor (${latest.indicators.sleep}/10)`);
    if (latest.indicators.avoidance > 6) flags.push(`Avoidance behaviour remains high (${latest.indicators.avoidance}/10)`);
    if (latest.indicators.concentration < 4) flags.push(`Focus limits daily productivity (${latest.indicators.concentration}/10)`);
    if (latest.indicators.irritability > 6) flags.push(`Irritability or low emotional buffers (${latest.indicators.irritability}/10)`);
    if (latest.indicators.tension > 6) flags.push(`Muscle tension, strain, or distress (${latest.indicators.tension}/10)`);
    if (latest.indicators.withdrawal > 6) flags.push(`Social interaction avoidance (${latest.indicators.withdrawal}/10)`);
    if (latest.indicators.functioning < 4) flags.push(`Impaired daily task management (${latest.indicators.functioning}/10)`);
    if (latest.indicators.confidence < 4) flags.push(`Low coping self-efficacy (${latest.indicators.confidence}/10)`);
    
    if (flags.length === 0) {
      flagsList.innerHTML = "<li>No clinical indicators flagged this cycle.</li>";
    } else {
      flags.forEach(f => {
        flagsList.innerHTML += `<li>${f}</li>`;
      });
    }

    // Render active adaptive recommendations
    const completions = await DB.getCompletions(this.currentUser.email);
    const activeRecommendations = RulesEngine.evaluateRules(assessments, completions);
    const recsContainer = document.getElementById("results-recs-container");
    recsContainer.innerHTML = "";

    activeRecommendations.forEach(rec => {
      const recEl = document.createElement("div");
      recEl.className = "rec-list-item";
      recEl.innerHTML = `
        <div class="rec-title-row">
          <div>
            <span class="severity-indicator" style="margin-bottom: 0.25rem;">${rec.category}</span>
            <h4>${rec.title}</h4>
          </div>
        </div>
        <p style="margin: 0.25rem 0; font-size: 0.9rem;">${rec.description}</p>
        <div class="rec-rule">
          <strong>Rule logic:</strong> ${rec.ruleTriggered}
        </div>
        <div style="margin-top: 0.5rem;">
          <button class="btn btn-info btn-small" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
            onclick="app.showExplanation('${rec.title}', '${rec.reason}', '${rec.ruleTriggered}')">
            Why am I seeing this?
          </button>
        </div>
      `;
      recsContainer.appendChild(recEl);
    });
  }

  // Explanation Modal Handling
  showExplanation(title, reason, rule) {
    document.getElementById("exp-title").innerText = `Recommendation: ${title}`;
    document.getElementById("exp-reason").innerText = reason;
    document.getElementById("exp-rule").innerText = rule;

    document.getElementById("explanation-modal").classList.add("active");
  }

  closeExplanation() {
    document.getElementById("explanation-modal").classList.remove("active");
  }

  // 7. Progress & Coping Plan View Loader
  async loadProgress() {
    if (!this.currentUser) return;

    const assessments = await DB.getAssessments(this.currentUser.email);
    const completions = await DB.getCompletions(this.currentUser.email);
    const coping = await DB.getCopingPlan(this.currentUser.email);

    // --- Recommended Interventions ---
    const activeRecommendations = RulesEngine.evaluateRules(assessments, completions);
    const recsList = document.getElementById("progress-recs-list");
    const noRecsPlaceholder = document.getElementById("no-recs-placeholder");
    const baselineBtn = document.getElementById("prog-baseline-btn");

    if (activeRecommendations.length === 0) {
      if (noRecsPlaceholder) noRecsPlaceholder.style.display = "block";
      if (recsList) recsList.style.display = "none";
      if (baselineBtn) baselineBtn.style.display = assessments.length === 0 ? "block" : "none";
    } else {
      if (noRecsPlaceholder) noRecsPlaceholder.style.display = "none";
      if (baselineBtn) baselineBtn.style.display = "none";
      if (recsList) {
        recsList.style.display = "flex";
        recsList.innerHTML = "";
        activeRecommendations.forEach(rec => {
          const isCompleted = completions.some(c => c.recommendationId === rec.id);
          const recEl = document.createElement("div");
          recEl.className = `rec-list-item ${isCompleted ? 'completed' : ''}`;

          let dynamicCopingInfo = "";
          if (rec.id === "additional_coping" && coping.strategies) {
            dynamicCopingInfo = `
              <div style="margin: 0.5rem 0; padding: 0.6rem 0.8rem; background-color: var(--accent-sage-light); border: 1px solid var(--border-color); font-size: 0.85rem;">
                <strong>Your Custom Coping Plan Strategies:</strong>
                <p style="margin: 0.2rem 0 0 0; font-style: italic; color: var(--text-primary); font-weight: 500;">${coping.strategies}</p>
              </div>`;
          } else if (rec.id === "crisis_guidance" && coping.supports) {
            dynamicCopingInfo = `
              <div style="margin: 0.5rem 0; padding: 0.6rem 0.8rem; background-color: var(--alert-red-light); border: 1px solid var(--alert-red); font-size: 0.85rem;">
                <strong>Your Stored Emergency Supports:</strong>
                <p style="margin: 0.2rem 0 0 0; font-style: italic; color: var(--alert-red); font-weight: 500;">${coping.supports}</p>
              </div>`;
          }

          recEl.innerHTML = `
            <div class="rec-title-row">
              <div>
                <span class="severity-indicator" style="margin-bottom: 0.25rem;">${rec.category}</span>
                <h4>${rec.title}</h4>
              </div>
              <div class="action-control">
                <span class="action-status ${isCompleted ? 'completed' : 'pending'}">
                  ${isCompleted ? 'Completed' : 'To do'}
                </span>
                <input type="checkbox" id="chk-rec-${rec.id}" ${isCompleted ? 'checked' : ''}
                  class="action-checkbox"
                  onchange="app.toggleInterventionCompletion('${rec.id}', this.checked)">
              </div>
            </div>
            <p style="margin: 0.25rem 0; font-size: 0.9rem;">${rec.description}</p>
            ${dynamicCopingInfo}
            <div class="flex-row-space" style="margin-top: 0.5rem;">
              <button class="btn btn-info btn-small" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                onclick="app.showExplanation('${rec.title}', '${rec.reason}', '${rec.ruleTriggered}')">
                Why am I seeing this?
              </button>
              ${isCompleted ? '<span class="action-status completed">Completed</span>' : '<span class="action-status pending">Try this next</span>'}
            </div>
          `;
          recsList.appendChild(recEl);
        });
      }
    }

    // Draw GAD-7 graph
    this.drawProgressGraph(assessments);

    // Load progress feedback analysis text
    const analysisText = document.getElementById("progress-analysis-txt");
    const focusAreas = document.getElementById("progress-focus-areas");
    

    if (assessments.length === 0) {
      const emptyTrend = { val: "--", desc: "Please complete your baseline assessment." };
      this.renderTrend("prog-trend-daily-val", "prog-trend-daily-desc", emptyTrend);
      this.renderTrend("prog-trend-weekly-val", "prog-trend-weekly-desc", emptyTrend);
      this.renderTrend("prog-trend-monthly-val", "prog-trend-monthly-desc", emptyTrend);
      
      analysisText.innerHTML = "Please complete your baseline check-in to begin progress tracking.";
      focusAreas.innerText = "";
    } else {
      // Render clinical trends grids on progress page
      const trends = this.calculateTrends(assessments);
      this.renderTrend("prog-trend-daily-val", "prog-trend-daily-desc", trends.daily);
      this.renderTrend("prog-trend-weekly-val", "prog-trend-weekly-desc", trends.weekly);
      this.renderTrend("prog-trend-monthly-val", "prog-trend-monthly-desc", trends.monthly);

      if (assessments.length < 2) {
        analysisText.innerHTML = "Log daily assessments to visualize your symptoms progression trends.";
        focusAreas.innerText = "";
      } else {
        const latest = assessments[assessments.length - 1];
        const prev = assessments[assessments.length - 2];
        const diff = latest.score - prev.score;
        
        let trendMsg = "";
        if (diff < 0) {
          trendMsg = `Your anxiety GAD-7 total decreased by <strong>${Math.abs(diff)}</strong> points compared to last check-in. This represents positive progress. Keep up your support activities.`;
        } else if (diff > 0) {
          trendMsg = `Your anxiety GAD-7 total increased by <strong>${diff}</strong> points. Remember that fluctuations are normal in self-care. Review your coping plan.`;
        } else {
          trendMsg = `Your GAD-7 score is stable at <strong>${latest.score}</strong>. Consistency allows steady stabilization of stress factors.`;
        }
        analysisText.innerHTML = trendMsg;

        // Identify focus indicators
        const badIndicators = [];
        if (latest.indicators.sleep < 4) badIndicators.push("poor sleep");
        if (latest.indicators.avoidance > 6) badIndicators.push("high avoidance");
        if (latest.indicators.tension > 6) badIndicators.push("physical body tension");
        if (latest.indicators.withdrawal > 6) badIndicators.push("social withdrawal");
        
        if (badIndicators.length > 0) {
          focusAreas.innerText = `Areas needing attention: ${badIndicators.join(", ")}.`;
        } else {
          focusAreas.innerText = "All measured physiological parameters remain stable.";
        }
      }
    }

    // Load completed activities list
    const completionsList = document.getElementById("progress-completions-list");
    completionsList.innerHTML = "";

    if (completions.length === 0) {
      completionsList.innerHTML = "<li>No activities logged as completed yet. Complete exercises on your dashboard to see improvements.</li>";
    } else {
      // Group by recommendation type and count
      const counts = {};
      completions.forEach(c => {
        counts[c.recommendationId] = (counts[c.recommendationId] || 0) + 1;
      });

      Object.keys(counts).forEach(id => {
        const item = RulesEngine.INTERVENTIONS[id];
        const title = item ? item.title : id;
        completionsList.innerHTML += `<li><strong>${title}</strong>: Completed ${counts[id]} time(s).</li>`;
      });
    }

    // Load Coping plan inputs
    document.getElementById("coping-triggers").value = coping.triggers || "";
    document.getElementById("coping-strategies").value = coping.strategies || "";
    document.getElementById("coping-supports").value = coping.supports || "";

    // Load Journal feed
    await this.loadJournalFeed();
  }

  // Draw pure SVG chart without any external plotting library
  drawProgressGraph(assessments) {
    const container = document.getElementById("progress-graph-wrapper");
    if (!container) return;

    if (assessments.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); margin: 2rem 0;">No assessment entries submitted yet.</p>`;
      return;
    }

    const showSleep = document.getElementById("toggle-overlay-sleep") ? document.getElementById("toggle-overlay-sleep").checked : false;
    const showAvoidance = document.getElementById("toggle-overlay-avoidance") ? document.getElementById("toggle-overlay-avoidance").checked : false;

    const svgWidth = 800;
    const svgHeight = 250;
    const padding = { top: 40, right: 30, bottom: 45, left: 50 };
    
    // GAD-7 is always 0 to 21
    const maxScore = 21;
    
    // Grid Lines for clinical severity levels
    const gridY = [
      { y: 5, label: "5 (Mild)", color: "var(--border-color)" },
      { y: 10, label: "10 (Mod)", color: "var(--border-color)" },
      { y: 15, label: "15 (Sev)", color: "var(--alert-red)" }
    ];

    let svgContent = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background-color: var(--bg-primary);">`;
    
    // Draw background severity horizontal limits
    gridY.forEach(grid => {
      const yPos = svgHeight - padding.bottom - (grid.y / maxScore) * (svgHeight - padding.top - padding.bottom);
      svgContent += `
        <line x1="${padding.left}" y1="${yPos}" x2="${svgWidth - padding.right}" y2="${yPos}" class="trend-grid-line" style="stroke: ${grid.color};" />
        <text x="${padding.left - 8}" y="${yPos + 4}" class="trend-label" text-anchor="end">${grid.label}</text>
      `;
    });

    // Draw baseline 0 y-axis line
    const zeroY = svgHeight - padding.bottom;
    svgContent += `<line x1="${padding.left}" y1="${zeroY}" x2="${svgWidth - padding.right}" y2="${zeroY}" style="stroke: var(--text-primary); stroke-width: 1;" />`;

    // Coordinates calculations
    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;
    
    const stepX = assessments.length > 1 ? chartWidth / (assessments.length - 1) : chartWidth;

    // 1. Calculate GAD-7 points
    const points = [];
    assessments.forEach((item, index) => {
      const x = padding.left + (assessments.length > 1 ? index * stepX : chartWidth / 2);
      const y = svgHeight - padding.bottom - (item.score / maxScore) * chartHeight;
      points.push({ x, y, item });
    });

    // 2. Calculate Sleep points (0-10 scale)
    const sleepPoints = [];
    if (showSleep) {
      assessments.forEach((item, index) => {
        const x = padding.left + (assessments.length > 1 ? index * stepX : chartWidth / 2);
        const y = svgHeight - padding.bottom - (item.indicators.sleep / 10) * chartHeight;
        sleepPoints.push({ x, y, val: item.indicators.sleep });
      });
    }

    // 3. Calculate Avoidance points (0-10 scale)
    const avoidancePoints = [];
    if (showAvoidance) {
      assessments.forEach((item, index) => {
        const x = padding.left + (assessments.length > 1 ? index * stepX : chartWidth / 2);
        const y = svgHeight - padding.bottom - (item.indicators.avoidance / 10) * chartHeight;
        avoidancePoints.push({ x, y, val: item.indicators.avoidance });
      });
    }

    // Draw Sleep line & points
    if (showSleep && sleepPoints.length > 0) {
      if (sleepPoints.length > 1) {
        let pathD = `M ${sleepPoints[0].x} ${sleepPoints[0].y}`;
        for (let i = 1; i < sleepPoints.length; i++) {
          pathD += ` L ${sleepPoints[i].x} ${sleepPoints[i].y}`;
        }
        svgContent += `<path d="${pathD}" style="fill: none; stroke: var(--accent-slate); stroke-width: 1.5; stroke-dasharray: 4;" />`;
      }
      sleepPoints.forEach(pt => {
        svgContent += `
          <rect x="${pt.x - 3.5}" y="${pt.y - 3.5}" width="7" height="7" style="fill: var(--accent-slate); cursor: pointer;" 
            onclick="alert('Sleep Quality: ${pt.val}/10')" />
          <text x="${pt.x}" y="${pt.y - 8}" class="trend-label" text-anchor="middle" style="fill: var(--accent-slate); font-weight: 500;">S:${pt.val}</text>
        `;
      });
    }

    // Draw Avoidance line & points
    if (showAvoidance && avoidancePoints.length > 0) {
      if (avoidancePoints.length > 1) {
        let pathD = `M ${avoidancePoints[0].x} ${avoidancePoints[0].y}`;
        for (let i = 1; i < avoidancePoints.length; i++) {
          pathD += ` L ${avoidancePoints[i].x} ${avoidancePoints[i].y}`;
        }
        svgContent += `<path d="${pathD}" style="fill: none; stroke: var(--alert-red); stroke-width: 1.5; stroke-dasharray: 4;" />`;
      }
      avoidancePoints.forEach(pt => {
        svgContent += `
          <polygon points="${pt.x},${pt.y-4.5} ${pt.x+4.5},${pt.y} ${pt.x},${pt.y+4.5} ${pt.x-4.5},${pt.y}" style="fill: var(--alert-red); cursor: pointer;" 
            onclick="alert('Avoidance Level: ${pt.val}/10')" />
          <text x="${pt.x}" y="${pt.y + 12}" class="trend-label" text-anchor="middle" style="fill: var(--alert-red); font-weight: 500;">A:${pt.val}</text>
        `;
      });
    }

    // Draw GAD-7 line & points (drawn last to remain on top)
    if (points.length > 1) {
      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }
      svgContent += `<path d="${pathD}" class="trend-line" />`;
    }

    points.forEach(pt => {
      const formattedDate = new Date(pt.item.timestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      svgContent += `
        <circle cx="${pt.x}" cy="${pt.y}" r="5" class="trend-point" 
          onclick="alert('Date: ${formattedDate}\\nGAD-7 Score: ${pt.item.score} (${pt.item.severity})\\nSleep Quality: ${pt.item.indicators.sleep}/10\\nAvoidance: ${pt.item.indicators.avoidance}/10')" />
        <text x="${pt.x}" y="${pt.y - 10}" class="trend-label" text-anchor="middle" style="font-weight: 600; fill: var(--text-primary);">${pt.item.score}</text>
        <text x="${pt.x}" y="${svgHeight - 15}" class="trend-label" text-anchor="middle" transform="rotate(-15, ${pt.x}, ${svgHeight - 15})">${formattedDate}</text>
      `;
    });

    // Draw Legend
    svgContent += `
      <g transform="translate(${svgWidth - 365}, 10)" style="font-size: 10px; font-family: var(--font-sans);">
        <rect width="350" height="20" fill="var(--bg-secondary)" stroke="var(--border-color)" />
        
        <line x1="10" y1="10" x2="25" y2="10" style="stroke: var(--accent-sage); stroke-width: 2.5;" />
        <circle cx="17.5" cy="10" r="3" style="fill: var(--accent-sage);" />
        <text x="32" y="13" class="trend-label" style="fill: var(--text-primary); font-weight: 500;">GAD-7 Score</text>
        
        <line x1="120" y1="10" x2="135" y2="10" style="stroke: var(--accent-slate); stroke-width: 1.5; stroke-dasharray: 2;" />
        <rect x="124.5" y="7" width="6" height="6" style="fill: var(--accent-slate);" />
        <text x="142" y="13" class="trend-label" style="fill: var(--text-primary); font-weight: 500;">Sleep (0-10)</text>
        
        <line x1="230" y1="10" x2="245" y2="10" style="stroke: var(--alert-red); stroke-width: 1.5; stroke-dasharray: 2;" />
        <polygon points="237.5,7 240.5,10 237.5,13 234.5,10" style="fill: var(--alert-red);" />
        <text x="252" y="13" class="trend-label" style="fill: var(--text-primary); font-weight: 500;">Avoidance (0-10)</text>
      </g>
    `;

    svgContent += `</svg>`;
    container.innerHTML = svgContent;
  }

  async handleCopingSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const triggers = document.getElementById("coping-triggers").value;
    const strategies = document.getElementById("coping-strategies").value;
    const supports = document.getElementById("coping-supports").value;

    await DB.saveCopingPlan(this.currentUser.email, triggers, strategies, supports);
    alert("Coping plan saved successfully.");
  }

  async handleJournalSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const mood = document.getElementById("journal-mood").value;
    const triggers = document.getElementById("journal-triggers").value;
    const note = document.getElementById("journal-note").value;

    await DB.saveJournalEntry(this.currentUser.email, mood, triggers, note);
    
    // Clear note inputs
    document.getElementById("journal-note").value = "";
    document.getElementById("journal-triggers").value = "";
    document.getElementById("journal-mood").selectedIndex = 4; // Reset to mood 5

    // Refresh view
    await this.loadProgress();
  }

  async loadJournalFeed() {
    const journalFeed = document.getElementById("journal-entries-feed");
    if (!journalFeed) return;

    const entries = await DB.getJournal(this.currentUser.email);
    journalFeed.innerHTML = "";

    if (entries.length === 0) {
      journalFeed.innerHTML = "<p class='slider-desc'>No journal entries recorded. Add your first entry above.</p>";
      return;
    }

    entries.forEach(e => {
      const dateStr = new Date(e.timestamp).toLocaleString();
      const div = document.createElement("div");
      div.className = "journal-log-entry";
      div.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">
          ${dateStr} | Mood Score: <strong>${e.mood}/10</strong>
        </div>
        ${e.triggers ? `<p class="slider-desc" style="margin: 0.1rem 0;">Triggers: <em>${e.triggers}</em></p>` : ''}
        <p style="margin-top: 0.25rem; font-size: 0.92rem; color: var(--text-primary); font-weight: 400;">"${e.note}"</p>
      `;
      journalFeed.appendChild(div);
    });
  }

  // 8. Recommendation History Page Loader
  async loadHistory() {
    if (!this.currentUser) return;

    const assessments = await DB.getAssessments(this.currentUser.email);
    const completions = await DB.getCompletions(this.currentUser.email);
    const container = document.getElementById("history-list-container");
    container.innerHTML = "";

    if (assessments.length === 0) {
      container.innerHTML = "<p>Submit a weekly check-in assessment to construct your recommendations feed history.</p>";
      return;
    }

    // Loop through history slices chronologically and evaluate rules retrospectively
    for (let idx = 0; idx < assessments.length; idx++) {
      const sliceAssessments = assessments.slice(0, idx + 1);
      const targetAssessment = assessments[idx];
      const dateStr = new Date(targetAssessment.timestamp).toLocaleDateString();
      const targetSeverity = targetAssessment.severity || this.getSeverityFromScore(targetAssessment.score);

      // Find recommendations active for that slice
      const sliceCompletions = completions.filter(c => c.timestamp <= targetAssessment.timestamp);
      const recs = RulesEngine.evaluateRules(sliceAssessments, sliceCompletions);

      const section = document.createElement("div");
      section.className = "history-entry";
      
      let recsHTML = "";
      recs.forEach(rec => {
        // Was it completed during this cycle?
        // A completion fits this cycle if it matches the ID and its timestamp aligns after this week but before the next assessment (if any)
        const nextAssessment = assessments[idx + 1];
        const hasCompleted = completions.some(c => {
          return c.recommendationId === rec.id && 
                 c.timestamp >= targetAssessment.timestamp &&
                 (!nextAssessment || c.timestamp < nextAssessment.timestamp);
        });

        // Pull stored rating feedback if exists
        const userRatingFeedback = DB.getRecommendationFeedback(this.currentUser.email);
        const feedbackEntry = userRatingFeedback.find(rf => rf.recommendationId === `${targetAssessment.id}_${rec.id}`);
        
        recsHTML += `
          <div class="history-action ${hasCompleted ? 'completed' : 'pending'}">
            <div class="flex-row-space">
              <strong>${rec.title}</strong>
              <span class="action-status ${hasCompleted ? 'completed' : 'pending'}">
                ${hasCompleted ? 'Completed' : 'Not completed'}
              </span>
            </div>
            <p style="font-size: 0.85rem; margin: 0.25rem 0;">${rec.description}</p>
            <p class="slider-desc" style="font-size: 0.8rem; margin: 0.1rem 0;">Trigger Rule: <code>${rec.ruleTriggered}</code></p>
            
            <!-- Usefulness Feedback for this recommended action in this weekly cycle -->
            <div style="border-top: 1px dashed var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
              <span class="slider-desc" style="font-weight: 500;">Rate usefulness:</span>
              <div style="display: flex; gap: 0.25rem; margin-top: 0.25rem;">
                ${[1,2,3,4,5].map(star => {
                  const isSel = feedbackEntry && feedbackEntry.rating === star;
                  return `
                    <button class="rating-btn btn-small ${isSel ? 'selected' : ''}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
                      onclick="app.saveRecUsefulnessFeedback('${targetAssessment.id}', '${rec.id}', ${star})">
                      ${star}
                    </button>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        `;
      });

      section.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">
          Assessment Cycle: ${dateStr} (GAD-7 Total: ${targetAssessment.score} - ${targetSeverity})
        </h3>
        ${recsHTML}
      `;
      container.appendChild(section);
    }
  }

  async saveRecUsefulnessFeedback(assessmentId, recId, rating) {
    if (!this.currentUser) return;
    const compoundId = `${assessmentId}_${recId}`;
    DB.saveRecommendationFeedback(this.currentUser.email, compoundId, rating, "Logged from history page");
    
    // Refresh history entries
    await this.loadHistory();
  }

  // 9. Transparent Rule Logic and Simulator
  loadRulesLogic() {
    const catalog = document.getElementById("rules-plain-english-catalog");
    if (!catalog) return;
    catalog.innerHTML = "";

    RulesEngine.TRANSPARENT_RULES.forEach(r => {
      catalog.innerHTML += `
        <div class="rule-logic-card">
          <h4 style="margin: 0; font-weight: 600;">${r.name}</h4>
          <code>${r.logic}</code>
          <p class="slider-desc" style="margin-top: 0.5rem; font-weight: 500;">Clinical rationale: <span style="font-weight: normal; color: var(--text-primary);">${r.rationale}</span></p>
        </div>
      `;
    });

    // Run simulator once
    this.runSimulator();
  }

  runSimulator() {
    const simScore = parseInt(document.getElementById("sim-gad7").value, 10);
    const simSleep = parseInt(document.getElementById("sim-sleep").value, 10);
    const simAvoidance = parseInt(document.getElementById("sim-avoidance").value, 10);
    const simTrend = document.getElementById("sim-previous").value;

    document.getElementById("sim-gad7-val").innerText = `Score: ${simScore}`;
    document.getElementById("sim-sleep-val").innerText = `Quality: ${simSleep}`;
    document.getElementById("sim-avoidance-val").innerText = `Avoidance: ${simAvoidance}`;

    // Construct mock assessments history
    const mockHistory = [];
    
    // If trend requires a previous score, construct pre-populate values
    if (simTrend === "increased") {
      mockHistory.push({ score: Math.max(0, simScore - 4), indicators: { sleep: 6, avoidance: 4 } });
    } else if (simTrend === "decreased") {
      // For consitently decreasing over 2 weeks we need 3 values
      mockHistory.push({ score: Math.min(21, simScore + 6), indicators: { sleep: 3, avoidance: 8 } });
      mockHistory.push({ score: Math.min(21, simScore + 3), indicators: { sleep: 4, avoidance: 7 } });
    } else if (simTrend === "stable") {
      mockHistory.push({ score: simScore, indicators: { sleep: simSleep, avoidance: simAvoidance } });
    }

    // Add latest assessment
    let severity = "Minimal";
    if (simScore >= 15) severity = "Severe";
    else if (simScore >= 10) severity = "Moderate";
    else if (simScore >= 5) severity = "Mild";

    mockHistory.push({
      score: simScore,
      severity: severity,
      indicators: {
        sleep: simSleep,
        avoidance: simAvoidance,
        concentration: 5,
        irritability: 5,
        tension: 5,
        withdrawal: 5,
        functioning: 5,
        triggers: "",
        confidence: 5,
        support: "No"
      }
    });

    // Mock completion logs (stable 100% completion for simulation baseline)
    const mockCompletions = [];

    // Run engine
    const results = RulesEngine.evaluateRules(mockHistory, mockCompletions);
    
    // Render results
    const output = document.getElementById("sim-results-output");
    output.innerHTML = "";

    if (results.length === 0) {
      output.innerHTML = "<p class='slider-desc'>No recommendations matched this state combination.</p>";
      return;
    }

    results.forEach(rec => {
      output.innerHTML += `
        <div class="rec-list-item" style="margin-bottom: 0.75rem;">
          <div class="flex-row-space">
            <strong>${rec.title}</strong>
            <span class="severity-indicator">${rec.category}</span>
          </div>
          <p style="font-size: 0.85rem; margin: 0.25rem 0;">${rec.description}</p>
          <div class="rec-rule">
            <strong>Trigger logic:</strong> ${rec.ruleTriggered}
          </div>
        </div>
      `;
    });
  }

  // 10. Research Feedback Form Loader
  async loadFeedbackForm() {
    if (!this.currentUser) return;

    // Preset options if already completed
    const existing = await DB.getFeedbackForUser(this.currentUser.email);

    const metrics = ["usability", "clarity", "trust", "usefulness", "personalization", "ruleUnderstanding", "continueUse"];
    
    metrics.forEach(metric => {
      const container = document.querySelector(`.rating-group[data-rating="${metric}"]`);
      if (!container) return;
      container.innerHTML = "";

      // Initialize default selections
      const currentVal = existing ? existing[metric] : 0;
      this.selectedFeedbackRatings[metric] = currentVal;

      for (let star = 1; star <= 5; star++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `rating-btn ${currentVal === star ? 'selected' : ''}`;
        btn.innerText = star;
        btn.onclick = () => this.selectFeedbackRating(metric, star);
        container.appendChild(btn);
      }
    });

    // Textarea
    document.getElementById("feedback-opentext").value = existing ? existing.openText : "";
  }

  selectFeedbackRating(metric, val) {
    this.selectedFeedbackRatings[metric] = val;
    
    // Refresh button classes
    const container = document.querySelector(`.rating-group[data-rating="${metric}"]`);
    const buttons = container.querySelectorAll(".rating-btn");
    
    buttons.forEach((btn, idx) => {
      if (idx + 1 === val) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
  }

  async handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    // Validate that all ratings have been selected
    const unselected = Object.keys(this.selectedFeedbackRatings).filter(k => this.selectedFeedbackRatings[k] === 0);
    if (unselected.length > 0) {
      alert("Please select a 1 to 5 score for all feedback criteria.");
      return;
    }

    const openText = document.getElementById("feedback-opentext").value;
    
    await DB.saveFeedback(this.currentUser.email, this.selectedFeedbackRatings, openText);
    alert("Thank you. Your usability and trust feedback has been saved.");
    window.location.hash = "#dashboard";
  }

  // 11. Clinician Report Page Loader
  async loadClinicianReport() {
    if (!this.currentUser) return;

    const assessments = await DB.getAssessments(this.currentUser.email);
    const coping = await DB.getCopingPlan(this.currentUser.email);

    document.getElementById("cr-participant-id").innerText = this.currentUser.participantId;
    document.getElementById("cr-date").innerText = new Date().toLocaleString();
    document.getElementById("cr-count").innerText = assessments.length;
    document.getElementById("cr-enrollment").innerText = new Date(this.currentUser.registrationDate).toLocaleDateString();

    // Coping plan
    document.getElementById("cr-coping-triggers").innerText = coping.triggers || "Not defined";
    document.getElementById("cr-coping-strategies").innerText = coping.strategies || "Not defined";
    document.getElementById("cr-coping-supports").innerText = coping.supports || "Not defined";

    // Table rows
    const tbody = document.getElementById("cr-table").querySelector("tbody");
    tbody.innerHTML = "";

    if (assessments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No assessment logs submitted yet.</td></tr>`;
      return;
    }

    assessments.forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(a.timestamp).toLocaleDateString()}</td>
        <td style="font-weight:600;">${a.score}</td>
        <td><span class="severity-indicator ${a.severity.toLowerCase()}">${a.severity}</span></td>
        <td>${a.indicators.sleep}/10</td>
        <td>${a.indicators.avoidance}/10</td>
        <td>${a.indicators.functioning}/10</td>
        <td>${a.indicators.confidence}/10</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 12. Admin Dashboard View Loader
  async loadAdminDashboard() {
    if (!this.currentUser || !this.currentUser.isAdmin) return;

    const adminData = await DB.getAdminData();
    
    const totalAssessments = adminData.reduce((sum, p) => sum + (typeof p.assessmentCount === 'number' ? p.assessmentCount : 0), 0);
    const feedbackCount = adminData.filter(p => p.hasProvidedFeedback).length;

    document.getElementById("admin-stat-users").innerText = adminData.length;
    document.getElementById("admin-stat-assessments").innerText = totalAssessments;
    
    const feedbackRate = adminData.length > 0 
      ? Math.round((feedbackCount / adminData.length) * 100) 
      : 0;
    document.getElementById("admin-stat-feedback").innerText = `${feedbackRate}%`;

    // Render Participant lists
    const tbody = document.getElementById("admin-participants-table").querySelector("tbody");
    tbody.innerHTML = "";

    if (adminData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No participant accounts registered.</td></tr>`;
      return;
    }

    adminData.forEach(p => {
      const regDate = new Date(p.registrationDate).toLocaleDateString();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:600;">${p.participantId}</td>
        <td>${regDate}</td>
        <td>${p.assessmentCount}</td>
        <td style="font-weight:600;">${p.latestScore}</td>
        <td><span class="severity-indicator ${(p.latestSeverity || 'Minimal').toLowerCase()}">${p.latestSeverity}</span></td>
        <td>${p.completedInterventionsCount}</td>
        <td>${p.hasProvidedFeedback ? 'Yes' : 'No'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // CSV Data Exports
  async exportPersonalCSV() {
    if (!this.currentUser) return;
    const assessments = await DB.getAssessments(this.currentUser.email);
    CSVExporter.exportParticipantHistory(assessments, this.currentUser.participantId);
  }

  async exportAllStudyCSV() {
    if (!this.currentUser || !this.currentUser.isAdmin) return;
    const rawAssessments = await DB.getAllAssessmentsRaw();
    CSVExporter.exportAllResearcherData(rawAssessments);
  }
}

// Global Instantiate
const app = new AppController();
window.app = app;

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
