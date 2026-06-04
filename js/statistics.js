/*
 * statistics.js — Research Statistical Analysis Module
 * Digital Anxiety Intervention Study
 *
 * Provides three independent analysis routines:
 *   1. Multiple Linear Regression  — predicts GAD-7 from sleep, avoidance, tension
 *   2. Paired t-Test               — tests if GAD-7 significantly decreased baseline → final
 *   3. NLP Trigger Categorisation  — clusters free-text trigger entries into themes
 *
 * All methods are pure functions of the data received from DB.
 * Rendering writes directly into the stat-output-* DOM nodes in index.html.
 */

const StatisticsModule = (() => {

  // ─── Matrix Helpers ──────────────────────────────────────────────────────

  /*
   * Multiply two matrices A (m×p) and B (p×n), returning an m×n result.
   * Each matrix is represented as a flat row-major 1D array.
   */
  function matMul(A, B, m, p, n) {
    const C = new Array(m * n).fill(0);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < p; k++) {
          C[i * n + j] += A[i * p + k] * B[k * n + j];
        }
      }
    }
    return C;
  }

  /* Transpose an m×n matrix to n×m. */
  function matTranspose(A, m, n) {
    const T = new Array(m * n).fill(0);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        T[j * m + i] = A[i * n + j];
      }
    }
    return T;
  }

  /*
   * Inverts an n×n matrix using Gauss-Jordan elimination.
   * Returns a flat array of size n*n, or null if singular (determinant ≈ 0).
   * Used to solve the OLS normal equations: β = (XᵀX)⁻¹ Xᵀy
   */
  function matInvert(A, n) {
    const temp = [];
    for (let i = 0; i < n; i++) {
      temp[i] = [];
      for (let j = 0; j < n; j++) {
        temp[i][j] = A[i * n + j];
      }
      for (let j = 0; j < n; j++) {
        temp[i][j + n] = (i === j) ? 1 : 0;
      }
    }

    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(temp[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(temp[k][i]) > maxEl) {
          maxEl = Math.abs(temp[k][i]);
          maxRow = k;
        }
      }

      if (maxEl < 1e-10) return null; // Singular matrix
      const swap = temp[i];
      temp[i] = temp[maxRow];
      temp[maxRow] = swap;

      const pivot = temp[i][i];
      for (let j = i; j < 2 * n; j++) {
        temp[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const c = temp[k][i];
          for (let j = i; j < 2 * n; j++) {
            temp[k][j] -= c * temp[i][j];
          }
        }
      }
    }

    const inv = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        inv[i * n + j] = temp[i][j + n];
      }
    }
    return inv;
  }

  // ─── t-Distribution p-value Approximation ────────────────────────────────

  /*
   * Approximates the two-tailed p-value for a given t-statistic and degrees of freedom
   * using the incomplete beta function via a continued fraction algorithm (Lentz method).
   * This is a numerical approximation suitable for df ≥ 1.
   *
   * Returns p between 0 and 1. p < 0.05 → statistically significant at 95% CI.
   */
  function tDistPValue(t, df) {
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;

    // Regularised incomplete beta function I_x(a, b) via continued fraction
    function incompleteBeta(x, a, b) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
      const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
      return front * betaCF(x, a, b);
    }

    function lgamma(z) {
      // Lanczos approximation
      const g = 7;
      const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
      if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
      z -= 1;
      let x = c[0];
      for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
      const t2 = z + g + 0.5;
      return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t2) - t2 + Math.log(x);
    }

    function betaCF(x, a, b) {
      // Lentz continued fraction
      const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30;
      const qab = a + b, qap = a + 1, qam = a - 1;
      let c = 1, d = 1 - qab * x / qap;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      d = 1 / d;
      let h = d;
      for (let m = 1; m <= MAXIT; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < EPS) break;
      }
      return h;
    }

    const ib = incompleteBeta(x, a, b);
    return ib; // Two-tailed p-value
  }

  // ─── Rendering Helpers ────────────────────────────────────────────────────

  function renderOutput(containerId, bodyHTML, insightHTML) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div>${bodyHTML}</div>
      ${insightHTML ? `<div class="stat-insight-block">${insightHTML}</div>` : ''}
    `;
  }

  /* Render a row of summary stat cards (label / value / sublabel). */
  function statResultRow(cards) {
    const inner = cards.map(c => `
      <div class="stat-result-card">
        <div class="label">${c.label}</div>
        <div class="value">${c.value}</div>
        ${c.sub ? `<div class="sublabel">${c.sub}</div>` : ''}
      </div>
    `).join('');
    return `<div class="stat-result-row">${inner}</div>`;
  }

  /* Set a Run button to loading/idle state. */
  function setBtnState(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Running…' : 'Run Analysis';
  }

  /* Show a "not enough data" message in the output area. */
  function showInsufficient(containerId, msg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="stat-placeholder" style="color:var(--alert-red);">${msg}</div>`;
  }

  // ─── Module 1: Multiple Linear Regression ────────────────────────────────

  async function runRegressionAnalysis(userIds) {
    setBtnState('btn-run-regression', true);
    try {
      if (Array.isArray(userIds) && userIds.length === 0) {
        showInsufficient('stat-output-regression', 'No participants selected. Use the selector above to choose at least one.');
        return;
      }

      const data = await DB.getCohortAnalyticsData();
      let assessments = data.assessments || [];
      const completions = data.completions || [];

      // Filter by selected participants if a subset is specified
      if (Array.isArray(userIds)) {
        const idSet = new Set(userIds);
        assessments = assessments.filter(a => idSet.has(a.user_id));
      }

      // Extract rows with indicators and match them with completions engaged up to that check-in
      const rows = assessments.filter(a =>
        a.score !== null &&
        a.indicators?.sleep !== undefined &&
        a.indicators?.avoidance !== undefined &&
        a.indicators?.tension !== undefined
      ).map(a => {
        const userComps = completions.filter(c => c.user_id === a.user_id);
        const aTime = new Date(a.timestamp).getTime();
        const engagement = userComps.filter(c => new Date(c.timestamp).getTime() <= aTime).length;
        return {
          y:        Number(a.score),
          sleep:    Number(a.indicators.sleep),
          avoid:    Number(a.indicators.avoidance),
          tension:  Number(a.indicators.tension),
          engagement: engagement
        };
      });

      if (rows.length < 1) {
        showInsufficient('stat-output-regression', 'No assessment records found for the selected participant(s).');
        return;
      }

      const n = rows.length;

      // OLS regression with 4 predictors (intercept + sleep + avoidance + tension + engagement) requires at least 5 points.
      if (n < 5) {
        const meanY = rows.reduce((s, r) => s + r.y, 0) / n;
        const meanSleep = rows.reduce((s, r) => s + r.sleep, 0) / n;
        const meanAvoid = rows.reduce((s, r) => s + r.avoid, 0) / n;
        const meanTension = rows.reduce((s, r) => s + r.tension, 0) / n;
        const meanEngage = rows.reduce((s, r) => s + r.engagement, 0) / n;

        const cards = statResultRow([
          { label: 'Observations (n)',  value: n,                   sub: 'Check-in records used' },
          { label: 'Avg GAD-7 Score',   value: meanY.toFixed(1),    sub: 'Mean anxiety' },
          { label: 'Avg Completions',   value: meanEngage.toFixed(1), sub: 'Mean recommendations completed' }
        ]);

        const descTable = `
          <table class="stat-coef-table">
            <thead>
              <tr><th>Variable</th><th>Descriptive Mean</th><th>Scale Range</th><th>Interpretation</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>GAD-7 Anxiety</strong></td>
                <td style="font-family:monospace;">${meanY.toFixed(2)}</td>
                <td>0 - 21</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Current mean anxiety level for selected scope.</td>
              </tr>
              <tr>
                <td><strong>Sleep Quality</strong></td>
                <td style="font-family:monospace;">${meanSleep.toFixed(2)}</td>
                <td>0 - 10</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Higher score means better sleep quality.</td>
              </tr>
              <tr>
                <td><strong>Avoidance</strong></td>
                <td style="font-family:monospace;">${meanAvoid.toFixed(2)}</td>
                <td>0 - 10</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Higher score means more avoidance behavior.</td>
              </tr>
              <tr>
                <td><strong>Physical Tension</strong></td>
                <td style="font-family:monospace;">${meanTension.toFixed(2)}</td>
                <td>0 - 10</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Higher score means more physical anxiety symptoms.</td>
              </tr>
              <tr>
                <td><strong>Recommendation Engagement</strong></td>
                <td style="font-family:monospace;">${meanEngage.toFixed(2)}</td>
                <td>0+</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Average number of recommended exercises completed at check-in.</td>
              </tr>
            </tbody>
          </table>`;

        const insight = `
          <strong>Descriptive Profile (n=${n}):</strong><br>
          Multiple Linear Regression with engagement tracking requires at least 5 check-in records to compute coefficients. 
          With ${n} record(s), we display the average values above. 
          To estimate regression coefficients, select more participants or participants with at least 5 total check-ins.
        `;

        renderOutput('stat-output-regression', cards + descTable, insight);
        return;
      }

      const p = 5; // intercept + 4 predictors

      // Build design matrix X (n × 5) and response vector y (n × 1) — flat arrays
      const X  = new Array(n * p);
      const y  = new Array(n);
      rows.forEach((r, i) => {
        X[i * p + 0] = 1;        // intercept column
        X[i * p + 1] = r.sleep;
        X[i * p + 2] = r.avoid;
        X[i * p + 3] = r.tension;
        X[i * p + 4] = r.engagement;
        y[i] = r.y;
      });

      // β = (XᵀX)⁻¹ Xᵀy
      const Xt      = matTranspose(X, n, p);
      const XtX     = matMul(Xt, X, p, n, p);
      const XtXinv  = matInvert(XtX, p);

      if (!XtXinv) {
        // Fall back to descriptive stats
        const meanY = rows.reduce((s, r) => s + r.y, 0) / n;
        const meanSleep = rows.reduce((s, r) => s + r.sleep, 0) / n;
        const meanAvoid = rows.reduce((s, r) => s + r.avoid, 0) / n;
        const meanTension = rows.reduce((s, r) => s + r.tension, 0) / n;
        const meanEngage = rows.reduce((s, r) => s + r.engagement, 0) / n;

        const cards = statResultRow([
          { label: 'Observations (n)',  value: n,                   sub: 'Check-in records used' },
          { label: 'Avg GAD-7 Score',   value: meanY.toFixed(1),    sub: 'Mean anxiety' },
          { label: 'Avg Completions',   value: meanEngage.toFixed(1), sub: 'Mean recommendations completed' }
        ]);

        const descTable = `
          <table class="stat-coef-table">
            <thead>
              <tr><th>Variable</th><th>Descriptive Mean</th><th>Scale Range</th><th>Interpretation</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>GAD-7 Anxiety</strong></td>
                <td style="font-family:monospace;">${meanY.toFixed(2)}</td>
                <td>0 - 21</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Current mean anxiety level for selected scope.</td>
              </tr>
              <tr>
                <td><strong>Sleep Quality</strong></td>
                <td style="font-family:monospace;">${meanSleep.toFixed(2)}</td>
                <td>0 - 10</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Higher score means better sleep quality.</td>
              </tr>
              <tr>
                <td><strong>Avoidance</strong></td>
                <td style="font-family:monospace;">${meanAvoid.toFixed(2)}</td>
                <td>0 - 10</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Higher score means more avoidance behavior.</td>
              </tr>
              <tr>
                <td><strong>Physical Tension</strong></td>
                <td style="font-family:monospace;">${meanTension.toFixed(2)}</td>
                <td>0 - 10</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Higher score means more physical anxiety symptoms.</td>
              </tr>
              <tr>
                <td><strong>Recommendation Engagement</strong></td>
                <td style="font-family:monospace;">${meanEngage.toFixed(2)}</td>
                <td>0+</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">Average number of recommended exercises completed at check-in.</td>
              </tr>
            </tbody>
          </table>`;

        const insight = `
          <strong>Descriptive Profile (n=${n}):</strong><br>
          Multiple Linear Regression cannot be solved because the design matrix is singular (predictors may be collinear or constant). 
          Showing average values instead. To resolve, select more participants or participants with more varied check-in histories.
        `;

        renderOutput('stat-output-regression', cards + descTable, insight);
        return;
      }

      const Xty  = matMul(Xt, y, p, n, 1);
      const beta = matMul(XtXinv, Xty, p, p, 1); // [β₀, β₁, β₂, β₃, β₄]

      // Compute R²
      const yMean  = y.reduce((s, v) => s + v, 0) / n;
      const ssTot  = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
      const yHat   = rows.map((_, i) =>
        beta[0] + beta[1] * rows[i].sleep + beta[2] * rows[i].avoid + beta[3] * rows[i].tension + beta[4] * rows[i].engagement
      );
      const ssRes  = y.reduce((s, v, i) => s + (v - yHat[i]) ** 2, 0);
      const r2     = ssTot > 0 ? 1 - ssRes / ssTot : 0;

      // Coefficient direction labels for interpretability
      const dirLabel = v => v > 0.05 ? '↑ Increases anxiety' : v < -0.05 ? '↓ Decreases anxiety' : '≈ Negligible effect';

      const coefRows = [
        { name: 'Intercept (β₀)', value: beta[0].toFixed(3), dir: '—', note: 'Baseline GAD-7 when all predictors = 0' },
        { name: 'Sleep Quality (β₁)', value: beta[1].toFixed(3), dir: dirLabel(beta[1]), note: 'Effect of each 1-point increase in sleep score' },
        { name: 'Avoidance (β₂)', value: beta[2].toFixed(3), dir: dirLabel(beta[2]), note: 'Effect of each 1-point increase in avoidance' },
        { name: 'Tension (β₃)', value: beta[3].toFixed(3), dir: dirLabel(beta[3]), note: 'Effect of each 1-point increase in physical tension' },
        { name: 'Recommendation Engagement (β₄)', value: beta[4].toFixed(3), dir: dirLabel(beta[4]), note: 'Effect of each completed recommended activity' }
      ];

      const coefTable = `
        <table class="stat-coef-table">
          <thead>
            <tr><th>Term</th><th>Coefficient (β)</th><th>Direction</th><th>Interpretation</th></tr>
          </thead>
          <tbody>
            ${coefRows.map(r => `
              <tr>
                <td><strong>${r.name}</strong></td>
                <td style="font-family:monospace;">${r.value}</td>
                <td>${r.dir}</td>
                <td style="font-size:0.8rem;color:var(--text-secondary);">${r.note}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      const cards = statResultRow([
        { label: 'Observations (n)',  value: n,                   sub: 'Check-in records used' },
        { label: 'R² (fit quality)',  value: (r2 * 100).toFixed(1) + '%', sub: 'Variance explained' },
        { label: 'Predictors',        value: '4',                 sub: 'sleep, avoidance, tension, engagement' }
      ]);

      // Dominant predictor: largest absolute coefficient (excluding intercept)
      const absBeta = [Math.abs(beta[1]), Math.abs(beta[2]), Math.abs(beta[3]), Math.abs(beta[4])];
      const predNames = ['sleep quality', 'avoidance behaviour', 'physical tension', 'recommendation engagement'];
      const dominant = predNames[absBeta.indexOf(Math.max(...absBeta))];

      const engagementEffect = beta[4] < -0.05
        ? `Importantly, the regression shows a **negative coefficient for Recommendation Engagement (β₄ = ${beta[4].toFixed(3)})**, indicating that engaging with and completing recommended exercises directly correlates with a reduction in GAD-7 anxiety scores.`
        : beta[4] > 0.05
          ? `Interestingly, engagement shows a positive coefficient (β₄ = ${beta[4].toFixed(3)}), which may suggest high-anxiety participants are actively logging more exercises but require additional time to show improvement.`
          : `The coefficient for Recommendation Engagement (β₄ = ${beta[4].toFixed(3)}) is currently negligible, suggesting more observations are needed to establish a clear regression effect.`;

      const insight = `
        <strong>Regression Insight (n=${n}):</strong><br>
        The model explains <strong>${(r2 * 100).toFixed(1)}% of variance</strong> in GAD-7 scores (R²=${r2.toFixed(3)}).
        The strongest predictor of anxiety is <strong>${dominant}</strong> (β = ${beta[['sleep','avoidance','tension','engagement'].indexOf(dominant.split(' ')[0] === 'recommendation' ? 'engagement' : dominant.split(' ')[0]) + 1]?.toFixed(3) ?? '—'}).
        <br><br>
        ${engagementEffect}
      `;

      renderOutput('stat-output-regression', cards + coefTable, insight);

    } catch (err) {
      console.error('Regression error:', err);
      showInsufficient('stat-output-regression', `Error running regression: ${err.message}`);
    } finally {
      setBtnState('btn-run-regression', false);
    }
  }

  // ─── Module 2: Paired t-Test (Baseline vs. Final GAD-7) ──────────────────

  /*
   * For each participant with ≥ 2 check-ins, computes the change:
   *   d_i = score_final_i − score_baseline_i
   *
   * Then applies a one-sample t-test on the d_i values against H₀: mean(d) = 0:
   *   t = mean(d) / (SD(d) / √n)    with df = n − 1
   *
   * A significantly negative t-value means GAD-7 scores decreased across the study.
   */
  async function runAnovaAnalysis(userIds) {
    setBtnState('btn-run-anova', true);
    try {
      if (Array.isArray(userIds) && userIds.length === 0) {
        showInsufficient('stat-output-anova', 'No participants selected. Use the selector above to choose at least one.');
        return;
      }

      const data = await DB.getCohortAnalyticsData();
      let assessments = data.assessments || [];

      // Filter by selected participants if a subset is specified
      if (Array.isArray(userIds)) {
        const idSet = new Set(userIds);
        assessments = assessments.filter(a => idSet.has(a.user_id));
      }

      // Group assessments by user_id and sort chronologically
      const byUser = {};
      assessments.forEach(a => {
        if (!byUser[a.user_id]) byUser[a.user_id] = [];
        byUser[a.user_id].push(a);
      });
      Object.keys(byUser).forEach(uid =>
        byUser[uid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      );

      // Keep only users with at least 2 check-ins
      const pairs = Object.values(byUser)
        .filter(arr => arr.length >= 2)
        .map(arr => ({
          baseline: arr[0].score,
          final:    arr[arr.length - 1].score,
          d:        arr[arr.length - 1].score - arr[0].score  // negative = improvement
        }));

      if (pairs.length === 0) {
        showInsufficient('stat-output-anova', 'Need at least 1 participant with 2 or more check-ins to compute a baseline-to-final comparison.');
        return;
      }

      if (pairs.length === 1) {
        const p = pairs[0];
        const meanBase = p.baseline;
        const meanFin = p.final;
        const meanD = p.d;

        const maxBar = Math.max(meanBase, meanFin, 1);
        const bW = 80, bGap = 60, svgW = 360, svgH = 180;
        const pL = 50, pB = 45, pT = 20;
        const plotH = svgH - pT - pB;
        const startX = pL + (svgW - pL - 20 - 2 * bW - bGap) / 2;

        const bars = [
          { label: 'Baseline', value: meanBase, color: 'var(--accent-slate)' },
          { label: 'Final',    value: meanFin,  color: 'var(--accent-sage)' }
        ];

        let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:380px;overflow:visible;font-family:var(--font-sans);">`;
        for (let i = 0; i <= 4; i++) {
          const yv = (i / 4) * maxBar;
          const sy = pT + plotH - (yv / maxBar) * plotH;
          svg += `<line x1="${pL}" y1="${sy}" x2="${svgW-20}" y2="${sy}" stroke="var(--border-color)" stroke-width="0.75" stroke-dasharray="3,3"/>`;
          svg += `<text x="${pL-6}" y="${sy+4}" text-anchor="end" style="font-size:9px;fill:var(--text-secondary);">${yv.toFixed(1)}</text>`;
        }
        svg += `<line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}" stroke="var(--border-color)" stroke-width="1.5"/>`;
        svg += `<line x1="${pL}" y1="${pT+plotH}" x2="${svgW-20}" y2="${pT+plotH}" stroke="var(--border-color)" stroke-width="1.5"/>`;
        svg += `<text x="14" y="${pT+plotH/2}" text-anchor="middle" style="font-size:10px;font-weight:600;fill:var(--text-secondary);" transform="rotate(-90,14,${pT+plotH/2})">GAD-7 Score</text>`;

        bars.forEach((b, i) => {
          const bx = startX + i * (bW + bGap);
          const bh = (b.value / maxBar) * plotH;
          const by = pT + plotH - bh;
          svg += `<rect x="${bx}" y="${by}" width="${bW}" height="${bh}" fill="${b.color}" rx="3" opacity="0.85"/>`;
          svg += `<text x="${bx + bW/2}" y="${by - 5}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--text-primary);">${b.value.toFixed(1)}</text>`;
          svg += `<text x="${bx + bW/2}" y="${pT+plotH+16}" text-anchor="middle" style="font-size:10px;fill:var(--text-secondary);">${b.label}</text>`;
        });
        svg += '</svg>';

        const cards = statResultRow([
          { label: 'Participants (n)',    value: 1,                          sub: 'Single participant scope' },
          { label: 'Baseline GAD-7',      value: meanBase.toFixed(1),        sub: 'Initial check-in' },
          { label: 'Final GAD-7',         value: meanFin.toFixed(1),         sub: 'Latest check-in' },
          { label: 'Change (d)',          value: (meanD >= 0 ? '+' : '') + meanD.toFixed(1), sub: 'Improvement direction' }
        ]);

        const insight = `
          <strong>Individual Baseline vs Final Comparison:</strong><br>
          Paired t-test significance testing requires at least 2 participants. 
          For a single participant, the GAD-7 score changed from <strong>${meanBase.toFixed(1)}</strong> to <strong>${meanFin.toFixed(1)}</strong> (a change of <strong>${(meanD >= 0 ? '+' : '') + meanD.toFixed(1)} points</strong>).
        `;

        renderOutput('stat-output-anova', cards + svg, insight);
        return;
      }

      const n        = pairs.length;
      const dVals    = pairs.map(p => p.d);
      const meanD    = dVals.reduce((s, v) => s + v, 0) / n;
      const sdD      = Math.sqrt(dVals.reduce((s, v) => s + (v - meanD) ** 2, 0) / (n - 1));
      const tStat    = meanD / (sdD / Math.sqrt(n));
      const df       = n - 1;
      const pValue   = tDistPValue(Math.abs(tStat), df);
      const sig      = pValue < 0.05;

      const meanBase = pairs.reduce((s, p) => s + p.baseline, 0) / n;
      const meanFin  = pairs.reduce((s, p) => s + p.final, 0) / n;

      // SVG side-by-side bar chart: baseline vs final mean
      const maxBar = Math.max(meanBase, meanFin, 1);
      const bW = 80, bGap = 60, svgW = 360, svgH = 180;
      const pL = 50, pB = 45, pT = 20;
      const plotH = svgH - pT - pB;
      const startX = pL + (svgW - pL - 20 - 2 * bW - bGap) / 2;

      const bars = [
        { label: 'Baseline', value: meanBase, color: 'var(--accent-slate)' },
        { label: 'Final',    value: meanFin,  color: sig ? 'var(--accent-sage)' : 'var(--text-muted)' }
      ];

      let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:380px;overflow:visible;font-family:var(--font-sans);">`;
      // Y-axis ticks
      for (let i = 0; i <= 4; i++) {
        const yv = (i / 4) * maxBar;
        const sy = pT + plotH - (yv / maxBar) * plotH;
        svg += `<line x1="${pL}" y1="${sy}" x2="${svgW-20}" y2="${sy}" stroke="var(--border-color)" stroke-width="0.75" stroke-dasharray="3,3"/>`;
        svg += `<text x="${pL-6}" y="${sy+4}" text-anchor="end" style="font-size:9px;fill:var(--text-secondary);">${yv.toFixed(1)}</text>`;
      }
      svg += `<line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+plotH}" stroke="var(--border-color)" stroke-width="1.5"/>`;
      svg += `<line x1="${pL}" y1="${pT+plotH}" x2="${svgW-20}" y2="${pT+plotH}" stroke="var(--border-color)" stroke-width="1.5"/>`;
      svg += `<text x="14" y="${pT+plotH/2}" text-anchor="middle" style="font-size:10px;font-weight:600;fill:var(--text-secondary);" transform="rotate(-90,14,${pT+plotH/2})">GAD-7 Score</text>`;

      bars.forEach((b, i) => {
        const bx = startX + i * (bW + bGap);
        const bh = (b.value / maxBar) * plotH;
        const by = pT + plotH - bh;
        svg += `<rect x="${bx}" y="${by}" width="${bW}" height="${bh}" fill="${b.color}" rx="3" opacity="0.85"/>`;
        svg += `<text x="${bx + bW/2}" y="${by - 5}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--text-primary);">${b.value.toFixed(1)}</text>`;
        svg += `<text x="${bx + bW/2}" y="${pT+plotH+16}" text-anchor="middle" style="font-size:10px;fill:var(--text-secondary);">${b.label}</text>`;
      });
      svg += '</svg>';

      const sigBadge = `<span class="stat-sig-badge ${sig ? 'significant' : 'not-significant'}">${sig ? '✓ Statistically Significant (p < 0.05)' : '✗ Not Significant (p ≥ 0.05)'}</span>`;

      const cards = statResultRow([
        { label: 'Participants (n)',    value: n,                          sub: 'With ≥ 2 check-ins' },
        { label: 'Mean Baseline GAD-7', value: meanBase.toFixed(2),       sub: 'Week 1 average' },
        { label: 'Mean Final GAD-7',   value: meanFin.toFixed(2),         sub: 'Latest check-in avg' },
        { label: 'Mean Change (d̄)',     value: (meanD >= 0 ? '+' : '') + meanD.toFixed(2), sub: 'Negative = improvement' },
        { label: 't-statistic',         value: tStat.toFixed(3),           sub: `df = ${df}` },
        { label: 'p-value (two-tailed)', value: pValue < 0.001 ? '< 0.001' : pValue.toFixed(3), sub: sigBadge }
      ]);

      const direction = meanD < 0 ? 'decreased' : 'increased';
      const insight = `
        <strong>Paired t-Test Insight (n=${n} participants):</strong>
        The mean GAD-7 score <strong>${direction}</strong> from <strong>${meanBase.toFixed(2)}</strong> (baseline)
        to <strong>${meanFin.toFixed(2)}</strong> (final check-in), a mean change of <strong>${meanD.toFixed(2)} points</strong>
        (t(${df}) = ${tStat.toFixed(3)}, p = ${pValue < 0.001 ? '< 0.001' : pValue.toFixed(3)}).
        ${sig
          ? `<strong>The decrease is statistically significant</strong> — this provides strong clinical evidence that active engagement with the digital tool and its personalized recommendations successfully reduces overall anxiety symptoms.`
          : `The change did <strong>not</strong> reach statistical significance at α = 0.05. A larger sample or longer study period may be required to confirm clinical efficacy.`}
      `;

      renderOutput('stat-output-anova', cards + svg, insight);

    } catch (err) {
      console.error('t-Test error:', err);
      showInsufficient('stat-output-anova', `Error running t-test: ${err.message}`);
    } finally {
      setBtnState('btn-run-anova', false);
    }
  }

  // ─── Module 3: NLP Trigger Text Analysis ─────────────────────────────────

  /* Stop words excluded from keyword counts. */
  const STOP_WORDS = new Set([
    'i','me','my','the','a','an','and','or','but','in','on','at','to','for',
    'of','with','about','is','was','are','were','be','been','have','has','had',
    'do','does','did','not','no','so','if','it','its','this','that','they',
    'we','he','she','you','what','when','where','how','all','just','can',
    'get','got','feel','feeling','really','very','much','more','also','still',
    'even','always','never','often','too','than','up','out','by','as','some'
  ]);

  /*
   * Category keyword definitions.
   * Each trigger text is scored against all categories; the highest-scoring
   * category is assigned. Multi-word tokens are also matched as bigrams.
   */
  const CATEGORIES = [
    {
      name: 'Academic / Study',
      keywords: ['exam','exams','dissertation','assignment','assignments','deadline','deadlines',
                 'study','studying','grade','grades','university','college','coursework',
                 'lecture','lectures','presentation','revision','essay','thesis','research','coursework']
    },
    {
      name: 'Social / Relationships',
      keywords: ['social','people','friends','friend','relationship','relationships','isolation',
                 'loneliness','lonely','interaction','interactions','conversation','party',
                 'gatherings','group','conflict','confrontation','dating','rejection']
    },
    {
      name: 'Health / Medical',
      keywords: ['health','illness','sick','sickness','pain','symptoms','symptom','doctor','medical',
                 'hospital','medication','diagnosis','anxiety','panic','condition','chest',
                 'breathing','heart','disease','disorder','appointment']
    },
    {
      name: 'Work / Financial',
      keywords: ['work','job','boss','manager','career','money','financial','finance','rent',
                 'bills','debt','budget','salary','income','redundancy','interview','promotion',
                 'performance','colleague','colleagues','meeting','meetings']
    },
    {
      name: 'Sleep / Physical',
      keywords: ['sleep','tired','tiredness','fatigue','insomnia','exhaustion','rest','energy',
                 'exercise','tension','headache','eating','diet','body','physical']
    },
    {
      name: 'Future / Uncertainty',
      keywords: ['future','uncertainty','uncertain','unknown','worry','worries','worried','change',
                 'decision','decisions','fear','afraid','scared','unknown','plan','plans',
                 'career','direction','purpose','goal']
    }
  ];

  /*
   * Tokenise a string into lowercase alpha-only words, filtered against stop words.
   * Returns an array of individual tokens (unigrams).
   */
  function tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text.toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }

  /*
   * Score a token list against a category's keyword set.
   * Returns the number of keyword matches.
   */
  function scoreCategory(tokens, categoryKeywords) {
    const kwSet = new Set(categoryKeywords);
    return tokens.filter(t => kwSet.has(t)).length;
  }

  /*
   * Runs NLP over all trigger text fields from assessments and journal entries.
   * Outputs category frequency bars and a top-keyword cloud.
   */
  async function runNlpAnalysis(userIds) {
    setBtnState('btn-run-nlp', true);
    try {
      if (Array.isArray(userIds) && userIds.length === 0) {
        showInsufficient('stat-output-nlp', 'No participants selected. Use the selector above to choose at least one.');
        return;
      }

      const data = await DB.getCohortAnalyticsData();
      let assessments = data.assessments || [];
      let journal     = data.journal || [];

      // Filter by selected participants if a subset is specified
      if (Array.isArray(userIds)) {
        const idSet = new Set(userIds);
        assessments = assessments.filter(a => idSet.has(a.user_id));
        journal     = journal.filter(j => idSet.has(j.user_id));
      }

      // Collect all trigger strings from assessments and journal entries
      const allTexts = [];
      assessments.forEach(a => {
        if (a.indicators?.triggers) allTexts.push(a.indicators.triggers);
      });
      journal.forEach(j => {
        if (j.triggers) allTexts.push(j.triggers);
        if (j.note)     allTexts.push(j.note);
      });

      if (allTexts.length === 0) {
        showInsufficient('stat-output-nlp', 'No trigger text entries found in the dataset.');
        return;
      }

      // Categorise each text entry
      const categoryCounts = CATEGORIES.map(() => 0);
      const allTokens = [];

      allTexts.forEach(text => {
        const tokens = tokenize(text);
        allTokens.push(...tokens);

        // Find best-matching category by score
        const scores = CATEGORIES.map((cat, i) => scoreCategory(tokens, cat.keywords));
        const maxScore = Math.max(...scores);
        if (maxScore > 0) {
          const bestIdx = scores.indexOf(maxScore);
          categoryCounts[bestIdx]++;
        }
      });

      const totalCategorised = categoryCounts.reduce((s, v) => s + v, 0);

      // Top 5 keywords by raw frequency
      const freq = {};
      allTokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
      const topKeywords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Neutral bar colour — same for all categories
      const BAR_COLOR = 'var(--text-secondary)';

      // Build category frequency bars (neutral, monochrome)
      const maxCount = Math.max(...categoryCounts, 1);
      const barsHTML = CATEGORIES.map((cat, i) => {
        const pct = Math.round((categoryCounts[i] / maxCount) * 100);
        const rawPct = totalCategorised > 0 ? ((categoryCounts[i] / totalCategorised) * 100).toFixed(0) : 0;
        return `
          <div class="nlp-category-row">
            <span class="nlp-category-label">${cat.name}</span>
            <div class="nlp-bar-track">
              <div class="nlp-bar-fill" style="width:${pct}%;background:${BAR_COLOR};"></div>
            </div>
            <span class="nlp-count-label">${categoryCounts[i]} <span style="font-size:0.72rem;color:var(--text-muted);">(${rawPct}%)</span></span>
          </div>`;
      }).join('');

      // Top 5 keyword chips — neutral monochrome, no category colour-coding
      const chipHTML = topKeywords.map(([word, count], idx) => {
        const opacity = Math.max(0.5, 1 - idx * 0.12);
        return `<span class="nlp-keyword-chip" style="background:var(--bg-secondary);color:var(--text-primary);border-color:var(--border-color);opacity:${opacity};">${word} <strong>${count}</strong></span>`;
      }).join('');

      const cards = statResultRow([
        { label: 'Text Entries Analysed', value: allTexts.length,        sub: 'Assessments + journals' },
        { label: 'Entries Categorised',   value: totalCategorised,       sub: 'Matched ≥ 1 keyword' },
        { label: 'Unique Keywords Found', value: Object.keys(freq).length, sub: 'After stop-word removal' }
      ]);

      const cloudSection = `
        <div style="margin-top:1.25rem;">
          <p style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);margin-bottom:0.5rem;">Top 5 Keywords by Frequency</p>
          <div class="nlp-keyword-cloud">${chipHTML}</div>
        </div>`;

      renderOutput('stat-output-nlp', cards + barsHTML + cloudSection, '');

    } catch (err) {
      console.error('NLP error:', err);
      showInsufficient('stat-output-nlp', `Error running NLP analysis: ${err.message}`);
    } finally {
      setBtnState('btn-run-nlp', false);
    }
  }

  // ─── Module 4: Usability & Trust Survey Feedback ──────────────────────────

  async function runFeedbackAnalysis(userIds) {
    setBtnState('btn-run-feedback', true);
    try {
      if (Array.isArray(userIds) && userIds.length === 0) {
        showInsufficient('stat-output-feedback', 'No participants selected. Use the selector above to choose at least one.');
        return;
      }

      const data = await DB.getCohortAnalyticsData();
      let feedback = data.feedback || [];

      // Filter by selected participants if a subset is specified
      if (Array.isArray(userIds)) {
        const idSet = new Set(userIds);
        feedback = feedback.filter(f => idSet.has(f.user_id));
      }

      if (feedback.length === 0) {
        showInsufficient('stat-output-feedback', 'No usability and trust feedback survey data available for the selected participants.');
        return;
      }

      // Calculate averages
      const metrics = [
        { key: 'usability', label: 'System Usability' },
        { key: 'clarity', label: 'Clarity of Content' },
        { key: 'trust', label: 'Trust in System' },
        { key: 'usefulness', label: 'Usefulness' },
        { key: 'personalization', label: 'Personalization' },
        { key: 'rule_understanding', label: 'Rule Understanding' },
        { key: 'continue_use', label: 'Willingness to Continue' }
      ];

      const averages = {};
      metrics.forEach(m => {
        const sum = feedback.reduce((acc, f) => acc + (Number(f[m.key]) || 0), 0);
        averages[m.key] = sum / feedback.length;
      });

      // Render summary cards
      const cards = statResultRow([
        { label: 'Total Submissions', value: feedback.length, sub: 'Out of active cohort' },
        { label: 'Avg Usability Score', value: `${averages['usability'].toFixed(1)}/5`, sub: 'Target threshold: >=4.0' },
        { label: 'Avg Trust Score', value: `${averages['trust'].toFixed(1)}/5`, sub: 'Target threshold: >=4.0' }
      ]);

      // Draw SVG horizontal bar chart
      const svgW = 400, svgH = 220;
      const padL = 130, padR = 40, padT = 15, padB = 20;
      const chartW = svgW - padL - padR;
      const rowH = (svgH - padT - padB) / metrics.length;

      let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%; max-width:500px; overflow:visible; font-family:var(--font-sans); margin-top: 1rem;">`;
      
      // Draw grid lines for scores 1 to 5
      for (let s = 1; s <= 5; s++) {
        const gx = padL + (s / 5) * chartW;
        svg += `<line x1="${gx}" y1="${padT}" x2="${gx}" y2="${svgH - padB}" stroke="var(--border-color)" stroke-width="0.75" stroke-dasharray="3,3"/>`;
        svg += `<text x="${gx}" y="${svgH - padB + 12}" text-anchor="middle" style="font-size:9px; fill:var(--text-secondary); font-weight:500;">${s}</text>`;
      }

      // Draw Y-axis line
      svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${svgH - padB}" stroke="var(--border-color)" stroke-width="1.5"/>`;

      // Render bars
      metrics.forEach((m, idx) => {
        const avg = averages[m.key] || 0;
        const barW = (avg / 5) * chartW;
        const by = padT + idx * rowH + (rowH - 12) / 2;

        svg += `<rect x="${padL}" y="${by}" width="${barW}" height="12" fill="#4a5568" rx="2" opacity="0.85"/>`;
        
        const tx = padL + barW + 6;
        svg += `<text x="${tx}" y="${by + 9}" text-anchor="start" style="font-size:9px; font-weight:700; fill:var(--text-primary);">${avg.toFixed(2)}</text>`;

        svg += `<text x="${padL - 8}" y="${by + 9}" text-anchor="end" style="font-size:9px; font-weight:500; fill:var(--text-secondary);">${m.label}</text>`;
      });

      svg += '</svg>';

      renderOutput('stat-output-feedback', cards + svg, '');

    } catch (err) {
      console.error('Feedback analysis error:', err);
      showInsufficient('stat-output-feedback', `Error running feedback analysis: ${err.message}`);
    } finally {
      setBtnState('btn-run-feedback', false);
    }
  }

  // ─── Run All ─────────────────────────────────────────────────────────────

  /* Sequentially runs all four analysis modules. */
  async function runAllStatisticalAnalyses(userIds) {
    const btn = document.getElementById('stat-run-all-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running all analyses…'; }
    await runRegressionAnalysis(userIds);
    await runAnovaAnalysis(userIds);
    await runNlpAnalysis(userIds);
    await runFeedbackAnalysis(userIds);
    if (btn) { btn.disabled = false; btn.textContent = '▶ Run All Analyses'; }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    runRegressionAnalysis,
    runAnovaAnalysis,
    runNlpAnalysis,
    runFeedbackAnalysis,
    runAllStatisticalAnalyses
  };

})();

window.StatisticsModule = StatisticsModule;
