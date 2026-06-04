/* 
 * Rules Engine: Digital Anxiety Intervention Research Project
 * Transparent IF-THEN rules for adaptive anxiety support.
 * Purely deterministic logic based on GAD-7 scores and behavioural indicators.
 * No AI/ML black box. Every recommendation outputs the exact rule that triggered it.
 */

// Master list of available interventions
const INTERVENTIONS = {
  mindfulness_general: {
    id: "mindfulness_general",
    title: "General Wellness & Mindfulness Practice",
    description: "Focus on 10 minutes of daily mindfulness, deep diaphragmatic breathing, or progressive muscle relaxation to maintain your baseline.",
    category: "General Wellness"
  },
  cognitive_reframing: {
    id: "cognitive_reframing",
    title: "Guided Cognitive Reframing",
    description: "Practice identifying anxious thoughts, check for cognitive distortions (such as catastrophizing or mind-reading), and form balanced, realistic thoughts.",
    category: "CBT Strategy"
  },
  behavioral_activation: {
    id: "behavioral_activation",
    title: "Structured Behavioral Activation",
    description: "Schedule three small, low-stress, and engaging activities this week. Follow a consistent routine despite feeling anxious or demotivated.",
    category: "CBT Strategy"
  },
  crisis_guidance: {
    id: "crisis_guidance",
    title: "Professional Support & Crisis Resources",
    description: "We strongly recommend contacting a doctor or mental health professional. Practice a 5-4-3-2-1 grounding exercise when feeling highly overwhelmed.",
    category: "Clinical Support"
  },
  sleep_hygiene: {
    id: "sleep_hygiene",
    title: "Sleep Hygiene Optimization",
    description: "Maintain a strict sleep schedule. Turn off all screens 2 hours before bed, avoid caffeine after 2 PM, and practice progressive muscle relaxation in bed.",
    category: "Somatic Strategy"
  },
  graded_exposure: {
    id: "graded_exposure",
    title: "Graded Exposure Activities",
    description: "Create a list of situations you avoid due to anxiety. Select the easiest one, break it into tiny steps, and practice exposure until anxiety decreases.",
    category: "Behavioral Strategy"
  },
  encouragement_maintain: {
    id: "encouragement_maintain",
    title: "Intervention Maintenance & Encouragement",
    description: "Your GAD-7 anxiety scores are in a steady downward trend. Continue with your current coping plan to stabilize your progress.",
    category: "Progress Tracking"
  },
  additional_coping: {
    id: "additional_coping",
    title: "Additional Coping Strategies & Social Support",
    description: "An increase in anxiety is a common part of the healing path. Focus on belly breathing, call a friend or supportive contact, and do not isolate.",
    category: "Coping Support"
  },
  simple_breathing: {
    id: "simple_breathing",
    title: "2-Minute Mindful Breathing Space",
    description: "Since completing longer exercises has been difficult, focus on this simple, short practice. Inhale for 4 seconds, exhale for 6 seconds.",
    category: "Micro-Intervention"
  }
};

// Plain English documentation of rules for the "Rule Logic" page
const TRANSPARENT_RULES = [
  {
    name: "Base Rule - Minimal Anxiety",
    logic: "IF GAD-7 score is 0 to 4 (Minimal Anxiety) THEN recommend General Wellness & Mindfulness Practice.",
    rationale: "Maintains positive mental health habits and keeps anxiety at a low baseline."
  },
  {
    name: "Base Rule - Mild Anxiety",
    logic: "IF GAD-7 score is 5 to 9 (Mild Anxiety) THEN recommend Guided Cognitive Reframing.",
    rationale: "Introduces standard Cognitive Behavioral Therapy (CBT) tools to address worrying thoughts before they escalate."
  },
  {
    name: "Base Rule - Moderate Anxiety",
    logic: "IF GAD-7 score is 10 to 14 (Moderate Anxiety) THEN recommend Structured Behavioral Activation.",
    rationale: "Combats behavioral paralysis by scheduling small, functional, positive activities."
  },
  {
    name: "Base Rule - Severe Anxiety & Safety Alert",
    logic: "IF GAD-7 score is 15 or more (Severe Anxiety) THEN recommend Professional Support & Crisis Resources AND display a high-severity emergency warning.",
    rationale: "Ensures participant safety when symptoms cross clinical levels that require human healthcare support."
  },
  {
    name: "Adaptive Rule - Persistent Downward Trend",
    logic: "IF GAD-7 score decreases over two weeks THEN recommend Intervention Maintenance & Encouragement.",
    rationale: "Reinforces self-efficacy and encourages the user to stick to their current healthy routines."
  },
  {
    name: "Adaptive Rule - Score Increase",
    logic: "IF GAD-7 score increases compared to the previous week THEN recommend Additional Coping Strategies and suggest reaching out to supports.",
    rationale: "Responds to rising distress with additional somatic support and reminders to avoid withdrawal."
  },
  {
    name: "Adaptive Rule - Repeated Sleep Distress",
    logic: "IF current sleep quality is poor (< 4/10) AND previous sleep quality was also poor (< 4/10) THEN prioritize Sleep Hygiene Optimization.",
    rationale: "Targets sleep quality directly as it is a core physiological driver of clinical anxiety."
  },
  {
    name: "Adaptive Rule - High Avoidance Behavior",
    logic: "IF avoidance behavior is high (> 6/10) THEN recommend Graded Exposure Activities.",
    rationale: "Encourages the participant to gently confront feared situations to break the cycle of avoidance reinforcement."
  },
  {
    name: "Adaptive Rule - Low Completion Rate",
    logic: "IF the user completed less than 50% of the previous week's recommendations THEN recommend Simpler, Shorter Activities (2-Minute Breathing Space).",
    rationale: "Lowers the barrier to entry to build confidence and compliance rather than overwhelming the participant."
  }
];

/**
 * Evaluates the user's data against the transparent clinical rule engine.
 * @param {Array} userAssessments - All GAD-7 assessments for this user in chronological order.
 * @param {Array} completions - All historical intervention completions.
 * @returns {Array} List of active recommendations.
 */
function evaluateRules(userAssessments, completions) {
  if (!userAssessments || userAssessments.length === 0) {
    return [];
  }

  const recommendations = [];
  const latest = userAssessments[userAssessments.length - 1];
  const previous = userAssessments.length > 1 ? userAssessments[userAssessments.length - 2] : null;
  const prePrevious = userAssessments.length > 2 ? userAssessments[userAssessments.length - 3] : null;

  // 1. BASE RULES (Based on GAD-7 Score Categories)
  if (latest.score <= 4) {
    recommendations.push({
      ...INTERVENTIONS.mindfulness_general,
      reason: `Your GAD-7 score is ${latest.score}, indicating minimal anxiety.`,
      ruleTriggered: "IF GAD-7 score is <= 4 THEN recommend General Wellness & Mindfulness Practice."
    });
  } else if (latest.score <= 9) {
    recommendations.push({
      ...INTERVENTIONS.cognitive_reframing,
      reason: `Your GAD-7 score is ${latest.score}, indicating mild anxiety.`,
      ruleTriggered: "IF GAD-7 score is 5 to 9 THEN recommend Guided Cognitive Reframing."
    });
  } else if (latest.score <= 14) {
    recommendations.push({
      ...INTERVENTIONS.behavioral_activation,
      reason: `Your GAD-7 score is ${latest.score}, indicating moderate anxiety.`,
      ruleTriggered: "IF GAD-7 score is 10 to 14 THEN recommend Structured Behavioral Activation."
    });
  } else {
    recommendations.push({
      ...INTERVENTIONS.crisis_guidance,
      reason: `Your GAD-7 score is ${latest.score}, indicating severe anxiety.`,
      ruleTriggered: "IF GAD-7 score is >= 15 THEN recommend Professional Support & Crisis Resources."
    });
  }

  // 2. ADAPTIVE RULES - GAD-7 TREND OVER TIME
  if (previous) {
    // If score increased
    if (latest.score > previous.score) {
      recommendations.push({
        ...INTERVENTIONS.additional_coping,
        reason: `Your GAD-7 score increased from ${previous.score} to ${latest.score} this week.`,
        ruleTriggered: "IF GAD-7 score increases THEN recommend Additional Coping Strategies and suggest support."
      });
    }
    // If score decreased over two consecutive weeks (requires 3 assessments: current, previous, pre-previous)
    else if (prePrevious && latest.score < previous.score && previous.score < prePrevious.score) {
      recommendations.push({
        ...INTERVENTIONS.encouragement_maintain,
        reason: `Your GAD-7 score has decreased consistently over the last two weeks (${prePrevious.score} → ${previous.score} → ${latest.score}).`,
        ruleTriggered: "IF GAD-7 score decreases over two weeks THEN recommend Intervention Maintenance & Encouragement."
      });
    }
  }

  // 3. ADAPTIVE RULES - SLEEP QUALITY
  if (latest.indicators.sleep < 4) {
    // Check if previous was also poor
    if (previous && previous.indicators.sleep < 4) {
      recommendations.push({
        ...INTERVENTIONS.sleep_hygiene,
        reason: `You reported poor sleep quality twice in a row (current: ${latest.indicators.sleep}/10, previous: ${previous.indicators.sleep}/10).`,
        ruleTriggered: "IF poor sleep is reported repeatedly THEN prioritize sleep hygiene intervention."
      });
    } else {
      // Just one poor sleep report - still recommend sleep hygiene but with a milder reason
      recommendations.push({
        ...INTERVENTIONS.sleep_hygiene,
        reason: `Your sleep quality was poor (${latest.indicators.sleep}/10) in this week's assessment.`,
        ruleTriggered: "IF sleep quality is poor THEN recommend sleep hygiene intervention."
      });
    }
  }

  // 4. ADAPTIVE RULES - AVOIDANCE BEHAVIOR
  if (latest.indicators.avoidance > 6) {
    recommendations.push({
      ...INTERVENTIONS.graded_exposure,
      reason: `You reported a high level of avoidance behavior (${latest.indicators.avoidance}/10).`,
      ruleTriggered: "IF avoidance remains high (> 6) THEN recommend graded exposure activities."
    });
  }

  // 5. ADAPTIVE RULES - COMPLETION RATE OF PREVIOUS INTERVENTIONS
  if (previous) {
    // Step A: Determine what was recommended last week
    // We can evaluate rules on the history up to the previous assessment
    const previousHistory = userAssessments.slice(0, userAssessments.length - 1);
    const previousRecommendations = evaluateRules(previousHistory, completions);

    if (previousRecommendations.length > 0) {
      // Step B: See how many of those recommendations were completed
      // We filter completions that occurred after the previous assessment timestamp and before latest
      const compForPrevious = completions.filter(c => {
        return previousRecommendations.some(r => r.id === c.recommendationId) &&
               c.timestamp >= previous.timestamp &&
               c.timestamp <= latest.timestamp;
      });

      const completionRate = compForPrevious.length / previousRecommendations.length;

      if (completionRate < 0.50) {
        recommendations.push({
          ...INTERVENTIONS.simple_breathing,
          reason: `You completed less than 50% of your recommendations last week (completed ${compForPrevious.length} of ${previousRecommendations.length}).`,
          ruleTriggered: "IF user does not complete previous interventions THEN recommend simpler, shorter activities."
        });
      }
    }
  }

  // Deduplicate recommendations by ID, keeping the one with higher precedence (e.g. if simple_breathing is recommended, keep it)
  const uniqueRecs = [];
  const seenIds = new Set();
  
  for (const rec of recommendations) {
    if (!seenIds.has(rec.id)) {
      seenIds.add(rec.id);
      uniqueRecs.push(rec);
    }
  }

  return uniqueRecs;
}

window.RulesEngine = {
  INTERVENTIONS,
  TRANSPARENT_RULES,
  evaluateRules
};
