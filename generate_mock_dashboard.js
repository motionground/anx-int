const fs = require('fs');

const profiles = [];
const assessments = [];
const completions = [];
const journals = [];
const coping_plans = [];
const feedback = [];

for(let i=1; i<=52; i++) {
  const userId = `fake-uuid-${1000+i}`;
  const participantId = `P-${1000+i}`;
  
  profiles.push({
    id: userId,
    participant_id: participantId,
    is_consent_given: true,
    is_admin: false,
    registration_date: new Date("2026-05-21T10:00:00Z").toISOString()
  });

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

  coping_plans.push({
    user_id: userId,
    triggers: "General stress",
    strategies: "Breathing exercises",
    supports: "Family"
  });

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
      "Helped me understand my anxiety triggers better."
    ][Math.floor(Math.random() * 8)]
  });
}

const fileContent = `window.MOCK_DASHBOARD_DATA = ${JSON.stringify({ profiles, assessments, completions, journals, coping_plans, feedback })};`;
fs.writeFileSync('js/mock_dashboard_data.js', fileContent);
console.log("mock_dashboard_data.js generated!");
