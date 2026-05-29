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

  init() {
    // Check session on load
    this.checkSession();

    // Listen to hash routing
    window.addEventListener("hashchange", () => this.handleRouting());
    
    // Initial routing
    this.handleRouting();
    
    // Setup general listeners
    this.setupListeners();
  }

  checkSession() {
    this.currentUser = DB.getCurrentUser();
    this.updateNavbar();
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
        <a href="#assessment">Assess</a>
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

  handleRouting() {
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
          const assessments = DB.getAssessments(this.currentUser.email);
          if (assessments.length > 0) {
            const latest = assessments[assessments.length - 1];
            const nextCheckinTime = latest.timestamp + (7 * 24 * 60 * 60 * 1000);
            if (Date.now() < nextCheckinTime) {
              alert(`Your next assessment is scheduled for ${new Date(nextCheckinTime).toLocaleDateString()}. You cannot check in until that date.`);
              window.location.hash = "#dashboard";
              return;
            }
          }
        }
      }
    }

    this.activeView = hash;
    this.renderView(hash);
    this.updateNavbar();
  }

  navigateTo(view, mode = null) {
    if (view === "auth" && mode) {
      window.location.hash = `#auth`;
      setTimeout(() => {
        const toggleBtn = document.getElementById("auth-toggle-btn");
        if (mode === "login" && toggleBtn.innerText.includes("Login")) {
          this.toggleAuthMode();
        } else if (mode === "signup" && toggleBtn.innerText.includes("Register")) {
          this.toggleAuthMode();
        }
      }, 50);
    } else {
      window.location.hash = `#${view}`;
    }
  }

  logout() {
    DB.logout();
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
  renderView(view) {
    // Hide all views, display current
    document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
    const activeEl = document.getElementById(`view-${view}`);
    if (activeEl) {
      activeEl.classList.add("active");
    }

    // Trigger page-specific loaders
    switch (view) {
      case "dashboard":
        this.loadDashboard();
        break;
      case "results":
        this.loadResults();
        break;
      case "progress":
        this.loadProgress();
        break;
      case "history":
        this.loadHistory();
        break;
      case "rules-logic":
        this.loadRulesLogic();
        break;
      case "feedback":
        this.loadFeedbackForm();
        break;
      case "clinician-report":
        this.loadClinicianReport();
        break;
      case "admin":
        this.loadAdminDashboard();
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
    const studyGroup = document.getElementById("group-study-code");
    const studyInput = document.getElementById("auth-study-code");

    if (submitBtn.innerText === "Register") {
      title.innerText = "Participant Login";
      desc.innerText = "Log in with your email and password to access your dashboard.";
      submitBtn.innerText = "Log In";
      toggleBtn.innerText = "Need an account? Register";
      studyGroup.style.display = "none";
      studyInput.removeAttribute("required");
    } else {
      title.innerText = "Create Participant Account";
      desc.innerText = "Enter your email and code details below. Your personal identity is kept minimal for privacy compliance.";
      submitBtn.innerText = "Register";
      toggleBtn.innerText = "Already registered? Login";
      studyGroup.style.display = "block";
      studyInput.setAttribute("required", "required");
    }
  }

  handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const isRegister = document.getElementById("auth-submit-btn").innerText === "Register";

    if (isRegister) {
      const studyCode = document.getElementById("auth-study-code").value;
      const res = DB.signUp(email, password, studyCode);
      if (res.success) {
        this.currentUser = res.user;
        window.location.hash = this.currentUser.isAdmin ? "#admin" : "#consent";
      } else {
        alert(res.message);
      }
    } else {
      const res = DB.login(email, password);
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
  }

  // 3. Consent View
  handleConsentSubmit(e) {
    e.preventDefault();
    if (this.currentUser) {
      DB.giveConsent(this.currentUser.email);
      this.currentUser.isConsentGiven = true;
      window.location.hash = "#dashboard";
    }
  }

  // 4. User Dashboard Loader
  loadDashboard() {
    if (!this.currentUser) return;
    
    document.getElementById("dash-participant-id").innerText = this.currentUser.participantId;
    
    const assessments = DB.getAssessments(this.currentUser.email);
    const completions = DB.getCompletions(this.currentUser.email);
    
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
      
      document.getElementById("no-recs-placeholder").style.display = "block";
      document.getElementById("dashboard-recs-list").style.display = "none";
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

    // Manage Check-in Reminder: 7 days interval check
    const nextCheckinTime = latest.timestamp + (7 * 24 * 60 * 60 * 1000);
    const nextCheckinDate = new Date(nextCheckinTime);
    const nextCheckinDateString = nextCheckinDate.toLocaleDateString();
    const isOverdue = Date.now() >= nextCheckinTime;
    
    if (isOverdue) {
      document.getElementById("dash-next-checkin-val").innerText = `${nextCheckinDateString} (Open Now)`;
      document.getElementById("dash-next-checkin-val").style.color = "var(--accent-sage)";
      if (checkinDesc) checkinDesc.innerText = "Your weekly check-in is open. You may log your assessment.";
      if (logBtn) logBtn.removeAttribute("disabled");
      reminderBanner.style.display = "block";
    } else {
      document.getElementById("dash-next-checkin-val").innerText = nextCheckinDateString;
      document.getElementById("dash-next-checkin-val").style.color = "var(--text-primary)";
      if (checkinDesc) checkinDesc.innerText = "You cannot log another assessment until the scheduled date.";
      if (logBtn) logBtn.setAttribute("disabled", "disabled");
      reminderBanner.style.display = "none";
    }

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

    // Load coping status message
    const coping = DB.getCopingPlan(this.currentUser.email);
    if (coping.triggers || coping.strategies || coping.supports) {
      document.getElementById("dash-coping-status").innerText = "Your coping plan is active. Take a moment to review it.";
    } else {
      document.getElementById("dash-coping-status").innerText = "Your plan has not been filled out yet. Click below to establish anchors.";
    }

    // Load recent journal note
    const journals = DB.getJournal(this.currentUser.email);
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

    // Evaluate current rules for user recommendations
    const activeRecommendations = RulesEngine.evaluateRules(assessments, completions);
    const recsList = document.getElementById("dashboard-recs-list");
    
    if (activeRecommendations.length === 0) {
      document.getElementById("no-recs-placeholder").style.display = "block";
      recsList.style.display = "none";
    } else {
      document.getElementById("no-recs-placeholder").style.display = "none";
      recsList.style.display = "flex";
      recsList.innerHTML = "";
      
      activeRecommendations.forEach(rec => {
        // Check if completed
        const isCompleted = completions.some(c => c.recommendationId === rec.id);
        
        const recEl = document.createElement("div");
        recEl.className = `rec-list-item ${isCompleted ? 'completed' : ''}`;
        
        // Dynamically inject custom Coping Plan elements (Improvement 3)
        let dynamicCopingInfo = "";
        const coping = DB.getCopingPlan(this.currentUser.email);
        
        if (rec.id === "additional_coping" && coping.strategies) {
          dynamicCopingInfo = `
            <div style="margin: 0.5rem 0; padding: 0.6rem 0.8rem; background-color: var(--accent-sage-light); border: 1px solid var(--border-color); font-size: 0.85rem;">
              <strong>Your Custom Coping Plan Strategies:</strong>
              <p style="margin: 0.2rem 0 0 0; font-style: italic; color: var(--text-primary); font-weight: 500;">${coping.strategies}</p>
            </div>
          `;
        } else if (rec.id === "crisis_guidance" && coping.supports) {
          dynamicCopingInfo = `
            <div style="margin: 0.5rem 0; padding: 0.6rem 0.8rem; background-color: var(--alert-red-light); border: 1px solid var(--alert-red); font-size: 0.85rem;">
              <strong>Your Stored Emergency Supports:</strong>
              <p style="margin: 0.2rem 0 0 0; font-style: italic; color: var(--alert-red); font-weight: 500;">${coping.supports}</p>
            </div>
          `;
        }
        
        recEl.innerHTML = `
          <div class="rec-title-row">
            <div>
              <span class="severity-indicator" style="margin-bottom: 0.25rem;">${rec.category}</span>
              <h4>${rec.title}</h4>
            </div>
            <div>
              <input type="checkbox" id="chk-rec-${rec.id}" ${isCompleted ? 'checked' : ''} 
                style="cursor: pointer; accent-color: var(--accent-sage); width: 1.1rem; height: 1.1rem;"
                onchange="app.toggleInterventionCompletion('${rec.id}', this.checked)">
            </div>
          </div>
          <p style="margin: 0.25rem 0; font-size: 0.9rem;">${rec.description}</p>
          ${dynamicCopingInfo}
          <div class="flex-row-space" style="margin-top: 0.5rem;">
            <button class="btn btn-secondary btn-small" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
              onclick="app.showExplanation('${rec.title}', '${rec.reason}', '${rec.ruleTriggered}')">
              Why am I seeing this?
            </button>
            ${isCompleted ? '<span class="slider-value" style="font-size:0.75rem;">Completed</span>' : ''}
          </div>
        `;
        
        recsList.appendChild(recEl);
      });
    }
  }

  toggleInterventionCompletion(recId, isChecked) {
    if (!this.currentUser) return;
    DB.toggleIntervention(this.currentUser.email, recId, isChecked);
    
    // Refresh view
    this.loadDashboard();
  }

  // 5. Weekly Assessment Form Submission
  updateSliderLabel(name, val) {
    const valEl = document.getElementById(`val-${name}`);
    if (valEl) valEl.innerText = val;
  }

  handleAssessmentSubmit(e) {
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

    // Save GAD-7 assessment
    DB.saveAssessment(this.currentUser.email, gad7Answers, indicators);

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
  }

  // 6. Results View Page Loader
  loadResults() {
    if (!this.currentUser) return;
    const assessments = DB.getAssessments(this.currentUser.email);
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
    const completions = DB.getCompletions(this.currentUser.email);
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
          <button class="btn btn-secondary btn-small" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
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
  loadProgress() {
    if (!this.currentUser) return;

    const assessments = DB.getAssessments(this.currentUser.email);
    
    // Draw GAD-7 graph
    this.drawProgressGraph(assessments);

    // Load progress feedback analysis text
    const analysisText = document.getElementById("progress-analysis-txt");
    const focusAreas = document.getElementById("progress-focus-areas");
    
    if (assessments.length < 2) {
      analysisText.innerHTML = "Log at least two weekly assessments to visualize your symptoms progression trends.";
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

    // Load completed activities list
    const completions = DB.getCompletions(this.currentUser.email);
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
    const coping = DB.getCopingPlan(this.currentUser.email);
    document.getElementById("coping-triggers").value = coping.triggers || "";
    document.getElementById("coping-strategies").value = coping.strategies || "";
    document.getElementById("coping-supports").value = coping.supports || "";

    // Load Journal feed
    this.loadJournalFeed();
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

  handleCopingSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const triggers = document.getElementById("coping-triggers").value;
    const strategies = document.getElementById("coping-strategies").value;
    const supports = document.getElementById("coping-supports").value;

    DB.saveCopingPlan(this.currentUser.email, triggers, strategies, supports);
    alert("Coping plan saved successfully.");
  }

  handleJournalSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const mood = document.getElementById("journal-mood").value;
    const triggers = document.getElementById("journal-triggers").value;
    const note = document.getElementById("journal-note").value;

    DB.saveJournalEntry(this.currentUser.email, mood, triggers, note);
    
    // Clear note inputs
    document.getElementById("journal-note").value = "";
    document.getElementById("journal-triggers").value = "";
    document.getElementById("journal-mood").selectedIndex = 4; // Reset to mood 5

    // Refresh view
    this.loadProgress();
  }

  loadJournalFeed() {
    const journalFeed = document.getElementById("journal-entries-feed");
    if (!journalFeed) return;

    const entries = DB.getJournal(this.currentUser.email);
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
  loadHistory() {
    if (!this.currentUser) return;

    const assessments = DB.getAssessments(this.currentUser.email);
    const completions = DB.getCompletions(this.currentUser.email);
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
          <div style="border-left: 2px solid var(--accent-slate); padding-left: 1rem; margin-top: 0.75rem;">
            <div class="flex-row-space">
              <strong>${rec.title}</strong>
              <span class="severity-indicator">${hasCompleted ? 'Completed' : 'Not completed'}</span>
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
          Assessment Cycle: ${dateStr} (GAD-7 Total: ${targetAssessment.score} - ${targetAssessment.severity})
        </h3>
        ${recsHTML}
      `;
      container.appendChild(section);
    }
  }

  saveRecUsefulnessFeedback(assessmentId, recId, rating) {
    if (!this.currentUser) return;
    const compoundId = `${assessmentId}_${recId}`;
    DB.saveRecommendationFeedback(this.currentUser.email, compoundId, rating, "Logged from history page");
    
    // Refresh history entries
    this.loadHistory();
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
  loadFeedbackForm() {
    if (!this.currentUser) return;

    // Preset options if already completed
    const existing = DB.getFeedbackForUser(this.currentUser.email);

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

  handleFeedbackSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    // Validate that all ratings have been selected
    const unselected = Object.keys(this.selectedFeedbackRatings).filter(k => this.selectedFeedbackRatings[k] === 0);
    if (unselected.length > 0) {
      alert("Please select a 1 to 5 score for all feedback criteria.");
      return;
    }

    const openText = document.getElementById("feedback-opentext").value;
    
    DB.saveFeedback(this.currentUser.email, this.selectedFeedbackRatings, openText);
    alert("Thank you. Your usability and trust feedback has been saved.");
    window.location.hash = "#dashboard";
  }

  // 11. Clinician Report Page Loader
  loadClinicianReport() {
    if (!this.currentUser) return;

    const assessments = DB.getAssessments(this.currentUser.email);
    const coping = DB.getCopingPlan(this.currentUser.email);

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
  loadAdminDashboard() {
    if (!this.currentUser || !this.currentUser.isAdmin) return;

    const adminData = DB.getAdminData();
    const assessments = localStorage.getItem("adi_assessments") ? JSON.parse(localStorage.getItem("adi_assessments")) : [];
    const feedback = localStorage.getItem("adi_feedback") ? JSON.parse(localStorage.getItem("adi_feedback")) : [];

    document.getElementById("admin-stat-users").innerText = adminData.length;
    document.getElementById("admin-stat-assessments").innerText = assessments.length;
    
    const feedbackRate = adminData.length > 0 
      ? Math.round((adminData.filter(d => d.hasProvidedFeedback).length / adminData.length) * 100) 
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
  exportPersonalCSV() {
    if (!this.currentUser) return;
    const assessments = DB.getAssessments(this.currentUser.email);
    CSVExporter.exportParticipantHistory(assessments, this.currentUser.participantId);
  }

  exportAllStudyCSV() {
    if (!this.currentUser || !this.currentUser.isAdmin) return;
    const rawAssessments = DB.getAllAssessmentsRaw();
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
