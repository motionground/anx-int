/* 
 * Database Service: Digital Anxiety Intervention Research Project
 * Dual Mode: Supports localStorage (fallback) and Supabase Cloud Database (PostgreSQL).
 * Paste your Supabase project keys below to automatically activate cloud mode.
 */

// 1. SUPABASE CONFIGURATION KEYS
const SUPABASE_URL = "https://jxwbbhjhnhqszhgsiqon.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d2JiaGpobmhxc3poZ3NpcW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzg0NzksImV4cCI6MjA5NTYxNDQ3OX0.8P2Om7TIoZF0yyBaRyj-82EE3917QpxuMAYfP1Q-W_U";

const DB_PREFIX = "adi_";

// Check if credentials have been replaced
let isSupabaseConfigured = 
  SUPABASE_URL !== "YOUR_SUPABASE_URL" && 
  SUPABASE_KEY !== "YOUR_SUPABASE_ANON_KEY" && 
  SUPABASE_URL && 
  SUPABASE_KEY;

let supabaseClient = null;

if (isSupabaseConfigured) {
  try {
    if (typeof window === "undefined" || !window.supabase) {
      throw new Error("Supabase SDK is not loaded in the window.");
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Centralized database activated: Connected to Supabase Cloud.");
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    isSupabaseConfigured = false; // Graceful fallback to Local Storage
  }
}

if (!isSupabaseConfigured) {
  console.warn("Supabase credentials not configured or initialization failed. Running in Local Storage Fallback Mode.");
}

// ==========================================
// A. PASSWORD HASHING HELPER (Local Fallback)
// ==========================================
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "shash_" + Math.abs(hash).toString(16);
}

// ==========================================
// B. LOCAL STORAGE HELPERS (Local Fallback)
// ==========================================
function getStore(key) {
  const data = localStorage.getItem(DB_PREFIX + key);
  return data ? JSON.parse(data) : [];
}

function setStore(key, value) {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
}

function getSeverityFromScore(score) {
  const numericScore = Number(score) || 0;
  if (numericScore >= 15) return "Severe";
  if (numericScore >= 10) return "Moderate";
  if (numericScore >= 5) return "Mild";
  return "Minimal";
}

function seedMockData() {
  const users = getStore("users");
  if (users.some(u => u.email === "participant1@test.com")) return; // Already seeded

  // Seed Admin user
  const adminUser = {
    email: "researcher@study.edu",
    passwordHash: hashPassword("admin123"),
    participantId: "RESEARCHER-2026",
    fullName: "Lead Researcher",
    isConsentGiven: true,
    registrationDate: new Date("2026-05-01T09:00:00Z").toISOString(),
    isAdmin: true
  };
  if (!users.some(u => u.email === adminUser.email)) {
    users.push(adminUser);
  }

  // Participant 1 (Improving GAD-7 and sleep)
  const user1 = {
    email: "participant1@test.com",
    passwordHash: hashPassword("pass123"),
    participantId: "P-401",
    fullName: "Alex Rivera",
    isConsentGiven: true,
    registrationDate: new Date("2026-05-05T10:00:00Z").toISOString(),
    isAdmin: false
  };
  users.push(user1);

  // Participant 2 (Stable severe GAD-7 triggering safety precautions)
  const user2 = {
    email: "participant2@test.com",
    passwordHash: hashPassword("pass123"),
    participantId: "P-904",
    fullName: "Jordan Lee",
    isConsentGiven: true,
    registrationDate: new Date("2026-05-08T11:30:00Z").toISOString(),
    isAdmin: false
  };
  users.push(user2);
  setStore("users", users);

  // Assessments for Participant 1 (P-401) over 3 weeks
  const assessments = getStore("assessments");
  const t1 = new Date("2026-05-07T18:00:00Z").getTime();
  const t2 = new Date("2026-05-14T18:00:00Z").getTime();
  const t3 = new Date("2026-05-21T18:00:00Z").getTime();

  const mockAssessments = [
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

  mockAssessments.forEach(ma => {
    if (!assessments.some(a => a.id === ma.id)) {
      assessments.push(ma);
    }
  });
  setStore("assessments", assessments);

  // Intervention completion logs
  const completions = getStore("completions");
  const mockCompletions = [
    { id: "c_1", userId: "participant1@test.com", recommendationId: "sleep_hygiene", timestamp: t2, completed: true },
    { id: "c_2", userId: "participant1@test.com", recommendationId: "breathing_exercise", timestamp: t2, completed: true },
    { id: "c_3", userId: "participant1@test.com", recommendationId: "worry_postponement", timestamp: t3, completed: true }
  ];
  mockCompletions.forEach(mc => {
    if (!completions.some(c => c.id === mc.id)) {
      completions.push(mc);
    }
  });
  setStore("completions", completions);

  // Coping Plans
  const copingPlans = getStore("coping");
  const mockCoping = [
    {
      userId: "participant1@test.com",
      triggers: "Academic deadlines, late-night screen time",
      strategies: "5-minute box breathing, turning off phone at 10 PM, daily short walks",
      supports: "GP (Dr. Smith), my sister Sarah"
    }
  ];
  mockCoping.forEach(mc => {
    if (!copingPlans.some(cp => cp.userId === mc.userId)) {
      copingPlans.push(mc);
    }
  });
  setStore("coping", copingPlans);

  // Journals
  const journals = getStore("journal");
  const mockJournals = [
    { id: "j_1", userId: "participant1@test.com", timestamp: t1, mood: 3, triggers: "Exam", note: "Feeling extremely overwhelmed about my dissertation." },
    { id: "j_2", userId: "participant1@test.com", timestamp: t2, mood: 5, triggers: "Late sleep", note: "Managed to sleep a bit better. The breathing exercise helps." },
    { id: "j_3", userId: "participant1@test.com", timestamp: t3, mood: 7, triggers: "None", note: "Had a productive week. Anxieties are feeling manageable." }
  ];
  mockJournals.forEach(mj => {
    if (!journals.some(j => j.id === mj.id)) {
      journals.push(mj);
    }
  });
  setStore("journal", journals);
}

// ==========================================
// C. DUAL-MODE UNIFIED DB API
// ==========================================
const DB = {
  initialize() {
    if (!isSupabaseConfigured) {
      seedMockData();
    } else {
      // Supabase is active — clear any stale localStorage seed/mock data
      // so it can never be accidentally migrated into real Supabase accounts.
      const keysToWipe = ["assessments", "completions", "journal", "coping", "feedback", "users"];
      keysToWipe.forEach(k => {
        const raw = localStorage.getItem(DB_PREFIX + k);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            // Only wipe if it contains seed/mock data (emails ending in @test.com or researcher@)
            const hasSeed = Array.isArray(arr) && arr.some(item =>
              (item.userId || item.email || "").match(/@test\.com$|researcher@study\.edu/i)
            );
            if (hasSeed) {
              localStorage.removeItem(DB_PREFIX + k);
              console.log(`Cleared stale seed data from localStorage key: ${k}`);
            }
          } catch(e) { /* non-array stores, skip */ }
        }
      });
    }
  },

  // --- AUTH OPERATIONS ---
  async migrateLocalDataToCloud(email, supabaseUserId) {
    try {
      email = email.trim().toLowerCase();
      
      // 1. Migrate Coping Plans
      const copingStore = getStore("coping");
      const localPlanIndex = copingStore.findIndex(p => p.userId === email);
      if (localPlanIndex > -1) {
        const localPlan = copingStore[localPlanIndex];
        const { error } = await supabaseClient
          .from('coping_plans')
          .upsert({
            user_id: supabaseUserId,
            triggers: localPlan.triggers,
            strategies: localPlan.strategies,
            supports: localPlan.supports
          });
        if (!error) {
          copingStore.splice(localPlanIndex, 1);
          setStore("coping", copingStore);
          console.log("Migrated local coping plan to cloud.");
        } else {
          console.error("Error migrating coping plan:", error);
        }
      }

      // 2. Migrate Assessments
      const assessmentsStore = getStore("assessments");
      const localAssessments = assessmentsStore.filter(a => a.userId === email);
      if (localAssessments.length > 0) {
        const inserts = localAssessments.map(a => ({
          user_id: supabaseUserId,
          timestamp: new Date(a.timestamp).toISOString(),
          gad7: a.gad7,
          indicators: a.indicators,
          score: a.score,
          severity: a.severity || getSeverityFromScore(a.score)
        }));

        const { error } = await supabaseClient
          .from('assessments')
          .insert(inserts);

        if (!error) {
          const remainingAssessments = assessmentsStore.filter(a => a.userId !== email);
          setStore("assessments", remainingAssessments);
          console.log(`Migrated ${localAssessments.length} local assessments to cloud.`);
        } else {
          console.error("Error migrating assessments:", error);
        }
      }

      // 3. Migrate Completions
      const completionsStore = getStore("completions");
      const localCompletions = completionsStore.filter(c => c.userId === email);
      if (localCompletions.length > 0) {
        const inserts = localCompletions.map(c => ({
          user_id: supabaseUserId,
          recommendation_id: c.recommendationId,
          timestamp: new Date(c.timestamp).toISOString(),
          completed: c.completed
        }));

        const { error } = await supabaseClient
          .from('completions')
          .insert(inserts);

        if (!error) {
          const remainingCompletions = completionsStore.filter(c => c.userId !== email);
          setStore("completions", remainingCompletions);
          console.log(`Migrated ${localCompletions.length} local completions to cloud.`);
        } else {
          console.error("Error migrating completions:", error);
        }
      }

      // 4. Migrate Journal
      const journalStore = getStore("journal");
      const localJournals = journalStore.filter(j => j.userId === email);
      if (localJournals.length > 0) {
        const inserts = localJournals.map(j => ({
          user_id: supabaseUserId,
          timestamp: new Date(j.timestamp).toISOString(),
          mood: j.mood,
          triggers: j.triggers,
          note: j.note
        }));

        const { error } = await supabaseClient
          .from('journal')
          .insert(inserts);

        if (!error) {
          const remainingJournals = journalStore.filter(j => j.userId !== email);
          setStore("journal", remainingJournals);
          console.log(`Migrated ${localJournals.length} local journal entries to cloud.`);
        } else {
          console.error("Error migrating journal entries:", error);
        }
      }

      // 5. Migrate Feedback
      const feedbackStore = getStore("feedback");
      const localFeedbackIndex = feedbackStore.findIndex(f => f.userId === email);
      if (localFeedbackIndex > -1) {
        const localFeedback = feedbackStore[localFeedbackIndex];
        const { error } = await supabaseClient
          .from('feedback')
          .upsert({
            user_id: supabaseUserId,
            usability: localFeedback.usability,
            clarity: localFeedback.clarity,
            trust: localFeedback.trust,
            usefulness: localFeedback.usefulness,
            personalization: localFeedback.personalization,
            rule_understanding: localFeedback.ruleUnderstanding,
            continue_use: localFeedback.continueUse,
            open_text: localFeedback.openText
          });
        if (!error) {
          feedbackStore.splice(localFeedbackIndex, 1);
          setStore("feedback", feedbackStore);
          console.log("Migrated local feedback survey to cloud.");
        } else {
          console.error("Error migrating feedback survey:", error);
        }
      }
    } catch (err) {
      console.error("Data migration error:", err);
    }
  },

  async signUp(email, password, participantId, fullName) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabaseClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: { 
            participant_id: participantId,
            full_name: fullName
          }
        }
      });

      if (error) {
        console.error("Supabase signUp error:", error);
        return { success: false, message: error.message };
      }

      if (!data || !data.user) {
        return { success: false, message: "Registration failed — no user returned. The email may already be registered. Try logging in instead." };
      }

      const userId = data.user.id;

      // Insert the profile row so login can find it
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: userId,
          participant_id: participantId,
          full_name: fullName,
          is_consent_given: false,
          is_admin: participantId.startsWith("RESEARCHER"),
          registration_date: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        console.warn("Profile insert error (non-fatal):", profileError);
        // Non-fatal — auth user exists, profile row failed. Continue with session.
      }

      // Migrate any local storage data to cloud
      await this.migrateLocalDataToCloud(email.trim().toLowerCase(), userId);

      const sessionUser = {
        email: email.trim().toLowerCase(),
        participantId: participantId,
        fullName: fullName,
        isConsentGiven: false,
        isAdmin: participantId.startsWith("RESEARCHER")
      };

      localStorage.setItem(DB_PREFIX + "session", JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };

    } else {
      const users = getStore("users");
      email = email.trim().toLowerCase();
      participantId = participantId.trim().toUpperCase();

      if (users.some(u => u.email === email)) {
        return { success: false, message: "An account with this email already exists." };
      }
      if (users.some(u => u.participantId === participantId)) {
        return { success: false, message: "This participant ID is already registered." };
      }

      const newUser = {
        email,
        passwordHash: hashPassword(password),
        participantId,
        fullName,
        isConsentGiven: false,
        registrationDate: new Date().toISOString(),
        isAdmin: participantId.startsWith("RESEARCHER")
      };

      users.push(newUser);
      setStore("users", users);
      
      this.setSession(newUser);
      return { success: true, user: newUser };
    }
  },

  async login(email, password) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (error) {
        console.error("Supabase login error:", error);
        const msg = error.message || "Authentication failed.";
        // Handle most common Supabase errors with human-friendly messages
        if (msg.toLowerCase().includes("email not confirmed")) {
          return { success: false, message: "Your email address has not been confirmed yet. Please check your inbox for a confirmation link from Supabase, then try again. (Check spam folder too.)" };
        }
        if (msg.toLowerCase().includes("invalid login credentials") || msg.toLowerCase().includes("invalid credentials")) {
          return { success: false, message: "Incorrect email or password. Please double-check your details and try again." };
        }
        return { success: false, message: `Login failed: ${msg}` };
      }

      // Migrate local storage data to cloud for this email
      await this.migrateLocalDataToCloud(email.trim().toLowerCase(), data.user.id);

      // Fetch public profile metadata
      const { data: profile, error: profileFetchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileFetchError) {
        console.warn("Profile fetch error:", profileFetchError);
      }

      const loggedUser = {
        email: email.trim().toLowerCase(),
        participantId: profile ? profile.participant_id : (data.user.user_metadata?.participant_id || "ANON"),
        fullName: profile ? (profile.full_name || data.user.user_metadata?.full_name || "Participant") : (data.user.user_metadata?.full_name || "Participant"),
        isConsentGiven: profile ? profile.is_consent_given : false,
        isAdmin: profile ? profile.is_admin : false
      };

      localStorage.setItem(DB_PREFIX + "session", JSON.stringify(loggedUser));
      return { success: true, user: loggedUser };
    } else {
      const users = getStore("users");
      email = email.trim().toLowerCase();
      const hash = hashPassword(password);

      const user = users.find(u => u.email === email && u.passwordHash === hash);
      if (!user) {
        return { success: false, message: "Invalid email or password." };
      }

      this.setSession(user);
      return { success: true, user };
    }
  },

  async logout() {
    if (isSupabaseConfigured) {
      await supabaseClient.auth.signOut();
    }
    localStorage.removeItem(DB_PREFIX + "session");
  },

  async getCurrentUser() {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return null;

      // Migrate local storage data to cloud for this session user email
      await this.migrateLocalDataToCloud(session.user.email, session.user.id);

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const userObj = {
        email: session.user.email,
        participantId: profile ? profile.participant_id : "ANON",
        fullName: session.user.user_metadata ? (session.user.user_metadata.full_name || "Participant") : "Participant",
        isConsentGiven: profile ? profile.is_consent_given : false,
        isAdmin: profile ? profile.is_admin : false
      };
      
      localStorage.setItem(DB_PREFIX + "session", JSON.stringify(userObj));
      return userObj;
    } else {
      const sessionData = localStorage.getItem(DB_PREFIX + "session");
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      const users = getStore("users");
      const matched = users.find(u => u.email === session.email);
      return matched ? {
        email: matched.email,
        participantId: matched.participantId,
        fullName: matched.fullName || "Participant",
        isConsentGiven: matched.isConsentGiven,
        isAdmin: matched.isAdmin
      } : null;
    }
  },

  setSession(user) {
    localStorage.setItem(DB_PREFIX + "session", JSON.stringify({
      email: user.email,
      participantId: user.participantId,
      fullName: user.fullName || "Participant",
      isAdmin: user.isAdmin
    }));
  },

  async giveConsent(userId) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return false;

      const { error } = await supabaseClient
        .from('profiles')
        .update({ is_consent_given: true })
        .eq('id', session.user.id);

      return !error;
    } else {
      const users = getStore("users");
      const userIndex = users.findIndex(u => u.email === userId);
      if (userIndex > -1) {
        users[userIndex].isConsentGiven = true;
        setStore("users", users);
        return true;
      }
      return false;
    }
  },

  // --- GAD-7 ASSESSMENTS ---
  async saveAssessment(userId, gad7Answers, indicators) {
    const score = gad7Answers.reduce((sum, val) => sum + parseInt(val, 10), 0);
    
    const severity = getSeverityFromScore(score);

    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabaseClient
        .from('assessments')
        .insert([{
          user_id: session.user.id,
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
        }])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert assessment failed:", error);
      }
      
      return data ? {
        id: data.id,
        userId: userId,
        timestamp: new Date(data.timestamp).getTime(),
        gad7: data.gad7,
        indicators: data.indicators,
        score: data.score,
        severity: data.severity || getSeverityFromScore(data.score)
      } : null;
    } else {
      const assessments = getStore("assessments");
      
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
    }
  },

  async getAssessments(userId) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabaseClient
        .from('assessments')
        .select('*')
        .eq('user_id', session.user.id)
        .order('timestamp', { ascending: true });

      return (data || []).map(a => ({
        id: a.id,
        userId: userId,
        timestamp: new Date(a.timestamp).getTime(),
        gad7: a.gad7,
        indicators: a.indicators,
        score: a.score,
        severity: a.severity || getSeverityFromScore(a.score)
      }));
    } else {
      const assessments = getStore("assessments");
      return assessments
        .filter(a => a.userId === userId)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(a => ({
          ...a,
          severity: a.severity || getSeverityFromScore(a.score)
        }));
    }
  },

  // --- COPING PLAN ---
  async getCopingPlan(userId) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return { userId, triggers: "", strategies: "", supports: "" };

      const { data } = await supabaseClient
        .from('coping_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      return data ? {
        userId,
        triggers: data.triggers || "",
        strategies: data.strategies || "",
        supports: data.supports || ""
      } : { userId, triggers: "", strategies: "", supports: "" };
    } else {
      const plans = getStore("coping");
      const plan = plans.find(p => p.userId === userId);
      return plan || { userId, triggers: "", strategies: "", supports: "" };
    }
  },

  async saveCopingPlan(userId, triggers, strategies, supports) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabaseClient
        .from('coping_plans')
        .upsert({
          user_id: session.user.id,
          triggers,
          strategies,
          supports
        });

      return { userId, triggers, strategies, supports };
    } else {
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
    }
  },

  // --- INTERVENTION COMPLETIONS ---
  async getCompletions(userId) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return [];

      const { data } = await supabaseClient
        .from('completions')
        .select('*')
        .eq('user_id', session.user.id);

      return (data || []).map(c => ({
        id: c.id,
        userId: userId,
        recommendationId: c.recommendation_id,
        timestamp: new Date(c.timestamp).getTime(),
        completed: c.completed
      }));
    } else {
      const completions = getStore("completions");
      return completions.filter(c => c.userId === userId);
    }
  },

  async toggleIntervention(userId, recommendationId, isCompleted) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;

      if (isCompleted) {
        await supabaseClient
          .from('completions')
          .insert([{
            user_id: session.user.id,
            recommendation_id: recommendationId,
            completed: true
          }]);
      } else {
        await supabaseClient
          .from('completions')
          .delete()
          .eq('user_id', session.user.id)
          .eq('recommendation_id', recommendationId);
      }
    } else {
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
    }
  },

  // --- MOOD JOURNAL ---
  async getJournal(userId) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return [];

      const { data } = await supabaseClient
        .from('journal')
        .select('*')
        .eq('user_id', session.user.id)
        .order('timestamp', { ascending: false });

      return (data || []).map(j => ({
        id: j.id,
        userId: userId,
        timestamp: new Date(j.timestamp).getTime(),
        mood: j.mood,
        triggers: j.triggers || "",
        note: j.note
      }));
    } else {
      const entries = getStore("journal");
      return entries
        .filter(e => e.userId === userId)
        .sort((a, b) => b.timestamp - a.timestamp);
    }
  },

  async saveJournalEntry(userId, mood, triggers, note) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return null;

      const { data } = await supabaseClient
        .from('journal')
        .insert([{
          user_id: session.user.id,
          mood: Number(mood),
          triggers: String(triggers).trim(),
          note: String(note).trim()
        }])
        .select()
        .single();

      return data ? {
        id: data.id,
        userId: userId,
        timestamp: new Date(data.timestamp).getTime(),
        mood: data.mood,
        triggers: data.triggers,
        note: data.note
      } : null;
    } else {
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
    }
  },

  // --- RESEARCH SURVEY FEEDBACK ---
  async getFeedbackForUser(userId) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return null;

      const { data } = await supabaseClient
        .from('feedback')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      return data ? {
        id: data.user_id,
        userId: userId,
        timestamp: new Date(data.timestamp).getTime(),
        usability: data.usability,
        clarity: data.clarity,
        trust: data.trust,
        usefulness: data.usefulness,
        personalization: data.personalization,
        ruleUnderstanding: data.rule_understanding,
        continueUse: data.continue_use,
        openText: data.open_text
      } : null;
    } else {
      const feedbacks = getStore("feedback");
      return feedbacks.find(f => f.userId === userId) || null;
    }
  },

  async saveFeedback(userId, ratings, openText) {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabaseClient
        .from('feedback')
        .upsert({
          user_id: session.user.id,
          usability: Number(ratings.usability),
          clarity: Number(ratings.clarity),
          trust: Number(ratings.trust),
          usefulness: Number(ratings.usefulness),
          personalization: Number(ratings.personalization),
          rule_understanding: Number(ratings.ruleUnderstanding),
          continue_use: Number(ratings.continueUse),
          open_text: String(openText).trim()
        });

      return { success: !error };
    } else {
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
    }
  },

  // --- RECOMMENDATION HISTORY FEEDBACK (Local Utility) ---
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

  // --- RESEARCH ADMINISTRATOR & Spreadsheets ---
  async getAdminData() {
    if (isSupabaseConfigured) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('is_admin', false);
      
      const { data: assessments } = await supabaseClient
        .from('assessments')
        .select('*');

      const { data: completions } = await supabaseClient
        .from('completions')
        .select('*');

      const { data: feedback } = await supabaseClient
        .from('feedback')
        .select('*');

      return (profiles || []).map(p => {
        const userAssess = (assessments || [])
          .filter(a => a.user_id === p.id)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        const userComps = (completions || []).filter(c => c.user_id === p.id);
        const hasFeedback = (feedback || []).some(f => f.user_id === p.id);

        return {
          participantId: p.participant_id,
          registrationDate: p.registration_date,
          assessmentCount: userAssess.length,
          latestScore: userAssess.length > 0 ? userAssess[userAssess.length - 1].score : "N/A",
          latestSeverity: userAssess.length > 0 ? userAssess[userAssess.length - 1].severity : "N/A",
          completedInterventionsCount: userComps.length,
          hasProvidedFeedback: hasFeedback
        };
      });
    } else {
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
    }
  },

  async getAllAssessmentsRaw() {
    if (isSupabaseConfigured) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('*');

      const { data: assessments } = await supabaseClient
        .from('assessments')
        .select('*')
        .order('timestamp', { ascending: true });

      return (assessments || []).map(a => {
        const p = (profiles || []).find(prof => prof.id === a.user_id);
        return {
          participantId: p ? p.participant_id : "ANON",
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
          ind_triggers: a.indicators.triggers.replace(/,/g, ";"),
          ind_confidence: a.indicators.confidence,
          ind_support: a.indicators.support
        };
      });
    } else {
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
          ind_triggers: a.indicators.triggers.replace(/,/g, ";"),
          ind_confidence: a.indicators.confidence,
          ind_support: a.indicators.support
        };
      });
    }
  }
};

// Initialize DB immediately
DB.initialize();

window.DB = DB; // expose to app modules
