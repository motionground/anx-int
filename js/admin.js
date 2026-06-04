/*
 * admin.js — Admin Dashboard Controller
 * Digital Anxiety Intervention Study
 *
 * Handles all researcher-facing views:
 *   - Main dashboard (participant list, stat cards)
 *   - Participant detail view (assessments, coping plan, journal, feedback)
 *   - CSV import / export
 *   - Delegated statistical analysis via StatisticsModule
 *
 * Relies on:
 *   - window.DB           (database.js)
 *   - window.RulesEngine  (rules.js)
 *   - window.CSVExporter  (data-export.js)
 *   - window.StatisticsModule (statistics.js)
 *   - window.app.currentUser  for auth guard
 */

const AdminController = (() => {

  // Tracks the currently open participant in the detail panel
  let _selectedParticipantId         = null;
  let _selectedParticipantAssessments = null;

  // Maps participant_id (e.g. 'P-102') → Supabase user_id UUID for filtering
  let _participantUserIdMap = {};

  // ─── Dashboard ─────────────────────────────────────────────────────────

  /*
   * Loads the main admin overview:
   * - Summary stat cards (enrolled users, assessment count, feedback rate)
   * - Participant progress table
   * Resets the stat-module placeholders so they don't show stale data.
   */
  async function loadAdminDashboard() {
    if (!window.app?.currentUser?.isAdmin) return;

    // Show main list panel, hide detail panel
    document.getElementById('admin-main-view').style.display  = 'block';
    document.getElementById('admin-detail-view').style.display = 'none';

    const adminData = await DB.getAdminData();

    const totalAssessments = adminData.reduce(
      (sum, p) => sum + (typeof p.assessmentCount === 'number' ? p.assessmentCount : 0), 0
    );
    const feedbackCount = adminData.filter(p => p.hasProvidedFeedback).length;
    const feedbackRate  = adminData.length > 0
      ? Math.round((feedbackCount / adminData.length) * 100)
      : 0;

    document.getElementById('admin-stat-users').innerText       = adminData.length;
    document.getElementById('admin-stat-assessments').innerText = totalAssessments;
    document.getElementById('admin-stat-feedback').innerText    = `${feedbackRate}%`;

    // Reset stat-module output areas to placeholder state
    _resetStatModulePlaceholders();

    // Populate participant selector checkboxes for analysis scope
    await _populateParticipantSelector();

    // Build participant progress table
    const tbody = document.getElementById('admin-participants-table').querySelector('tbody');
    tbody.innerHTML = '';

    if (adminData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No participant accounts registered.</td></tr>';
      return;
    }

    adminData.forEach(p => {
      const regDate = new Date(p.registrationDate).toLocaleDateString();
      const tr      = document.createElement('tr');
      tr.innerHTML  = `
        <td style="font-weight:600;">${p.participantId}</td>
        <td>${regDate}</td>
        <td>${p.assessmentCount}</td>
        <td style="font-weight:600;">${p.latestScore}</td>
        <td><span class="severity-indicator ${(p.latestSeverity || 'Minimal').toLowerCase()}">${p.latestSeverity}</span></td>
        <td>${p.completedInterventionsCount}</td>
        <td>${p.hasProvidedFeedback ? 'Yes' : 'No'}</td>
        <td style="text-align:center;">
          <button class="btn btn-secondary btn-small"
            onclick="app.showParticipantDetails('${p.participantId}')">View Details</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* Resets all three stat-module output areas back to their initial placeholder state. */
  function _resetStatModulePlaceholders() {
    const modules = [
      { id: 'stat-output-regression', msg: 'Run the analysis to compute the regression model.' },
      { id: 'stat-output-anova',      msg: 'Run the analysis to compute the t-test.' },
      { id: 'stat-output-nlp',        msg: 'Run the analysis to process trigger texts.' },
      { id: 'stat-output-feedback',   msg: 'Run the analysis to compute usability and trust metrics.' }
    ];
    modules.forEach(m => {
      const el = document.getElementById(m.id);
      if (el) el.innerHTML = `<div class="stat-placeholder">${m.msg}</div>`;
    });
    // Set run buttons based on whether any participant is selected
    const grid = document.getElementById('stat-selector-grid');
    const anySelected = grid ? grid.querySelectorAll('input[type="checkbox"]:checked').length > 0 : false;
    ['btn-run-regression', 'btn-run-anova', 'btn-run-nlp', 'btn-run-feedback', 'stat-run-all-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !anySelected;
    });
  }

  // ─── Participant Detail View ────────────────────────────────────────────

  /*
   * Opens the participant detail panel for the given participant ID.
   * Fetches full data (assessments, coping plan, journal, feedback, completions)
   * and populates all detail sections.
   */
  async function showParticipantDetails(participantId) {
    _selectedParticipantId = participantId;

    document.getElementById('admin-main-view').style.display  = 'none';
    document.getElementById('admin-detail-view').style.display = 'block';

    const detail = await DB.getParticipantDetailData(participantId);
    if (!detail) return;

    // Header
    const namePart = (detail.fullName && detail.fullName !== 'undefined' && detail.fullName !== 'null') ? ` (${detail.fullName})` : '';
    document.getElementById('admin-detail-title').innerText    = `Participant Details: ${detail.participantId}${namePart}`;
    document.getElementById('admin-detail-subtitle').innerText = `Registration Date: ${new Date(detail.registrationDate).toLocaleString()}`;

    const assessments = detail.assessments || [];

    // Summary stat cards
    _renderDetailStatCards(assessments, detail);

    // Coping plan section
    _renderCopingPlan(detail.coping);

    // Completed interventions list
    _renderCompletionsList(detail.completions || []);

    // Usability survey feedback
    _renderFeedbackSection(detail.feedback);

    // Mood journal entries
    _renderJournalEntries(detail.journal || []);

    // Check-in history table
    _renderAssessmentHistory(assessments);

    // SVG progress chart
    _selectedParticipantAssessments = assessments;
    drawParticipantProgressGraph(assessments);
  }

  /* Populates the four summary stat cards in the detail header. */
  function _renderDetailStatCards(assessments, detail) {
    let avgGad7 = '--', latestText = '--';
    if (assessments.length > 0) {
      const sum = assessments.reduce((s, a) => s + a.score, 0);
      avgGad7    = (sum / assessments.length).toFixed(1);
      const last = assessments[assessments.length - 1];
      latestText = `Latest: ${last.score} (${last.severity})`;
    }
    document.getElementById('admin-detail-stat-avg-gad7').innerText    = avgGad7;
    document.getElementById('admin-detail-stat-latest-gad7').innerText = latestText;

    const avgSleep = assessments.length > 0
      ? (assessments.reduce((s, a) => s + (Number(a.indicators?.sleep) || 0), 0) / assessments.length).toFixed(1)
      : '--';
    document.getElementById('admin-detail-stat-avg-sleep').innerText =
      avgSleep !== '--' ? `${avgSleep}/10` : '--';

    const avgAvoidance = assessments.length > 0
      ? (assessments.reduce((s, a) => s + (Number(a.indicators?.avoidance) || 0), 0) / assessments.length).toFixed(1)
      : '--';
    document.getElementById('admin-detail-stat-avg-avoidance').innerText =
      avgAvoidance !== '--' ? `${avgAvoidance}/10` : '--';

    const journalCount = (detail.journal || []).length;
    const compCount    = (detail.completions || []).length;
    document.getElementById('admin-detail-stat-counts').innerText     = `${compCount + journalCount}`;
    document.getElementById('admin-detail-stat-counts-sub').innerText = `${compCount} exercises, ${journalCount} journals`;
  }

  /* Renders the participant's coping plan fields. */
  function _renderCopingPlan(coping) {
    document.getElementById('admin-detail-coping-triggers').innerText   = coping?.triggers   || 'None defined';
    document.getElementById('admin-detail-coping-strategies').innerText = coping?.strategies || 'None defined';
    document.getElementById('admin-detail-coping-supports').innerText   = coping?.supports   || 'None defined';
  }

  /* Renders the completed interventions as a list with counts. */
  function _renderCompletionsList(completions) {
    const list = document.getElementById('admin-detail-completions-list');
    list.innerHTML = '';

    if (completions.length === 0) {
      list.innerHTML = '<li>No activities logged as completed yet.</li>';
      return;
    }

    // Aggregate completion counts per recommendation
    const counts = {};
    completions.forEach(c => {
      counts[c.recommendationId] = (counts[c.recommendationId] || 0) + 1;
    });
    Object.entries(counts).forEach(([id, count]) => {
      const item  = RulesEngine.INTERVENTIONS[id];
      const title = item ? item.title : id;
      list.innerHTML += `<li><strong>${title}</strong>: Completed ${count} time(s).</li>`;
    });
  }

  /* Renders usability and trust survey scores as star ratings. */
  function _renderFeedbackSection(feedback) {
    const container = document.getElementById('admin-detail-feedback-container');
    container.innerHTML = '';

    if (!feedback) {
      container.innerHTML = "<p class='slider-desc' style='margin:0;'>This participant has not submitted the usability &amp; trust feedback survey yet.</p>";
      return;
    }

    const metrics = [
      { key: 'usability',         label: 'Usability' },
      { key: 'clarity',           label: 'Clarity' },
      { key: 'trust',             label: 'Trust' },
      { key: 'usefulness',        label: 'Usefulness' },
      { key: 'personalization',   label: 'Personalization' },
      { key: 'ruleUnderstanding', label: 'Rule Understanding' },
      { key: 'continueUse',       label: 'Willingness to Continue' }
    ];

    let html = "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;'>";
    metrics.forEach(m => {
      const val   = feedback[m.key] || 0;
      const stars = Array.from({ length: 5 }, (_, i) =>
        `<span style='color:${i < val ? 'var(--accent-sage)' : 'var(--border-color)'};font-size:1.1rem;'>${i < val ? '★' : '☆'}</span>`
      ).join('');
      html += `<div><strong>${m.label}:</strong> <span style='display:inline-block;margin-left:0.5rem;'>${stars} (${val}/5)</span></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  /* Renders mood journal entries in reverse-chronological order. */
  function _renderJournalEntries(entries) {
    const feed = document.getElementById('admin-detail-journal-feed');
    feed.innerHTML = '';

    if (entries.length === 0) {
      feed.innerHTML = "<p class='slider-desc' style='margin:0;'>No mood journal logs registered by this participant.</p>";
      return;
    }

    entries.forEach(e => {
      const div = document.createElement('div');
      div.style.borderBottom = '1px dashed var(--border-color)';
      div.style.padding = '0.5rem 0';
      div.style.fontSize = '0.8rem';
      div.style.color = 'var(--text-secondary)';
      div.innerHTML = `
        <div style="margin-bottom: 0.15rem;"><strong>Date:</strong> ${new Date(e.timestamp).toLocaleString()}</div>
        <div style="margin-bottom: 0.15rem;"><strong>Mood Score:</strong> ${e.mood}/10</div>
        ${e.triggers ? `<div style="margin-bottom: 0.15rem;"><strong>Triggers:</strong> ${e.triggers}</div>` : ''}
        <div style="margin-top: 0.25rem; color: var(--text-primary);"><strong>Note:</strong> "${e.note}"</div>
      `;
      feed.appendChild(div);
    });
  }

  /*
   * Renders the expandable check-in history table.
   * Each row has an "Expand Detail" toggle that reveals full GAD-7 question
   * answers and all behavioural indicator values.
   */
  function _renderAssessmentHistory(assessments) {
    const tbody = document.getElementById('admin-detail-assessments-table').querySelector('tbody');
    tbody.innerHTML = '';

    if (assessments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No check-ins logged yet.</td></tr>';
      return;
    }

    const GAD7_QUESTIONS = [
      '1. Feeling nervous, anxious or on edge',
      '2. Not control/stop worrying',
      '3. Worrying too much about different things',
      '4. Trouble relaxing',
      '5. Restless, hard to sit still',
      '6. Becoming easily annoyed/irritable',
      '7. Feeling afraid as if something awful might happen'
    ];

    const answerLabel = v => {
      if (v === 1) return 'Several days';
      if (v === 2) return 'More than half the days';
      if (v === 3) return 'Nearly every day';
      return 'Not at all';
    };

    assessments.forEach((a, idx) => {
      const dateStr  = new Date(a.timestamp).toLocaleString();
      const detailId = `admin-assess-detail-${idx}`;

      // Summary row
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${dateStr}</td>
        <td style="font-weight:600;">${a.score}</td>
        <td><span class="severity-indicator ${a.severity.toLowerCase()}">${a.severity}</span></td>
        <td>${a.indicators?.sleep}/10</td>
        <td>${a.indicators?.avoidance}/10</td>
        <td>${a.indicators?.functioning}/10</td>
        <td style="text-align:center;">
          <button class="btn btn-small" style="background-color: transparent; color: var(--text-secondary); border: 1px solid var(--border-color); cursor: pointer;"
            onclick="app.toggleAssessmentRowDetail('${detailId}', this)">Expand Detail</button>
        </td>
      `;
      tbody.appendChild(tr);

      // Collapsible detail row — hidden by default
      const detailTr = document.createElement('tr');
      detailTr.id    = detailId;
      detailTr.style.display         = 'none';
      detailTr.style.backgroundColor = 'var(--bg-secondary)';

      let gadHTML = "<ul style='margin:0;padding-left:1.2rem;font-size:0.82rem;'>";
      for (let qi = 0; qi < 7; qi++) {
        const val = a.gad7?.[qi] ?? '--';
        gadHTML += `<li><strong>Q${qi+1} (${GAD7_QUESTIONS[qi]}):</strong> ${val} — <em>${answerLabel(val)}</em></li>`;
      }
      gadHTML += '</ul>';

      const ind = a.indicators || {};
      detailTr.innerHTML = `
        <td colspan="7" style="padding:1.25rem;border-bottom:2px solid var(--border-color);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
            <div>
              <h4 style="margin:0 0 0.5rem 0;font-size:0.9rem;font-weight:600;">GAD-7 Question Responses:</h4>
              ${gadHTML}
            </div>
            <div>
              <h4 style="margin:0 0 0.5rem 0;font-size:0.9rem;font-weight:600;">Behavioural Parameters &amp; Triggers:</h4>
              <ul style="margin:0;padding-left:1.2rem;font-size:0.82rem;display:flex;flex-direction:column;gap:0.25rem;">
                <li><strong>Concentration:</strong> ${ind.concentration}/10</li>
                <li><strong>Irritability:</strong> ${ind.irritability}/10</li>
                <li><strong>Physical Body Tension:</strong> ${ind.tension}/10</li>
                <li><strong>Social Withdrawal:</strong> ${ind.withdrawal}/10</li>
                <li><strong>Coping Confidence:</strong> ${ind.confidence}/10</li>
                <li><strong>Stress Triggers:</strong> <em>${ind.triggers || 'None logged'}</em></li>
                <li><strong>Support-Seeking:</strong> <em>${ind.support || 'No'}</em></li>
              </ul>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(detailTr);
    });
  }

  /* Closes the participant detail panel and returns to the main overview list. */
  function closeParticipantDetails() {
    _selectedParticipantId          = null;
    _selectedParticipantAssessments = null;
    document.getElementById('admin-main-view').style.display  = 'block';
    document.getElementById('admin-detail-view').style.display = 'none';
  }

  /* Toggle expand/collapse for an assessment detail row. */
  function toggleAssessmentRowDetail(detailId, button) {
    const row = document.getElementById(detailId);
    if (!row) return;
    const isHidden = row.style.display === 'none';
    row.style.display  = isHidden ? 'table-row' : 'none';
    button.innerText   = isHidden ? 'Hide Detail' : 'Expand Detail';
  }

  /* Re-renders the participant SVG chart using the cached assessment data. */
  function refreshParticipantGraph() {
    if (_selectedParticipantAssessments) {
      drawParticipantProgressGraph(_selectedParticipantAssessments);
    }
  }

  // ─── Participant Progress SVG Chart ────────────────────────────────────

  /*
   * Draws a GAD-7 line chart for a single participant.
   * Optionally overlays sleep quality and avoidance lines,
   * controlled by the two admin toggle checkboxes.
   *
   * Chart axes: X = check-in sequence, Y = score (0–21 for GAD-7; 0–10 for overlays).
   */
  function drawParticipantProgressGraph(assessments) {
    const container = document.getElementById('admin-detail-graph-wrapper');
    if (!container) return;

    if (assessments.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);margin:2rem 0;">No assessment entries submitted yet.</p>';
      return;
    }

    const showSleep    = document.getElementById('admin-toggle-overlay-sleep')?.checked    ?? false;
    const showAvoidance = document.getElementById('admin-toggle-overlay-avoidance')?.checked ?? false;

    const W = 800, H = 250;
    const pad = { top: 40, right: 30, bottom: 45, left: 50 };
    const maxScore  = 21;
    const chartW    = W - pad.left - pad.right;
    const chartH    = H - pad.top  - pad.bottom;
    const stepX     = assessments.length > 1 ? chartW / (assessments.length - 1) : chartW;

    // Helper: map a Y value (on 0–maxScale) to SVG y coordinate
    const toY = (v, maxScale) =>
      H - pad.bottom - (v / maxScale) * chartH;

    // Helper: build SVG <path> d-attribute from an array of {x, y} points
    const linePath = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%"
      xmlns="http://www.w3.org/2000/svg" style="background-color:var(--bg-primary);">`;

    // Horizontal threshold lines at 5 (Mild), 10 (Moderate), 15 (Severe)
    [{ y: 5, label: '5 (Mild)', c: 'var(--border-color)' },
     { y: 10, label: '10 (Mod)', c: 'var(--border-color)' },
     { y: 15, label: '15 (Sev)', c: 'var(--alert-red)' }
    ].forEach(g => {
      const gy = toY(g.y, maxScore);
      svg += `<line x1="${pad.left}" y1="${gy}" x2="${W - pad.right}" y2="${gy}"
        style="stroke:${g.c};stroke-dasharray:4,3;stroke-width:1;"/>`;
      svg += `<text x="${pad.left - 8}" y="${gy + 4}" class="trend-label" text-anchor="end">${g.label}</text>`;
    });

    // X-axis base line
    const baseY = H - pad.bottom;
    svg += `<line x1="${pad.left}" y1="${baseY}" x2="${W - pad.right}" y2="${baseY}"
      style="stroke:var(--text-primary);stroke-width:1;"/>`;

    // Build point coordinates for each series
    const pts = assessments.map((a, i) => ({
      x: pad.left + (assessments.length > 1 ? i * stepX : chartW / 2),
      y: toY(a.score, maxScore),
      a
    }));

    const sleepPts = showSleep ? assessments.map((a, i) => ({
      x: pad.left + (assessments.length > 1 ? i * stepX : chartW / 2),
      y: toY(a.indicators?.sleep || 0, 10),
      val: a.indicators?.sleep || 0
    })) : [];

    const avoidPts = showAvoidance ? assessments.map((a, i) => ({
      x: pad.left + (assessments.length > 1 ? i * stepX : chartW / 2),
      y: toY(a.indicators?.avoidance || 0, 10),
      val: a.indicators?.avoidance || 0
    })) : [];

    // Sleep overlay line
    if (sleepPts.length > 1) {
      svg += `<path d="${linePath(sleepPts)}" style="fill:none;stroke:var(--accent-slate);stroke-width:1.5;stroke-dasharray:4;"/>`;
      sleepPts.forEach(p => {
        svg += `<rect x="${p.x-3.5}" y="${p.y-3.5}" width="7" height="7" style="fill:var(--accent-slate);cursor:pointer;"
          onclick="alert('Sleep Quality: ${p.val}/10')"/>`;
        svg += `<text x="${p.x}" y="${p.y-8}" class="trend-label" text-anchor="middle" style="fill:var(--accent-slate);font-weight:500;">S:${p.val}</text>`;
      });
    }

    // Avoidance overlay line
    if (avoidPts.length > 1) {
      svg += `<path d="${linePath(avoidPts)}" style="fill:none;stroke:var(--alert-red);stroke-width:1.5;stroke-dasharray:4;"/>`;
      avoidPts.forEach(p => {
        svg += `<polygon points="${p.x},${p.y-4.5} ${p.x+4.5},${p.y} ${p.x},${p.y+4.5} ${p.x-4.5},${p.y}"
          style="fill:var(--alert-red);cursor:pointer;" onclick="alert('Avoidance Level: ${p.val}/10')"/>`;
        svg += `<text x="${p.x}" y="${p.y+12}" class="trend-label" text-anchor="middle" style="fill:var(--alert-red);font-weight:500;">A:${p.val}</text>`;
      });
    }

    // Primary GAD-7 line
    if (pts.length > 1) {
      svg += `<path d="${linePath(pts)}" class="trend-line"/>`;
    }

    // Data point circles with click tooltips
    pts.forEach(p => {
      const date = new Date(p.a.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      svg += `<circle cx="${p.x}" cy="${p.y}" r="5" class="trend-point"
        onclick="alert('Date: ${date}\\nGAD-7: ${p.a.score} (${p.a.severity})\\nSleep: ${p.a.indicators?.sleep}/10\\nAvoidance: ${p.a.indicators?.avoidance}/10')"/>`;
      svg += `<text x="${p.x}" y="${p.y-10}" class="trend-label" text-anchor="middle" style="font-weight:600;fill:var(--text-primary);">${p.a.score}</text>`;
      svg += `<text x="${p.x}" y="${H-15}" class="trend-label" text-anchor="middle" transform="rotate(-15,${p.x},${H-15})">${date}</text>`;
    });

    // Legend box
    svg += `
      <g transform="translate(${W-365},10)" style="font-size:10px;font-family:var(--font-sans);">
        <rect width="350" height="20" fill="var(--bg-secondary)" stroke="var(--border-color)"/>
        <line x1="10" y1="10" x2="25" y2="10" style="stroke:var(--accent-sage);stroke-width:2.5;"/>
        <circle cx="17.5" cy="10" r="3" style="fill:var(--accent-sage);"/>
        <text x="32" y="13" class="trend-label" style="fill:var(--text-primary);font-weight:500;">GAD-7 Score</text>
        <line x1="120" y1="10" x2="135" y2="10" style="stroke:var(--accent-slate);stroke-width:1.5;stroke-dasharray:2;"/>
        <rect x="124.5" y="7" width="6" height="6" style="fill:var(--accent-slate);"/>
        <text x="142" y="13" class="trend-label" style="fill:var(--text-primary);font-weight:500;">Sleep (0-10)</text>
        <line x1="230" y1="10" x2="245" y2="10" style="stroke:var(--alert-red);stroke-width:1.5;stroke-dasharray:2;"/>
        <polygon points="237.5,7 240.5,10 237.5,13 234.5,10" style="fill:var(--alert-red);"/>
        <text x="252" y="13" class="trend-label" style="fill:var(--text-primary);font-weight:500;">Avoidance (0-10)</text>
      </g>`;

    svg += '</svg>';
    container.innerHTML = svg;
  }

  // ─── CSV Import ───────────────────────────────────────────────────────

  /*
   * RFC 4180-compliant CSV parser.
   * Handles quoted fields, escaped double-quotes, and Windows/Unix line endings.
   * Returns a 2D array: rows × columns.
   */
  function parseCSV(text) {
    const lines = [];
    let row      = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c    = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
        else                         { inQuotes = !inQuotes; }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row);
    return lines;
  }

  /*
   * Handles the CSV file import flow:
   *   1. Parse the uploaded file
   *   2. Map headers to internal field names
   *   3. Confirm with user before writing
   *   4. Stream records to DB with progress bar overlay
   *   5. Refresh admin dashboard on completion
   */
  async function importDatasetCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = async e => {
      const text        = e.target.result;
      const parsedLines = parseCSV(text);

      if (parsedLines.length < 2) {
        alert('Invalid CSV file: empty or missing data rows.');
        return;
      }

      // Map exported column headers → internal field names
      const HEADER_MAP = {
        'Participant ID':              'participantId',
        'Assessment ISO Timestamp':    'timestamp',
        'GAD-7 Q1':                   'gad7_q1',
        'GAD-7 Q2':                   'gad7_q2',
        'GAD-7 Q3':                   'gad7_q3',
        'GAD-7 Q4':                   'gad7_q4',
        'GAD-7 Q5':                   'gad7_q5',
        'GAD-7 Q6':                   'gad7_q6',
        'GAD-7 Q7':                   'gad7_q7',
        'GAD-7 Total Score':          'gad7_total',
        'Anxiety Severity':           'anxiety_severity',
        'Sleep Quality (0-10)':       'ind_sleep',
        'Avoidance Behaviour (0-10)': 'ind_avoidance',
        'Concentration (0-10)':       'ind_concentration',
        'Irritability (0-10)':        'ind_irritability',
        'Physical Tension (0-10)':    'ind_tension',
        'Social Withdrawal (0-10)':   'ind_withdrawal',
        'Daily Functioning (0-10)':   'ind_functioning',
        'Stress Triggers':            'ind_triggers',
        'Coping Confidence (0-10)':   'ind_confidence',
        'Support-Seeking':            'ind_support'
      };

      const headerRow = parsedLines[0].map(h => h.trim());
      const records   = parsedLines.slice(1)
        .filter(row => !(row.length === 1 && row[0] === ''))
        .map(row => {
          const rec = {};
          headerRow.forEach((h, i) => { rec[HEADER_MAP[h] || h] = row[i]; });
          return rec;
        })
        .filter(rec => rec.participantId);

      if (records.length === 0) {
        alert('No valid assessment records found in CSV. Ensure headers match the export format.');
        return;
      }

      const confirmed = confirm(
        `Import ${records.length} assessments into the database?\nExisting records will be appended; new participants will be created.`
      );
      if (!confirmed) return;

      const overlay      = document.getElementById('import-loading-overlay');
      const progressText = document.getElementById('import-progress-text');
      const progressBar  = document.getElementById('import-progress-bar');
      overlay.style.display = 'flex';

      let importedCount = 0, failedCount = 0;

      for (let i = 0; i < records.length; i++) {
        progressText.innerText  = `Importing record ${i + 1} of ${records.length} (${records[i].participantId})...`;
        progressBar.style.width = `${Math.round(((i + 1) / records.length) * 100)}%`;
        try {
          const res = await DB.importAssessmentRow(records[i]);
          res.success ? importedCount++ : failedCount++;
        } catch { failedCount++; }
      }

      overlay.style.display = 'none';
      alert(`Import complete!\n- Imported: ${importedCount}\n- Failed/Skipped: ${failedCount}`);
      await loadAdminDashboard();
    };

    reader.onerror = () => alert('Failed to read the selected CSV file.');
    reader.readAsText(file);
  }

  // ─── CSV Export ───────────────────────────────────────────────────────

  /* Exports all participant assessment records as a researcher CSV download. */
  async function exportAllStudyCSV() {
    if (!window.app?.currentUser?.isAdmin) return;
    const rawAssessments = await DB.getAllAssessmentsRaw();
    CSVExporter.exportAllResearcherData(rawAssessments);
  }

  // ─── Participant Selector for Analysis Scope ────────────────────────

  /*
   * Fetches all non-admin profiles from Supabase and renders
   * a grid of selectable participant chips.
   * Stores the participant_id → user_id mapping for later filtering.
   * All participants start deselected/unchecked by default.
   */
  async function _populateParticipantSelector() {
    const grid = document.getElementById('stat-selector-grid');
    if (!grid) return;

    // Fetch profiles directly (non-admin only)
    const profiles = await DB.getParticipantProfiles();
    _participantUserIdMap = {};

    if (!profiles || profiles.length === 0) {
      grid.innerHTML = '<div class="stat-placeholder" style="grid-column:1/-1;">No participants enrolled yet.</div>';
      _updateSelectorCount();
      return;
    }

    grid.innerHTML = '';
    profiles.forEach(p => {
      _participantUserIdMap[p.participantId] = p.userId;

      const chip = document.createElement('label');
      chip.className = 'stat-selector-chip';
      chip.innerHTML = `
        <input type="checkbox"
          data-participant-id="${p.participantId}"
          data-user-id="${p.userId}"
          onchange="AdminController.onParticipantCheckChanged(this)">
        <span class="stat-selector-chip-label">${p.participantId}</span>
        <span class="stat-selector-chip-meta">${p.assessmentCount} check-in${p.assessmentCount !== 1 ? 's' : ''}</span>
      `;
      grid.appendChild(chip);
    });

    _updateSelectorCount();
  }

  /* Recalculates and updates the "X of Y selected" counter badge. */
  function _updateSelectorCount() {
    const grid = document.getElementById('stat-selector-grid');
    const badge = document.getElementById('stat-selector-count');
    if (!grid || !badge) return;

    const all = grid.querySelectorAll('input[type="checkbox"]');
    const checked = grid.querySelectorAll('input[type="checkbox"]:checked');
    badge.textContent = `${checked.length} of ${all.length} selected`;

    // Disable run buttons if no participants are selected
    const anySelected = checked.length > 0;
    ['btn-run-regression', 'btn-run-anova', 'btn-run-nlp', 'btn-run-feedback', 'stat-run-all-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !anySelected;
    });
  }

  /* Called when an individual participant checkbox changes. */
  function onParticipantCheckChanged(checkbox) {
    const chip = checkbox.closest('.stat-selector-chip');
    if (chip) {
      chip.classList.toggle('selected', checkbox.checked);
    }
    _updateSelectorCount();
  }

  /* Check all participant checkboxes. */
  function selectAllParticipants() {
    const grid = document.getElementById('stat-selector-grid');
    if (!grid) return;
    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      const chip = cb.closest('.stat-selector-chip');
      if (chip) chip.classList.add('selected');
    });
    _updateSelectorCount();
  }

  /* Uncheck all participant checkboxes. */
  function deselectAllParticipants() {
    const grid = document.getElementById('stat-selector-grid');
    if (!grid) return;
    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      const chip = cb.closest('.stat-selector-chip');
      if (chip) chip.classList.remove('selected');
    });
    _updateSelectorCount();
  }

  /*
   * Returns an array of Supabase user_id UUIDs for currently checked
   * participants, or null if ALL are checked (meaning "no filter").
   */
  function getSelectedUserIds() {
    const grid = document.getElementById('stat-selector-grid');
    if (!grid) return null;

    const all     = grid.querySelectorAll('input[type="checkbox"]');
    const checked = grid.querySelectorAll('input[type="checkbox"]:checked');

    // If everything is selected, return null to mean "use all data"
    if (checked.length === all.length) return null;
    // If nothing is selected, return empty array
    if (checked.length === 0) return [];

    return Array.from(checked).map(cb => cb.dataset.userId);
  }

  // ─── Statistical Analysis Delegates ──────────────────────────────────

  /*
   * Each delegate reads the current participant selection and passes
   * the user_id filter array to StatisticsModule.
   * null = all participants, [] = none, [...ids] = specific subset.
   */
  const runRegressionAnalysis     = () => StatisticsModule.runRegressionAnalysis(getSelectedUserIds());
  const runAnovaAnalysis          = () => StatisticsModule.runAnovaAnalysis(getSelectedUserIds());
  const runNlpAnalysis            = () => StatisticsModule.runNlpAnalysis(getSelectedUserIds());
  const runFeedbackAnalysis       = () => StatisticsModule.runFeedbackAnalysis(getSelectedUserIds());
  const runAllStatisticalAnalyses = () => StatisticsModule.runAllStatisticalAnalyses(getSelectedUserIds());

  // ─── Public API ───────────────────────────────────────────────────────

  return {
    loadAdminDashboard,
    showParticipantDetails,
    closeParticipantDetails,
    toggleAssessmentRowDetail,
    refreshParticipantGraph,
    drawParticipantProgressGraph,
    parseCSV,
    importDatasetCSV,
    exportAllStudyCSV,
    runRegressionAnalysis,
    runAnovaAnalysis,
    runNlpAnalysis,
    runFeedbackAnalysis,
    runAllStatisticalAnalyses,
    selectAllParticipants,
    deselectAllParticipants,
    onParticipantCheckChanged,
    getSelectedUserIds
  };

})();

window.AdminController = AdminController;
