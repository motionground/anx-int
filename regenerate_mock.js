const fs = require('fs');

const firstNames = ["Alex","Jordan","Taylor","Casey","Morgan","Jamie","Riley","Quinn","Avery","Harper","Skyler","Dakota","Reese","Finley","Emerson","Rowan","Blair","Cameron","Drew","Ellis","Frankie","Gray","Hayden","Indigo","Jules","Kai","Lane","Marley","Noel","Oakley","Parker","Remy","Sage","Tatum","Val","Wren","Zion","Ari","Blake","Charlie","Devon","Eden","Fern","Glenn","Haven","Ivory","Jesse","Kendall","Logan","Micah"];
const lastNames = ["Rivera","Lee","Smith","Morgan","Bailey","Vance","Chen","Brooks","Hayes","Foster","Reed","Ross","Price","Ward","Bell","Cooper","Turner","Scott","Adams","Evans","Clark","Hall","Young","King","Green","Baker","Nelson","Hill","Carter","Mitchell","Perez","Roberts","Collins","Stewart","Murphy","Cook","Rogers","Morris","Fisher","Cruz"];

const profiles = [];
const assessments = [];
const completions = [];
const journals = [];
const coping_plans = [];
const feedback = [];

for (let i = 1; i <= 52; i++) {
  const userId = `mock-user-${String(i).padStart(3,'0')}`;
  const participantId = `P-${1000 + i}`;
  const name = `${firstNames[(i-1) % firstNames.length]} ${lastNames[(i-1) % lastNames.length]}`;

  profiles.push({
    id: userId,
    participant_id: participantId,
    full_name: name,
    is_consent_given: true,
    is_admin: false,
    registration_date: new Date("2026-05-21T10:00:00Z").toISOString()
  });

  // Daily assessments from May 21 to Jun 6 (17 days)
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

    const triggerOptions = [
      "academic stress", "work pressure", "social situations", "health concerns",
      "financial worry", "family issues", "sleep problems", "deadlines", "news",
      "relationship stress", "loneliness", "public speaking", "future plans",
      "career uncertainty", "fear of change", "difficult decisions", "fear of unknown",
      "worried about future"
    ];
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
      indicators: { sleep: sleepVal, avoidance: avoidVal, concentration: concVal, irritability: irrVal, tension: tensVal, withdrawal: withVal, functioning: funcVal, triggers: trigger, confidence: confVal, support: support }
    });

    // ~60% chance of a completion each day
    if (Math.random() > 0.4) {
      const recOptions = ["breathing_exercise","sleep_hygiene","worry_postponement","progressive_relaxation","grounding_technique"];
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
      const notes = [
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
        "Struggling with the uncertainty of what lies ahead."
      ];
      journals.push({
        user_id: userId,
        mood: moodVal,
        triggers: trigger,
        note: notes[Math.floor(Math.random() * notes.length)],
        timestamp: iso
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Coping plan
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
  const stratSets = ["Box breathing, phone-free evenings, daily walks","Progressive relaxation, journaling, time-blocking","Worry postponement, mindfulness, exercise","Grounding techniques, sleep hygiene, social connection","Cognitive restructuring, gratitude practice, nature exposure"];
  const suppSets = ["GP (Dr. Smith), sister Sarah","Counsellor (Ms. Jones), partner","Therapist (Dr. Brown), best friend","University wellbeing service, flatmate","NHS helpline, parent"];

  coping_plans.push({
    user_id: userId,
    triggers: trigSets[i % trigSets.length],
    strategies: stratSets[i % stratSets.length],
    supports: suppSets[i % suppSets.length]
  });

  // Feedback for all participants
  feedback.push({
    user_id: userId,
    usability: Math.floor(Math.random() * 3) + 3, // 3-5
    clarity: Math.floor(Math.random() * 3) + 3,
    trust: Math.floor(Math.random() * 3) + 3,
    usefulness: Math.floor(Math.random() * 3) + 3,
    personalization: Math.floor(Math.random() * 3) + 3,
    rule_understanding: Math.floor(Math.random() * 3) + 3,
    continue_use: Math.floor(Math.random() * 3) + 3,
    open_text: [
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
    ][Math.floor(Math.random() * 15)]
  });
}

const fileContent = `window.MOCK_DASHBOARD_DATA = ${JSON.stringify({ profiles, assessments, completions, journals, coping_plans, feedback })};`;
fs.writeFileSync('js/mock_dashboard_data.js', fileContent);

console.log("Generated:");
console.log("  Profiles:", profiles.length);
console.log("  Assessments:", assessments.length);
console.log("  Completions:", completions.length);
console.log("  Journals:", journals.length);
console.log("  Coping Plans:", coping_plans.length);
console.log("  Feedback:", feedback.length);
