/* 
 * Database Service: Digital Anxiety Intervention Research Project
 * Uses localStorage to persist study records.
 * Provides simulated hashing for authentication security.
 * Seeds mock research data on first load.
 */

const DB_PREFIX = "adi_";

// Helper to simulate cryptographic hash for passwords
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return "shash_" + Math.abs(hash).toString(16);
}

// Storage Helpers
function getStore(key) {
  const data = localStorage.getItem(DB_PREFIX + key);
  return data ? JSON.parse(data) : [];
}

function setStore(key, value) {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
}

// Seed Mock Data for clinical demonstration
function seedMockData() {
  if (getStore("users").length > 0) return; // Already seeded/active

  // Admin user
  const adminUser = {
    email: "researcher@study.edu",
    passwordHash: hashPassword("admin123"),
    participantId: "RESEARCHER-2026",
    isConsentGiven: true,
    registrationDate: new Date("2026-05-01T09:00:00Z").toISOString(),
    isAdmin: true
  };

  // Participant 1 (Improving GAD-7 and sleep)
  const user1 = {
    email: "participant1@test.com",
    passwordHash: hashPassword("pass123"),
    participantId: "P-401",
    isConsentGiven: true,
    registrationDate: new Date("2026-05-05T10:00:00Z").toISOString(),
    isAdmin: false
  };

  // Participant 2 (Stable severe GAD-7 triggering safety precautions)
  const user2 = {
    email: "participant2@test.com",
    passwordHash: hashPassword("pass123"),
    participantId: "P-904",
    isConsentGiven: true,
    registrationDate: new Date("2026-05-08T11:30:00Z").toISOString(),
    isAdmin: false
  };

  const users = [adminUser, user1, user2];
  setStore("users", users);

  // Assessments for Participant 1 (P-401) over 3 weeks
  const t1 = new Date("2026-05-07T18:00:00Z").getTime();
  const t2 = new Date("2026-05-14T18:00:00Z").getTime();
  const t3 = new Date("2026-05-21T18:00:00Z").getTime();

  const assessments = [
    {
      id: "a_1",
      userId: "participant1@test.com",
      timestamp: t1,
      gad7: [2, 3, 2, 2, 2, 2, 2], // Sum = 15 (Severe)
      indicators: {
        sleep: 3,          // Poor sleep
        avoidance: 8,      // High avoidance
        concentration: 4,
        irritability: 7,
        tension: 8,
        withdrawal: 7,
        functioning: 3,    // Low functioning
        triggers: "academic stress, presentation coming up",
        confidence: 4,
        support: "No"
      },
      score: 15,
      severity: "Severe"
    },
    {
      id: "a_2",
      userId: "participant1@test.com",
      timestamp: t2,
      gad7: [2, 2, 1, 2, 1, 1, 2], // Sum = 11 (Moderate)
      indicators: {
        sleep: 5,          // Moderate sleep
        avoidance: 7,      // Decreased slightly
        concentration: 5,
        irritability: 5,
        tension: 6,
        withdrawal: 5,
        functioning: 5,
        triggers: "deadlines",
        confidence: 5,
        support: "Yes"
      },
      score: 11,
      severity: "Moderate"
    },
    {
      id: "a_3",
      userId: "participant1@test.com",
      timestamp: t3,
      gad7: [1, 1, 1, 1, 1, 0, 1], // Sum = 6 (Mild)
      indicators: {
        sleep: 8,          // Good sleep
        avoidance: 4,      // Low avoidance
        concentration: 7,
        irritability: 3,
        tension: 3,
        withdrawal: 3,
        functioning: 8,
        triggers: "none",
        confidence: 8,
        support: "Yes"
      },
      score: 6,
      severity: "Mild"
    },
    // Participant 2 (P-904) Severe cases
    {
      id: "a_4",
      userId: "participant2@test.com",
      timestamp: t2,
      gad7: [3, 3, 3, 3, 2, 2, 2], // Sum = 18 (Severe)
      indicators: {
        sleep: 2,
        avoidance: 9,
        concentration: 3,
        irritability: 8,
        tension: 9,
        withdrawal: 9,
        functioning: 2,
        triggers: "social interactions, job search",
        confidence: 2,
        support: "No"
      },
      score: 18,
      severity: "Severe"
    }
  ];
  setStore("assessments", assessments);

  // Intervention completion logs
  const completions = [
    { id: "c_1", userId: "participant1@test.com", recommendationId: "sleep_hygiene", timestamp: t2, completed: true },
    { id: "c_2", userId: "participant1@test.com", recommendationId: "breathing_exercise", timestamp: t2, completed: true },
    { id: "c_3", userId: "participant1@test.com", recommendationId: "worry_postponement", timestamp: t3, completed: true }
  ];
  setStore("completions", completions);

  // Coping Plans
  const copingPlans = [
    {
      userId: "participant1@test.com",
      triggers: "Academic deadlines, late-night screen time",
      strategies: "5-minute box breathing, turning off phone at 10 PM, daily short walks",
      supports: "GP (Dr. Smith), my sister Sarah"
    }
  ];
  setStore("coping", copingPlans);

  // Journals
  const journals = [
    { id: "j_1", userId: "participant1@test.com", timestamp: t1, mood: 3, triggers: "Exam", note: "Feeling extremely overwhelmed about my dissertation." },
    { id: "j_2", userId: "participant1@test.com", timestamp: t2, mood: 5, triggers: "Late sleep", note: "Managed to sleep a bit better. The breathing exercise helps." },
    { id: "j_3", userId: "participant1@test.com", timestamp: t3, mood: 7, triggers: "None", note: "Had a productive week. Anxieties are feeling manageable." }
  ];
  setStore("journal", journals);
}

// Database API
const DB = {
  initialize() {
    seedMockData();
  },

  // Auth Operations
  signUp(email, password, participantId) {
    const users = getStore("users");
    
    // Normalize input
    email = email.trim().toLowerCase();
    participantId = participantId.trim().toUpperCase();

    if (users.some(u => u.email === email)) {
      return { success: false, message: "An account with this email already exists." };
    }
    if (users.some(u => u.participantId === participantId)) {
      return { success: false, message: "This participant ID or study code is already registered." };
    }

    const newUser = {
      email,
      passwordHash: hashPassword(password),
      participantId,
      isConsentGiven: false,
      registrationDate: new Date().toISOString(),
      isAdmin: participantId.startsWith("RESEARCHER")
    };

    users.push(newUser);
    setStore("users", users);
    
    this.setSession(newUser);
    return { success: true, user: newUser };
  },

  login(email, password) {
    const users = getStore("users");
    email = email.trim().toLowerCase();
    const hash = hashPassword(password);

    const user = users.find(u => u.email === email && u.passwordHash === hash);
    if (!user) {
      return { success: false, message: "Invalid email or password." };
    }

    this.setSession(user);
    return { success: true, user };
  },

  logout() {
    localStorage.removeItem(DB_PREFIX + "session");
  },

  getCurrentUser() {
    const sessionData = localStorage.getItem(DB_PREFIX + "session");
    if (!sessionData) return null;
    
    // Refresh user object from list to get latest updates (like consent)
    const session = JSON.parse(sessionData);
    const users = getStore("users");
    return users.find(u => u.email === session.email) || null;
  },

  setSession(user) {
    localStorage.setItem(DB_PREFIX + "session", JSON.stringify({
      email: user.email,
      participantId: user.participantId,
      isAdmin: user.isAdmin
    }));
  },

  giveConsent(userId) {
    const users = getStore("users");
    const userIndex = users.findIndex(u => u.email === userId);
    if (userIndex > -1) {
      users[userIndex].isConsentGiven = true;
      setStore("users", users);
      return true;
    }
    return false;
  },

  // GAD-7 assessments
  saveAssessment(userId, gad7Answers, indicators) {
    const assessments = getStore("assessments");
    
    // Calculate GAD-7 Total
    const score = gad7Answers.reduce((sum, val) => sum + parseInt(val, 10), 0);
    
    // Determine severity
    let severity = "Minimal";
    if (score >= 15) severity = "Severe";
    else if (score >= 10) severity = "Moderate";
    else if (score >= 5) severity = "Mild";

    const newAssessment = {
      id: "a_" + Date.now(),
      userId,
      timestamp: Date.now(),
      gad7: gad7Answers.map(Number),
      indicators: {
        sleep: Number(indicators.sleep),
        avoidance: Number(indicators.avoidance),
        concentration: Number(indicators.concentration),
        irritability: Number(indicators.irritability),
        tension: Number(indicators.tension),
        withdrawal: Number(indicators.withdrawal),
        functioning: Number(indicators.functioning),
        triggers: String(indicators.triggers || ""),
        confidence: Number(indicators.confidence),
        support: String(indicators.support || "No")
      },
      score,
      severity
    };

    assessments.push(newAssessment);
    setStore("assessments", assessments);
    return newAssessment;
  },

  getAssessments(userId) {
    const assessments = getStore("assessments");
    return assessments
      .filter(a => a.userId === userId)
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  // Coping Plan
  getCopingPlan(userId) {
    const plans = getStore("coping");
    const plan = plans.find(p => p.userId === userId);
    return plan || { userId, triggers: "", strategies: "", supports: "" };
  },

  saveCopingPlan(userId, triggers, strategies, supports) {
    const plans = getStore("coping");
    const index = plans.findIndex(p => p.userId === userId);
    const newPlan = { userId, triggers, strategies, supports };

    if (index > -1) {
      plans[index] = newPlan;
    } else {
      plans.push(newPlan);
    }
    setStore("coping", plans);
    return newPlan;
  },

  // Intervention Completions
  getCompletions(userId) {
    const completions = getStore("completions");
    return completions.filter(c => c.userId === userId);
  },

  toggleIntervention(userId, recommendationId, isCompleted) {
    const completions = getStore("completions");
    const index = completions.findIndex(c => c.userId === userId && c.recommendationId === recommendationId);

    if (isCompleted) {
      if (index === -1) {
        completions.push({
          id: "c_" + Date.now(),
          userId,
          recommendationId,
          timestamp: Date.now(),
          completed: true
        });
      }
    } else {
      if (index > -1) {
        completions.splice(index, 1);
      }
    }
    setStore("completions", completions);
  },

  // Mood Journal
  getJournal(userId) {
    const entries = getStore("journal");
    return entries
      .filter(e => e.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp); // latest first
  },

  saveJournalEntry(userId, mood, triggers, note) {
    const entries = getStore("journal");
    const newEntry = {
      id: "j_" + Date.now(),
      userId,
      timestamp: Date.now(),
      mood: Number(mood),
      triggers: String(triggers).trim(),
      note: String(note).trim()
    };
    entries.push(newEntry);
    setStore("journal", entries);
    return newEntry;
  },

  // Research Feedback
  getFeedbackForUser(userId) {
    const feedbacks = getStore("feedback");
    return feedbacks.find(f => f.userId === userId) || null;
  },

  saveFeedback(userId, ratings, openText) {
    const feedbacks = getStore("feedback");
    const index = feedbacks.findIndex(f => f.userId === userId);

    const newFeedback = {
      id: "f_" + Date.now(),
      userId,
      timestamp: Date.now(),
      usability: Number(ratings.usability),
      clarity: Number(ratings.clarity),
      trust: Number(ratings.trust),
      usefulness: Number(ratings.usefulness),
      personalization: Number(ratings.personalization),
      ruleUnderstanding: Number(ratings.ruleUnderstanding),
      continueUse: Number(ratings.continueUse),
      openText: String(openText).trim()
    };

    if (index > -1) {
      feedbacks[index] = newFeedback;
    } else {
      feedbacks.push(newFeedback);
    }
    setStore("feedback", feedbacks);
    return newFeedback;
  },

  // Recommendation Feedback (Usefulness rating on history)
  saveRecommendationFeedback(userId, recommendationId, rating, comment) {
    const recFeedback = getStore("rec_feedback");
    const index = recFeedback.findIndex(rf => rf.userId === userId && rf.recommendationId === recommendationId);

    const newEntry = {
      userId,
      recommendationId,
      timestamp: Date.now(),
      rating: Number(rating),
      comment: String(comment).trim()
    };

    if (index > -1) {
      recFeedback[index] = newEntry;
    } else {
      recFeedback.push(newEntry);
    }
    setStore("rec_feedback", recFeedback);
  },

  getRecommendationFeedback(userId) {
    return getStore("rec_feedback").filter(rf => rf.userId === userId);
  },

  // Admin and Research API
  getAdminData() {
    const users = getStore("users").filter(u => !u.isAdmin);
    const assessments = getStore("assessments");
    const feedback = getStore("feedback");
    const completions = getStore("completions");

    return users.map(user => {
      const userAssessments = assessments.filter(a => a.userId === user.email);
      const userFeedback = feedback.find(f => f.userId === user.email);
      const userCompletions = completions.filter(c => c.userId === user.email);

      return {
        participantId: user.participantId,
        registrationDate: user.registrationDate,
        assessmentCount: userAssessments.length,
        latestScore: userAssessments.length > 0 ? userAssessments[userAssessments.length - 1].score : "N/A",
        latestSeverity: userAssessments.length > 0 ? userAssessments[userAssessments.length - 1].severity : "N/A",
        completedInterventionsCount: userCompletions.length,
        hasProvidedFeedback: !!userFeedback
      };
    });
  },

  getAllAssessmentsRaw() {
    // Returns clean, anonymized assessments for researcher CSV export
    const users = getStore("users");
    const assessments = getStore("assessments");

    return assessments.map(a => {
      const u = users.find(usr => usr.email === a.userId);
      return {
        participantId: u ? u.participantId : "ANON",
        timestamp: new Date(a.timestamp).toISOString(),
        gad7_q1: a.gad7[0],
        gad7_q2: a.gad7[1],
        gad7_q3: a.gad7[2],
        gad7_q4: a.gad7[3],
        gad7_q5: a.gad7[4],
        gad7_q6: a.gad7[5],
        gad7_q7: a.gad7[6],
        gad7_total: a.score,
        anxiety_severity: a.severity,
        ind_sleep: a.indicators.sleep,
        ind_avoidance: a.indicators.avoidance,
        ind_concentration: a.indicators.concentration,
        ind_irritability: a.indicators.irritability,
        ind_tension: a.indicators.tension,
        ind_withdrawal: a.indicators.withdrawal,
        ind_functioning: a.indicators.functioning,
        ind_triggers: a.indicators.triggers.replace(/,/g, ";"), // avoid CSV breaking
        ind_confidence: a.indicators.confidence,
        ind_support: a.indicators.support
      };
    });
  }
};

// Initialize DB immediately
DB.initialize();

window.DB = DB; // expose to app modules
