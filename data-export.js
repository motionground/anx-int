/* 
 * CSV Export Utility: Digital Anxiety Intervention Research Project
 * Formats JSON records into safe CSV strings and triggers downloads.
 */

const CSVExporter = {
  /**
   * Escapes a string for use in CSV
   * @param {String} val 
   * @returns {String}
   */
  escapeCSVField(val) {
    if (val === null || val === undefined) return "";
    let str = String(val);
    // If field contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    }
    return str;
  },

  /**
   * Converts array of objects to CSV string
   * @param {Array} headers - Array of header display names 
   * @param {Array} keys - Array of keys corresponding to data object properties
   * @param {Array} data - Array of objects
   * @returns {String}
   */
  convertToCSV(headers, keys, data) {
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.map(this.escapeCSVField).join(","));

    // Add data rows
    for (const row of data) {
      const values = keys.map(key => {
        return this.escapeCSVField(row[key]);
      });
      csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
  },

  /**
   * Triggers browser download of a CSV file
   * @param {String} csvContent 
   * @param {String} filename 
   */
  downloadFile(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  /**
   * Exports assessment history for a specific participant
   * @param {Array} assessments 
   * @param {String} participantId 
   */
  exportParticipantHistory(assessments, participantId) {
    const headers = [
      "Assessment Date", 
      "GAD-7 Total Score", 
      "Anxiety Severity", 
      "GAD-7 Q1 (Nervous/anxious/on edge)",
      "GAD-7 Q2 (Not being able to stop worrying)",
      "GAD-7 Q3 (Worrying too much about different things)",
      "GAD-7 Q4 (Trouble relaxing)",
      "GAD-7 Q5 (Restless/hard to sit still)",
      "GAD-7 Q6 (Becoming easily annoyed/irritable)",
      "GAD-7 Q7 (Feeling afraid as if something awful might happen)",
      "Sleep Quality (0-10)",
      "Avoidance Behaviour (0-10)",
      "Concentration (0-10)",
      "Irritability (0-10)",
      "Physical Tension (0-10)",
      "Social Withdrawal (0-10)",
      "Daily Functioning (0-10)",
      "Stress Triggers",
      "Coping Confidence (0-10)",
      "Support-Seeking"
    ];

    const keys = [
      "date",
      "score",
      "severity",
      "q1", "q2", "q3", "q4", "q5", "q6", "q7",
      "sleep", "avoidance", "concentration", "irritability", "tension", 
      "withdrawal", "functioning", "triggers", "confidence", "support"
    ];

    const formattedData = assessments.map(a => ({
      date: new Date(a.timestamp).toLocaleString(),
      score: a.score,
      severity: a.severity,
      q1: a.gad7[0],
      q2: a.gad7[1],
      q3: a.gad7[2],
      q4: a.gad7[3],
      q5: a.gad7[4],
      q6: a.gad7[5],
      q7: a.gad7[6],
      sleep: a.indicators.sleep,
      avoidance: a.indicators.avoidance,
      concentration: a.indicators.concentration,
      irritability: a.indicators.irritability,
      tension: a.indicators.tension,
      withdrawal: a.indicators.withdrawal,
      functioning: a.indicators.functioning,
      triggers: a.indicators.triggers,
      confidence: a.indicators.confidence,
      support: a.indicators.support
    }));

    const csvContent = this.convertToCSV(headers, keys, formattedData);
    this.downloadFile(csvContent, `anxiety_history_${participantId}.csv`);
  },

  /**
   * Exports all research data (fully anonymized) for the researcher
   * @param {Array} rawAssessments 
   */
  exportAllResearcherData(rawAssessments) {
    const headers = [
      "Participant ID",
      "Assessment ISO Timestamp",
      "GAD-7 Q1",
      "GAD-7 Q2",
      "GAD-7 Q3",
      "GAD-7 Q4",
      "GAD-7 Q5",
      "GAD-7 Q6",
      "GAD-7 Q7",
      "GAD-7 Total Score",
      "Anxiety Severity",
      "Sleep Quality (0-10)",
      "Avoidance Behaviour (0-10)",
      "Concentration (0-10)",
      "Irritability (0-10)",
      "Physical Tension (0-10)",
      "Social Withdrawal (0-10)",
      "Daily Functioning (0-10)",
      "Stress Triggers",
      "Coping Confidence (0-10)",
      "Support-Seeking"
    ];

    const keys = [
      "participantId",
      "timestamp",
      "gad7_q1",
      "gad7_q2",
      "gad7_q3",
      "gad7_q4",
      "gad7_q5",
      "gad7_q6",
      "gad7_q7",
      "gad7_total",
      "anxiety_severity",
      "ind_sleep",
      "ind_avoidance",
      "ind_concentration",
      "ind_irritability",
      "ind_tension",
      "ind_withdrawal",
      "ind_functioning",
      "ind_triggers",
      "ind_confidence",
      "ind_support"
    ];

    const csvContent = this.convertToCSV(headers, keys, rawAssessments);
    this.downloadFile(csvContent, "study_anonymized_assessments.csv");
  }
};

window.CSVExporter = CSVExporter;
