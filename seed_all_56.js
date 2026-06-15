const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://jxwbbhjhnhqszhgsiqon.supabase.co";
const SUPABASE_KEY = "sb_publishable_oCm1lG2Hkr04k3tLXsn9Ng_HPI1Hm7Q";
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const firstNames = ["Alex","Jordan","Taylor","Casey","Morgan","Jamie","Riley","Quinn","Avery","Harper","Skyler","Dakota","Reese","Finley","Emerson","Rowan","Blair","Cameron","Drew","Ellis","Frankie","Gray","Hayden","Indigo","Jules","Kai","Lane","Marley","Noel","Oakley","Parker","Remy","Sage","Tatum","Val","Wren","Zion","Ari","Blake","Charlie","Devon","Eden","Fern","Glenn","Haven","Ivory","Jesse","Kendall","Logan","Micah","Nina","Omar","Poppy","Rafael","Sasha","Theo"];
const lastNames = ["Rivera","Lee","Smith","Morgan","Bailey","Vance","Chen","Brooks","Hayes","Foster","Reed","Ross","Price","Ward","Bell","Cooper","Turner","Scott","Adams","Evans","Clark","Hall","Young","King","Green","Baker","Nelson","Hill","Carter","Mitchell","Perez","Roberts","Collins","Stewart","Murphy","Cook","Rogers","Morris","Fisher","Cruz","Day","Grant","Burke","Lane","Walsh","Owen","Floyd","Mann","Doyle","Barker"];

const triggerOptions = [
  "academic stress", "work pressure", "social situations", "health concerns",
  "financial worry", "family issues", "sleep problems", "deadlines", "news",
  "relationship stress", "loneliness", "public speaking", "future plans",
  "career uncertainty", "fear of change", "difficult decisions", "fear of unknown",
  "worried about future"
];

const journalNotes = [
  "Feeling better today, managed to stick to my routine.",
  "Tough day but the breathing exercises helped.",
  "Noticed my anxiety creeping up in the afternoon.",
  "Slept well last night which made a big difference.",
  "Managed to challenge some negative thoughts today.",
  "Social situation went better than expected.",
  "Struggled a bit with concentration today.",
  "Used grounding techniques during a stressful meeting.",
  "Feeling more in control of my anxiety.",
  "Had a setback but trying to stay positive.",
  "Good day overall, kept busy with productive activities.",
  "Meditation session was really helpful this morning.",
  "Worried about my future career prospects and landing a job.",
  "Feeling anxious about upcoming changes and making decisions.",
  "Struggling with the uncertainty of what lies ahead.",
  "Applied for a position today, uncertain about the outcome.",
  "Fear of the unknown is weighing on me lately.",
  "Spent time planning goals which helped ease future worries.",
  "Career direction feels unclear, trying to stay grounded.",
  "Made a difficult decision today, feeling mixed about it."
];

const recOptions = ["breathing_exercise","sleep_hygiene","worry_postponement","progressive_relaxation","grounding_technique"];

const trigSets = [
  "Academic deadlines, late-night screen time",
  "Work pressure, social isolation",
  "Health worries, news consumption",
  "Financial stress, sleep disruption",
  "Relationship conflict, overthinking",
  "Future plans, career uncertainty",
  "Making difficult decisions, fear of change",
  "Fear of unknown, life plan worries"
];
const stratSets = [
  "Box breathing, phone-free evenings, daily walks",
  "Progressive relaxation, journaling, time-blocking",
  "Worry postponement, mindfulness, exercise",
  "Grounding techniques, sleep hygiene, social connection",
  "Cognitive restructuring, gratitude practice, nature exposure"
];
const suppSets = [
  "GP (Dr. Smith), sister Sarah",
  "Counsellor (Ms. Jones), partner",
  "Therapist (Dr. Brown), best friend",
  "University wellbeing service, flatmate",
  "NHS helpline, parent"
];

const feedbackTexts = [
  "Very helpful tool, would recommend.",
  "The daily check-ins kept me accountable.",
  "Liked the breathing exercises most.",
  "Would love more personalisation options.",
  "Simple and easy to use.",
  "Great for tracking my progress over time.",
  "The recommendations were spot on.",
  "Helped me understand my anxiety triggers better.",
  "Highly intuitive interface and very calming design.",
  "Found the coping plans extremely useful for my daily stress.",
  "The reminders were helpful but not too intrusive.",
  "Appreciate the privacy focus and minimal registration details.",
  "The graphing feature really helped me visualize my patterns.",
  "Excellent support resource, especially the grounding techniques.",
  "Easy to navigate and complete assessments daily."
];

async function run() {
  console.log("Wiping old data...");
  const fakeUuid = '00000000-0000-0000-0000-000000000000';
  await supabaseClient.from('feedback').delete().neq('id', fakeUuid);
  await supabaseClient.from('assessments').delete().neq('id', fakeUuid);
  await supabaseClient.from('journal').delete().neq('id', fakeUuid);
  await supabaseClient.from('completions').delete().neq('id', fakeUuid);
  await supabaseClient.from('coping_plans').delete().neq('user_id', fakeUuid);
  await supabaseClient.from('profiles').delete().neq('participant_id', '0');

  console.log("Seeding 56 users with rich data...");

  for(let i=1; i<=56; i++) {
    const email = `participant${i}@v5.test.com`;
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: "pass123",
      options: { data: { participant_id: `P-${1000+i}`, full_name: `${firstNames[(i-1) % firstNames.length]} ${lastNames[(i-1) % lastNames.length]}` } }
    });
    if (error) {
      console.log(`Error for ${email}:`, error.message);
      continue;
    }
    const userId = data.user.id;

    await supabaseClient.from('profiles').upsert({
      id: userId,
      participant_id: `P-${1000+i}`,
      full_name: `${firstNames[(i-1) % firstNames.length]} ${lastNames[(i-1) % lastNames.length]}`,
      is_consent_given: true,
      is_admin: false,
      registration_date: new Date("2026-05-21T10:00:00Z").toISOString()
    });

    const assessments = [];
    const completions = [];
    const journals = [];

    let currentDate = new Date("2026-05-21T18:00:00Z");
    const endDate = new Date("2026-06-06T18:00:00Z");
    let score = 5 + Math.floor(Math.random() * 16); // 5-20

    while (currentDate <= endDate) {
      const iso = currentDate.toISOString();

      // Gradual trend downward with some noise
      if (score > 5 && Math.random() > 0.35) score--;
      else if (score < 20 && Math.random() > 0.85) score++;

      let severity;
      if (score >= 15) severity = "Severe";
      else if (score >= 10) severity = "Moderate";
      else if (score >= 5) severity = "Mild";
      else severity = "Minimal";

      const perItem = Math.floor(score / 7);
      const remainder = score % 7;
      const gad7 = [perItem, perItem, perItem, perItem, perItem, perItem, remainder];

      const sleepVal = Math.round(Math.max(2, Math.min(10, 10 - score * 0.4)) * 10) / 10;
      const avoidVal = Math.round(Math.min(10, score * 0.6) * 10) / 10;
      const concVal = Math.round(Math.max(2, 10 - score * 0.3) * 10) / 10;
      const irrVal = Math.round(Math.min(10, score * 0.5) * 10) / 10;
      const tensVal = Math.round(Math.min(10, score * 0.55) * 10) / 10;
      const withVal = Math.round(Math.min(10, score * 0.45) * 10) / 10;
      const funcVal = Math.round(Math.max(2, 10 - score * 0.35) * 10) / 10;

      const trigger = triggerOptions[Math.floor(Math.random() * triggerOptions.length)];
      const confVal = Math.round(Math.max(1, 10 - score * 0.4) * 10) / 10;
      const supportOptions = ["Yes","No","Yes, spoke to family/friend","Yes, spoke to healthcare professional"];
      const support = supportOptions[Math.floor(Math.random() * supportOptions.length)];

      assessments.push({
        user_id: userId,
        gad7: gad7,
        score: score,
        severity: severity,
        timestamp: iso,
        indicators: {
          sleep: sleepVal, avoidance: avoidVal, concentration: concVal,
          irritability: irrVal, tension: tensVal, withdrawal: withVal,
          functioning: funcVal, triggers: trigger, confidence: confVal, support: support
        }
      });

      // ~60% chance of a completion each day
      if (Math.random() > 0.4) {
        completions.push({
          user_id: userId,
          recommendation_id: recOptions[Math.floor(Math.random() * recOptions.length)],
          timestamp: iso,
          completed: true
        });
      }

      // ~40% chance of journal each day
      if (Math.random() > 0.6) {
        const moodVal = Math.round(Math.max(1, Math.min(10, 10 - score * 0.45)) * 10) / 10;
        journals.push({
          user_id: userId,
          mood: moodVal,
          triggers: trigger,
          note: journalNotes[Math.floor(Math.random() * journalNotes.length)],
          timestamp: iso
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    await supabaseClient.from('assessments').insert(assessments);
    if (completions.length > 0) await supabaseClient.from('completions').insert(completions);
    if (journals.length > 0) await supabaseClient.from('journal').insert(journals);

    // Coping plan with varied triggers
    await supabaseClient.from('coping_plans').insert({
      user_id: userId,
      triggers: trigSets[i % trigSets.length],
      strategies: stratSets[i % stratSets.length],
      supports: suppSets[i % suppSets.length]
    });

    // Feedback for every participant
    await supabaseClient.from('feedback').insert({
      user_id: userId,
      usability: Math.floor(Math.random() * 3) + 3,
      clarity: Math.floor(Math.random() * 3) + 3,
      trust: Math.floor(Math.random() * 3) + 3,
      usefulness: Math.floor(Math.random() * 3) + 3,
      personalization: Math.floor(Math.random() * 3) + 3,
      rule_understanding: Math.floor(Math.random() * 3) + 3,
      continue_use: Math.floor(Math.random() * 3) + 3,
      open_text: feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)]
    });

    if (i % 10 === 0) console.log(`Seeded ${i}/56...`);
  }
  console.log("Completely done!");
}
run();
