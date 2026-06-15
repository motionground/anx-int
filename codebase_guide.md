# ANXI-ASSIST: Codebase, Architecture & Implementation Guide

This document provides an objective, neutral overview of the ANXI-ASSIST codebase architecture, relational database tables, rule-based clinical logic, and browser-based statistics engine.

---

## 1. General System Architecture
ANXI-ASSIST is designed as a client-server web application. The frontend consists of static layout views, and the backend is hosted on a cloud database service.
* **Frontend:** A Single Page Application (SPA) built using standard HTML5, CSS3, and JavaScript. Screens are swapped dynamically by reading the hash fragment in the URL (e.g., `#dashboard`, `#progress`) and toggling view classes, rather than refreshing the page.
* **Database & Server:** **Supabase**. It handles user authentication (signs users in and validates credentials) and acts as a relational database to store clinical data. The frontend communicates with it via secure HTTP API requests.
* **Visualizations:** Drawn dynamically using **SVG (Scalable Vector Graphics)** generated in Javascript. Coordinates are mapped proportionally between data points and screen pixels, eliminating the need for external charting libraries.

---

## 2. Relational Database Schema & Data Flow
Relational tables map participants to their logs. The tables are configured on Supabase with the following fields and relationships:

| Table Name | Key Fields | Relationship / Purpose |
| :--- | :--- | :--- |
| **profiles** | `id` (UUID), `participant_id` (e.g. P-1001), `is_admin` | **1-to-1** with Supabase Auth users. Identifies participant roles anonymously. |
| **assessments** | `user_id` (FK), `gad7` (scores), `indicators` (JSON) | **1-to-Many** with profiles. Holds weekly anxiety surveys and parameters (sleep, avoidance, tension). |
| **journal** | `user_id` (FK), `mood` (1-10), `note` (text) | **1-to-Many** with profiles. Captures daily qualitative logs. |
| **completions** | `user_id` (FK), `recommendation_id` (text) | **1-to-Many** with profiles. Tracks completed coping tasks. |
| **coping_plans** | `user_id` (PK, FK), `triggers`, `strategies` | **1-to-1** with profiles. Stores participant safety plans. |
| **feedback** | `user_id` (PK, FK), usability scores (1-5) | **1-to-1** with profiles. Stores final usability survey ratings. |

### Step-by-Step Data Flow:
1. A participant registers. Supabase creates a unique user record (UUID) in its Auth database.
2. The application inserts a record into the `profiles` table matching that UUID, assigning an anonymous code (like `P-1001`) and setting administrative permissions to false (`is_admin = false`).
3. Each time the participant completes a weekly check-in or daily journal, a new record is added to the respective table containing the participant's UUID as a foreign key (`user_id`).
4. To export data or calculate statistics, the application queries these tables, filtering by UUID.

---

## 3. Core Javascript Files & Routing
The frontend behaves like a single desktop dashboard but runs within a single page using a hash-change router:
* **index.html**: The structural document. Contains all views (auth page, dashboard, progress page, admin panel) inside discrete `<section class="view">` containers.
* **js/app.js**: 
  * **SPA Routing (`handleRouting()`):** Reads the URL hash (e.g. `#dashboard`) and toggles CSS active classes on view containers to transition screens without page refreshes.
  * **Dynamic SVG Drawing (`drawProgressGraph()`):** Computes chart coordinates and outputs raw HTML vector tags (`<rect>`, `<path>`) to render the progress trends dynamically.
* **js/database.js**: Handles API calls to Supabase. Includes the `fetchAllRows()` function, which implements paginated chunking (retrieving rows in batches of 1,000) to bypass Supabase's default row retrieval limit.

---

## 4. How Clinical Recommendations are Decided (Clinical Rules)
Instead of using machine-learning models, the system uses a deterministic clinical decision tree (Rules Engine) located in `js/rules.js`. It reads a participant's latest logged parameters and evaluates them against specific threshold criteria:

* **Severe Anxiety Rule:** If GAD-7 score $\ge 15$ (Severe), it returns the **Crisis Guidance** recommendation (displays emergency resources).
* **Mild/Moderate Anxiety Rule:** If GAD-7 score is between $5$ and $14$ (Mild/Moderate), it returns the **Mindful Breathing** recommendation.
* **Sleep Impairment Rule:** If the sleep rating is $< 5$ out of $10$, it returns the **Sleep Hygiene Protocol** recommendation.
* **Avoidance Response Rule:** If the avoidance rating is $> 6$ out of $10$, it returns the **Systematic Avoidance Desensitization & Cognitive Reframing** recommendation.
* **Functioning Impairment Rule:** If functioning score is $< 5$ out of $10$ and GAD-7 score $\ge 10$, it returns the **Worry Postponement** recommendation.
* **Tension Level Rule:** If physical body tension is $> 6$ out of $10$, it returns the **Progressive Muscle Relaxation** recommendation.
* **Symptom Trend Rule:** If the latest GAD-7 score is higher than the previous week's score, it recommends reviewing the personal **Coping Plan**.

---

## 5. How Cohort Analytics & Statistics are Calculated
The statistical analyses in the researcher dashboard (`js/statistics.js`) are computed from scratch on the client-side using pure mathematical algorithms:

### A. Multiple Linear Regression (Anxiety Predictors)
This determines how much sleep quality ($x_1$), avoidance ($x_2$), tension ($x_3$), and completed coping exercises ($x_4$) predict a participant's overall GAD-7 anxiety score ($Y$).
* **Linear Equation:**
  $$Y = \beta_0 + \beta_1 x_1 + \beta_2 x_2 + \beta_3 x_3 + \beta_4 x_4 + \epsilon$$
* **Matrix Calculation:** Fits coefficients ($\beta$) by solving the Ordinary Least Squares (OLS) formula:
  $$\beta = (X^T X)^{-1} X^T Y$$
* **Matrix Inversion:** In JavaScript, matrices cannot be divided directly. The code implements the **Gaussian Elimination** algorithm, which performs row operations on the $(X^T X)$ matrix to find its inverse.
* **Model Fit ($R^2$):** Measures the variance explained by the model:
  $$R^2 = 1 - \frac{\text{Residual Sum of Squares}}{\text{Total Sum of Squares}}$$
  An $R^2$ of $0.52$ means the combination of sleep, avoidance, tension, and exercise completion explains 52% of the variations in anxiety levels.

### B. Paired t-Test (Statistical Significance)
This determines if the change in GAD-7 scores from a participant's first check-in (baseline) to their final check-in is a genuine clinical improvement or just a result of random fluctuations.
* **Difference Score ($d$):** Calculates the change for each participant: `d = final_score - baseline_score`.
* **t-Statistic:** Computes the standard t-statistic:
  $$t = \frac{\bar{d}}{s_d / \sqrt{N}}$$
  where $N$ is the size of the cohort.
* **p-Value:** Calculates probability ($p$) using a numerical approximation of the Student's t-distribution. If $p < 0.05$, the null hypothesis (that there was no real change in anxiety) is rejected, confirming the intervention led to a statistically significant decrease in scores.

### C. Natural Language Processing (NLP Trigger Word Count)
* **Text Cleanup:** Converts free-text triggers into lowercase and strips special characters.
* **Stop-Word Filtering:** Compares words against a pre-set list of auxiliary words (e.g. *and, the, a, for, of, details, log*) and discards them.
* **Aggregation:** Counts the occurrences of the remaining nouns/verbs and lists the top terms (like *exam, deadlines, sleep*) to identify the most common anxiety triggers in the study.
