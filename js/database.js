/* 
 * Database Service: Digital Anxiety Intervention Research Project
 * Strictly Cloud Mode: Connected to Supabase Cloud Database (PostgreSQL).
 */

const SUPABASE_URL = "https://jxwbbhjhnhqszhgsiqon.supabase.co";
const SUPABASE_KEY = "sb_publishable_oCm1lG2Hkr04k3tLXsn9Ng_HPI1Hm7Q";

const DB_PREFIX = "adi_";

if (!window.supabase) {
  throw new Error("Supabase SDK is not loaded. Strictly Cloud database requires Supabase connection.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("Centralized database activated: Connected to Supabase Cloud.");

const useMockData = !!(window.MOCK_DASHBOARD_DATA && new URLSearchParams(window.location.search).has("mock"));

function getSeverityFromScore(score) {
  const numericScore = Number(score) || 0;
  if (numericScore >= 15) return "Severe";
  if (numericScore >= 10) return "Moderate";
  if (numericScore >= 5) return "Mild";
  return "Minimal";
}

async function fetchAllRows(tableName, selectColumns = '*') {
  let allData = [];
  let start = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select(selectColumns)
      .range(start, start + limit - 1);

    if (error) {
      console.error(`Error fetching all rows from ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      start += limit;
      if (data.length < limit) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}

const DB = {
  async initialize() {
    try {
      await this.seedSupabaseMockData();
    } catch (e) {
      console.warn("Failed to complete Supabase database seeding:", e);
    }
  },

  // --- MOCK DATA SEEDING FOR SUPABASE ---
  async seedSupabaseMockData() {
    // Check if participant1@test.com profile already exists
    const { data: existing, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('participant_id', 'P-1001')
      .maybeSingle();

    if (existing) {
      console.log("Mock data already seeded in Supabase.");
      return;
    }

    console.log("Seeding mock users to Supabase...");


    const mockUsers = [];
    for(let i=1; i<=56; i++) {
      mockUsers.push({
        email: `participant${i}@v3.test.com`,
        password: "pass123",
        id: `P-${1000 + i}`,
        name: `Participant ${i}`
      });
    }

    for (const u of mockUsers) {
      const { data, error } = await supabaseClient.auth.signUp({
        email: u.email,
        password: u.password,
        options: {
          data: {
            participant_id: u.id,
            full_name: u.name
          }
        }
      });

      if (error) {
        console.warn(`Sign up warning for ${u.email}:`, error.message);
        continue;
      }

      const userId = data.user.id;
      console.log(`Successfully registered ${u.email} in Supabase (UUID: ${userId})`);

      await supabaseClient.from('profiles').upsert({
        id: userId,
        participant_id: u.id,
        is_consent_given: true,
        is_admin: false,
        registration_date: new Date("2026-05-21T10:00:00Z").toISOString()
      });

      const assessments = [];
      const completions = [];
      const journals = [];
      
      let currentDate = new Date("2026-05-21T18:00:00Z");
      const endDate = new Date("2026-06-06T18:00:00Z");
      let score = Math.floor(Math.random() * 14) + 6; 

      while (currentDate <= endDate) {
        const iso = currentDate.toISOString();
        if (score > 6 && Math.random() > 0.4) score--;
        else if (score < 20 && Math.random() > 0.8) score++;

        let severity = "Severe";
        if (score < 15) severity = "Moderate";
        if (score < 10) severity = "Mild";
        if (score < 5) severity = "Minimal";

        assessments.push({ 
          user_id: userId, 
          gad7: [Math.floor(score/7), Math.floor(score/7), Math.floor(score/7), Math.floor(score/7), Math.floor(score/7), Math.floor(score/7), score % 7], 
          score: score, 
          severity: severity, 
          timestamp: new Date(iso).toISOString(), 
          indicators: { sleep: Math.max(3, 10 - score/2), avoidance: Math.min(9, score/1.5), concentration: 5, irritability: 5, tension: 5, withdrawal: 5, functioning: 5, triggers: "daily log", confidence: 5, support: "Yes" } 
        });

        if (Math.random() > 0.5) {
          completions.push({ user_id: userId, recommendation_id: "breathing_exercise", timestamp: new Date(iso).toISOString(), completed: true });
        }

        if (Math.random() > 0.7) {
          journals.push({ user_id: userId, mood: Math.min(10, Math.floor(15 - score/1.5)), triggers: "None", note: "Daily journal log.", timestamp: new Date(iso).toISOString() });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      await supabaseClient.from('assessments').insert(assessments);
      if (completions.length > 0) await supabaseClient.from('completions').insert(completions);
      if (journals.length > 0) await supabaseClient.from('journal').insert(journals);

      await supabaseClient.from('coping_plans').insert({
        user_id: userId,
        triggers: "General stress",
        strategies: "Breathing exercises",
        supports: "Family"
      });
    }

    console.log("Mock data seeding to Supabase complete.");
  },

  // --- AUTH OPERATIONS ---
  async signUp(email, password, participantId, fullName) {
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
      return { success: false, message: "Registration failed — no user returned." };
    }

    const userId = data.user.id;
    const isResearcher = participantId.startsWith("RESEARCHER") || email.trim().toLowerCase().includes("researcher") || email.trim().toLowerCase().includes("admin");

    // Insert the profile row so login can find it
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        participant_id: participantId,
        is_consent_given: isResearcher ? true : false,
        is_admin: isResearcher,
        registration_date: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.warn("Profile insert error:", profileError);
    }

    const sessionUser = {
      email: email.trim().toLowerCase(),
      participantId: participantId,
      fullName: fullName,
      isConsentGiven: isResearcher ? true : false,
      isAdmin: isResearcher,
      registrationDate: new Date().toISOString()
    };

    return { success: true, user: sessionUser };
  },

  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password
    });

    if (error) {
      console.error("Supabase login error:", error);
      const msg = error.message || "Authentication failed.";
      if (msg.toLowerCase().includes("email not confirmed")) {
        return { success: false, message: "Your email address has not been confirmed yet." };
      }
      if (msg.toLowerCase().includes("invalid login credentials") || msg.toLowerCase().includes("invalid credentials")) {
        return { success: false, message: "Incorrect email or password." };
      }
      return { success: false, message: `Login failed: ${msg}` };
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    const isResearcher = (profile && profile.is_admin) || email.trim().toLowerCase().includes("researcher") || email.trim().toLowerCase().includes("admin");
    const loggedUser = {
      email: email.trim().toLowerCase(),
      participantId: profile ? profile.participant_id : "ANON",
      fullName: profile ? (profile.full_name || "Participant") : "Participant",
      isConsentGiven: isResearcher ? true : (profile ? profile.is_consent_given : false),
      isAdmin: isResearcher,
      registrationDate: profile ? profile.registration_date : new Date().toISOString()
    };

    return { success: true, user: loggedUser };
  },

  async logout() {
    await supabaseClient.auth.signOut();
  },

  async getCurrentUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    const isResearcher = (profile && profile.is_admin) || session.user.email.trim().toLowerCase().includes("researcher") || session.user.email.trim().toLowerCase().includes("admin");
    const userObj = {
      email: session.user.email,
      participantId: profile ? profile.participant_id : "ANON",
      fullName: session.user.user_metadata ? (session.user.user_metadata.full_name || "Participant") : "Participant",
      isConsentGiven: isResearcher ? true : (profile ? profile.is_consent_given : false),
      isAdmin: isResearcher,
      registrationDate: profile ? profile.registration_date : new Date().toISOString()
    };
    
    return userObj;
  },

  async giveConsent(userId) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return false;

    const { error } = await supabaseClient
      .from('profiles')
      .update({ is_consent_given: true })
      .eq('id', session.user.id);

    return !error;
  },

  // --- GAD-7 ASSESSMENTS ---
  async saveAssessment(userId, gad7Answers, indicators) {
    const score = gad7Answers.reduce((sum, val) => sum + parseInt(val, 10), 0);
    const severity = getSeverityFromScore(score);

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
  },

  async getAssessments(userId) {
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
  },

  // --- COPING PLAN ---
  async getCopingPlan(userId) {
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
  },

  async saveCopingPlan(userId, triggers, strategies, supports) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;

    await supabaseClient
      .from('coping_plans')
      .upsert({
        user_id: session.user.id,
        triggers,
        strategies,
        supports
      });

    return { userId, triggers, strategies, supports };
  },

  // --- INTERVENTION COMPLETIONS ---
  async getCompletions(userId) {
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
  },

  async toggleIntervention(userId, recommendationId, isCompleted) {
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
  },

  // --- MOOD JOURNAL ---
  async getJournal(userId) {
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
  },

  async saveJournalEntry(userId, mood, triggers, note) {
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
  },

  // --- RESEARCH SURVEY FEEDBACK ---
  async getFeedbackForUser(userId) {
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
  },

  async saveFeedback(userId, ratings, openText) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;

    const { error } = await supabaseClient
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
  },

  // --- RESEARCH ADMINISTRATOR & Spreadsheets ---


  async getAdminData() {
    let profiles, assessments, completions, feedback;
    
    if (useMockData) {
      profiles = window.MOCK_DASHBOARD_DATA.profiles;
      assessments = window.MOCK_DASHBOARD_DATA.assessments;
      completions = window.MOCK_DASHBOARD_DATA.completions;
      feedback = window.MOCK_DASHBOARD_DATA.feedback || [];
    } else {
      const pRes = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('is_admin', false);
      profiles = pRes.data;
      
      assessments = await fetchAllRows('assessments');
      completions = await fetchAllRows('completions');
      feedback = await fetchAllRows('feedback');
    }

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
  },
  async getParticipantProfiles() {
    if (useMockData) {
      return window.MOCK_DASHBOARD_DATA.profiles.map(p => {
        const count = window.MOCK_DASHBOARD_DATA.assessments.filter(a => a.user_id === p.id).length;
        return {
          userId: p.id,
          participantId: p.participant_id,
          assessmentCount: count
        };
      });
    }
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('is_admin', false);

    const assessments = await fetchAllRows('assessments', 'user_id');

    return (profiles || []).map(p => {
      const count = (assessments || []).filter(a => a.user_id === p.id).length;
      return {
        userId: p.id,
        participantId: p.participant_id,
        assessmentCount: count
      };
    });
  },




  async getAllAssessmentsRaw() {
    if (useMockData) {
      const profiles = window.MOCK_DASHBOARD_DATA.profiles;
      const assessments = [...window.MOCK_DASHBOARD_DATA.assessments];
      assessments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
    }

    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('*');

    const assessments = await fetchAllRows('assessments');
    assessments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
  },

  async getParticipantDetailData(participantId) {
    if (useMockData) {
      const profile = window.MOCK_DASHBOARD_DATA.profiles.find(p => p.participant_id === participantId);
      if (!profile) return null;
      const userId = profile.id;

      const assessments = window.MOCK_DASHBOARD_DATA.assessments.filter(a => a.user_id === userId);
      const coping = window.MOCK_DASHBOARD_DATA.coping_plans.find(c => c.user_id === userId);
      const completions = window.MOCK_DASHBOARD_DATA.completions.filter(c => c.user_id === userId);
      const journal = window.MOCK_DASHBOARD_DATA.journals.filter(j => j.user_id === userId);
      const feedback = window.MOCK_DASHBOARD_DATA.feedback?.find(f => f.user_id === userId);

      return {
        participantId: profile.participant_id,
        fullName: profile.full_name,
        registrationDate: profile.registration_date,
        assessments: (assessments || []).map(a => ({
          id: a.id,
          timestamp: new Date(a.timestamp).getTime(),
          gad7: a.gad7,
          indicators: a.indicators,
          score: a.score,
          severity: a.severity || getSeverityFromScore(a.score)
        })),
        coping: coping ? {
          triggers: coping.triggers || "",
          strategies: coping.strategies || "",
          supports: coping.supports || ""
        } : null,
        completions: (completions || []).map(c => ({
          id: c.id,
          recommendationId: c.recommendation_id,
          timestamp: new Date(c.timestamp).getTime(),
          completed: c.completed
        })),
        journal: (journal || []).map(j => ({
          id: j.id,
          timestamp: new Date(j.timestamp).getTime(),
          mood: j.mood,
          triggers: j.triggers || "",
          note: j.note
        })),
        feedback: feedback ? {
          usability: feedback.usability,
          clarity: feedback.clarity,
          trust: feedback.trust,
          usefulness: feedback.usefulness,
          personalization: feedback.personalization,
          ruleUnderstanding: feedback.rule_understanding,
          continueUse: feedback.continue_use,
          openText: feedback.open_text
        } : null
      };
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('participant_id', participantId)
      .maybeSingle();
    
    if (!profile) return null;
    const userId = profile.id;

    const { data: assessments } = await supabaseClient
      .from('assessments')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    const { data: coping } = await supabaseClient
      .from('coping_plans')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: completions } = await supabaseClient
      .from('completions')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    const { data: journal } = await supabaseClient
      .from('journal')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    const { data: feedback } = await supabaseClient
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      participantId: profile.participant_id,
      fullName: profile.full_name,
      registrationDate: profile.registration_date,
      assessments: (assessments || []).map(a => ({
        id: a.id,
        timestamp: new Date(a.timestamp).getTime(),
        gad7: a.gad7,
        indicators: a.indicators,
        score: a.score,
        severity: a.severity || getSeverityFromScore(a.score)
      })),
      coping: coping ? {
        triggers: coping.triggers || "",
        strategies: coping.strategies || "",
        supports: coping.supports || ""
      } : null,
      completions: (completions || []).map(c => ({
        id: c.id,
        recommendationId: c.recommendation_id,
        timestamp: new Date(c.timestamp).getTime(),
        completed: c.completed
      })),
      journal: (journal || []).map(j => ({
        id: j.id,
        timestamp: new Date(j.timestamp).getTime(),
        mood: j.mood,
        triggers: j.triggers || "",
        note: j.note
      })),
      feedback: feedback ? {
        usability: feedback.usability,
        clarity: feedback.clarity,
        trust: feedback.trust,
        usefulness: feedback.usefulness,
        personalization: feedback.personalization,
        ruleUnderstanding: feedback.rule_understanding,
        continueUse: feedback.continue_use,
        openText: feedback.open_text
      } : null
    };
  },

  async getCohortAnalyticsData() {
    if (useMockData) {
      const assessments = [...window.MOCK_DASHBOARD_DATA.assessments];
      const feedback = [...(window.MOCK_DASHBOARD_DATA.feedback || [])];
      const journal = [...window.MOCK_DASHBOARD_DATA.journals];
      const completions = [...window.MOCK_DASHBOARD_DATA.completions];

      // Sort by timestamp
      assessments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      journal.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        assessments: assessments || [],
        feedback: feedback || [],
        journal: journal || [],
        completions: completions || []
      };
    }

    const assessments = await fetchAllRows('assessments');
    const feedback = await fetchAllRows('feedback');
    const journal = await fetchAllRows('journal');
    const completions = await fetchAllRows('completions');

    // Sort by timestamp
    assessments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    journal.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      assessments: assessments || [],
      feedback: feedback || [],
      journal: journal || [],
      completions: completions || []
    };
  },

  async importAssessmentRow(row) {
    const participantId = row.participantId;
    if (!participantId) {
      return { success: false, error: "Missing Participant ID" };
    }

    // 1. Find profile by participantId
    const { data: profile, error: profileErr } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('participant_id', participantId)
      .maybeSingle();

    if (profileErr) {
      console.error(`Profile lookup error for ${participantId}:`, profileErr);
      return { success: false, error: profileErr.message };
    }

    let userId;
    if (!profile) {
      // Create a new mock user
      const cleanPartId = participantId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `participant_${cleanPartId || Math.floor(Math.random() * 100000)}@imported.study`;
      const password = "Password123!";
      
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            participant_id: participantId,
            full_name: `Imported ${participantId}`
          }
        }
      });

      if (signUpError) {
        console.error(`Sign up error for imported participant ${participantId}:`, signUpError);
        return { success: false, error: signUpError.message };
      }

      if (!signUpData || !signUpData.user) {
        return { success: false, error: `Auth registration failed for ${participantId}` };
      }

      userId = signUpData.user.id;
      const { error: insertProfileErr } = await supabaseClient.from('profiles').upsert({
        id: userId,
        participant_id: participantId,
        is_consent_given: true,
        is_admin: false,
        registration_date: row.timestamp || new Date().toISOString()
      }, { onConflict: 'id' });

      if (insertProfileErr) {
        console.error(`Profile insert error for imported participant ${participantId}:`, insertProfileErr);
        return { success: false, error: insertProfileErr.message };
      }
    } else {
      userId = profile.id;
    }

    // 2. Insert assessment row
    const score = Number(row.gad7_total) || 0;
    const severity = getSeverityFromScore(score);
    const gad7Answers = [
      Number(row.gad7_q1 || 0),
      Number(row.gad7_q2 || 0),
      Number(row.gad7_q3 || 0),
      Number(row.gad7_q4 || 0),
      Number(row.gad7_q5 || 0),
      Number(row.gad7_q6 || 0),
      Number(row.gad7_q7 || 0)
    ];

    const { error: insertError } = await supabaseClient
      .from('assessments')
      .insert([{
        user_id: userId,
        gad7: gad7Answers,
        indicators: {
          sleep: Number(row.ind_sleep || 0),
          avoidance: Number(row.ind_avoidance || 0),
          concentration: Number(row.ind_concentration || 0),
          irritability: Number(row.ind_irritability || 0),
          tension: Number(row.ind_tension || 0),
          withdrawal: Number(row.ind_withdrawal || 0),
          functioning: Number(row.ind_functioning || 0),
          triggers: String(row.ind_triggers || "").replace(/;/g, ","),
          confidence: Number(row.ind_confidence || 0),
          support: String(row.ind_support || "No")
        },
        score,
        severity,
        timestamp: row.timestamp || new Date().toISOString()
      }]);

    if (insertError) {
      console.error(`Assessment insert error for ${participantId}:`, insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  },

  async getInteractiveCohortDataset() {
    let profiles, assessments, completions, feedback, journal;
    if (useMockData) {
      profiles = window.MOCK_DASHBOARD_DATA.profiles;
      assessments = window.MOCK_DASHBOARD_DATA.assessments;
      completions = window.MOCK_DASHBOARD_DATA.completions;
      feedback = window.MOCK_DASHBOARD_DATA.feedback || [];
      journal = window.MOCK_DASHBOARD_DATA.journals;
    } else {
      const { data: pRes } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('is_admin', false);
      profiles = pRes || [];

      assessments = await fetchAllRows('assessments');
      completions = await fetchAllRows('completions');
      feedback = await fetchAllRows('feedback');
      journal = await fetchAllRows('journal');
    }

    const profs = profiles || [];
    const assess = assessments || [];
    const comps = completions || [];
    const feed = feedback || [];
    const jour = journal || [];

    return profs.map(p => {
      const userAssess = assess.filter(a => a.user_id === p.id);
      const userComps = comps.filter(c => c.user_id === p.id);
      const userFeed = feed.find(f => f.user_id === p.id);
      const userJour = jour.filter(j => j.user_id === p.id);

      let avgGad7 = null;
      let avgSleep = null;
      let avgAvoidance = null;
      let avgConcentration = null;

      if (userAssess.length > 0) {
        const sumGad = userAssess.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
        avgGad7 = Number((sumGad / userAssess.length).toFixed(1));

        let sleepSum = 0, sleepCount = 0;
        let avoidSum = 0, avoidCount = 0;
        let concSum = 0, concCount = 0;

        userAssess.forEach(a => {
          if (a.indicators) {
            if (a.indicators.sleep !== undefined && a.indicators.sleep !== null && !isNaN(Number(a.indicators.sleep))) {
              sleepSum += Number(a.indicators.sleep);
              sleepCount++;
            }
            if (a.indicators.avoidance !== undefined && a.indicators.avoidance !== null && !isNaN(Number(a.indicators.avoidance))) {
              avoidSum += Number(a.indicators.avoidance);
              avoidCount++;
            }
            if (a.indicators.concentration !== undefined && a.indicators.concentration !== null && !isNaN(Number(a.indicators.concentration))) {
              concSum += Number(a.indicators.concentration);
              concCount++;
            }
          }
        });

        if (sleepCount > 0) avgSleep = Number((sleepSum / sleepCount).toFixed(1));
        if (avoidCount > 0) avgAvoidance = Number((avoidSum / avoidCount).toFixed(1));
        if (concCount > 0) avgConcentration = Number((concSum / concCount).toFixed(1));
      }

      let avgMood = null;
      if (userJour.length > 0) {
        const moodSum = userJour.reduce((sum, j) => sum + (Number(j.mood) || 0), 0);
        avgMood = Number((moodSum / userJour.length).toFixed(1));
      }

      return {
        participantId: p.participant_id,
        avgGad7: avgGad7,
        avgSleep: avgSleep,
        avgAvoidance: avgAvoidance,
        avgConcentration: avgConcentration,
        avgMood: avgMood,
        totalCompletions: userComps.length,
        usability: userFeed ? Number(userFeed.usability) : null,
        trust: userFeed ? Number(userFeed.trust) : null,
        usefulness: userFeed ? Number(userFeed.usefulness) : null,
        personalization: userFeed ? Number(userFeed.personalization) : null,
        continueUse: userFeed ? Number(userFeed.continue_use) : null
      };
    });
  }
};

// Initialize DB immediately
DB.initialize();

window.DB = DB; // expose to app modules
