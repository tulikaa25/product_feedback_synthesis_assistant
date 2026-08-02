# Implementation Plan - AI Product Feedback Synthesis Assistant

We will build the **AI Product Feedback Synthesis Assistant**, utilizing a **React Frontend (with Tailwind CSS)**, a **Node.js/Express Backend**, a **Prisma ORM Database** (SQLite for local development, PostgreSQL for Render production), and a **Python AI & Analytics Engine** for global semantic clustering (HDBSCAN) and RAG (using numpy similarity).

This plan explicitly details the stack, the exact report layout, all deliverables, and component-level code outlines.

---

## Technical Specifications & Justifications

### 1. Relational Database: SQLite (Local) / PostgreSQL (Render Production)
* **Local Development:** SQLite. It stores data in a local file (`dev.db`), requiring **no software installations or background servers** on Windows.
* **Production Deployment:** PostgreSQL on Render's free tier (since Render's free tier web services have ephemeral storage, meaning local SQLite files get wiped on container restarts).
* **Automated Provider Swapper:** To support different databases locally vs. in production, we will write a script `prisma-setup.js` that checks if the `DATABASE_URL` starts with `postgres://` or `postgresql://`. It will dynamically inject `"sqlite"` or `"postgresql"` as the provider in `schema.prisma` before generating the client.
* **Vector Similarity (RAG):** To ensure identical behavior on both SQLite and PostgreSQL without requiring complex database extensions (like `pgvector`), we store embedding vectors as standard double-precision float arrays (`Float[]` in Prisma / PostgreSQL, and stored as a JSON string in SQLite). All vector similarity matching is computed in our **Python engine using `numpy`**.

### 2. Frontend Framework & Components (React + Tailwind CSS v4)
* **Framework:** React.js initialized via Vite.
* **Styling:** Tailwind CSS v4 (using Vite plug-in `@tailwindcss/vite` and `@import "tailwindcss";` in `index.css`).
* **Components (No Shadcn/UI):** To avoid the CLI configuration overhead, path alias configuration (`@/*`), and TS/JS configuration errors of Shadcn/UI, **we will build our custom components using Tailwind CSS utility classes**. Modals and side drawers will utilize standard React state controls or **`@headlessui/react`** (a true, zero-configuration dropdown, transition, and dialog library from the Tailwind CSS team).

#### 3. AI Clustering & Pandas Analytics Engine (Python)
* **Embeddings:** Python calls Gemini's `text-embedding-004` batch API (in chunks of 100 texts) to generate vectors.
* **Clustering:** Run `sklearn.cluster.HDBSCAN` globally on all 1,000+ items to group feedback mathematically without sequence/batching bias.
* **Labeling:** For each resulting cluster, Python calls Gemini to synthesize a theme title, a detailed problem statement, and primary product areas.
* **Deterministic Analytics (Pandas):** The Python script loads the clustered data into a Pandas DataFrame and calculates the exact counts, source distributions, user type distributions, and calendar month frequency histograms deterministically using code.
* **RAG Context Matching:** Python computes average cluster embeddings (centroids) and returns them to Node.js. The Express server then executes the native `pgvector` database query (shown in Section 1) to identify matching historical themes and product notes.

---

## Required Submission Deliverables

The application is structured to ensure all required items are met:

1. **Usable Frontend & Working Backend:**
   - React SPA dashboard for data analysis, review, and merging/splitting.
   - Express.js API for file uploads, CRUD database operations, and text report rendering.
2. **Basic Data Persistence:**
   - Persistent PostgreSQL tables managed via Prisma ORM for raw feedback, active themes, historical records, release notes, and action audits.
3. **Functional AI Agent & LLM Workflow:**
   - Parallelized embedding extraction, mathematical HDBSCAN grouping, and structured LLM cluster summarization using JSON Schema mode.
   - **Active Gemini 3.5 Flash Model:** Migration to `gemini-3.5-flash` to prevent 404 errors due to `gemini-1.5-flash` retirement.
   - **Throttling & Backoff Retries:** 1.0s sequential delay and exponential backoff retries on `429` rate limit codes to ensure reliable execution on free-tier RPM limits.
   - **Token-Efficient Capping:** Enforced prompt constraints (max 150 characters) and backend safety truncation (max 160 characters) on problem statements to keep summaries concise.
4. **Appropriate Human Review & Approval:**
   - Dashboard cards load in a `PENDING` state.
   - The user can rename a theme, split specific row IDs, merge two selected cards, reject cards (set status to `REJECTED`), and approve cards (set status to `APPROVED`).
   - Only `APPROVED` themes are included in the final synthesis report.
5. **Clear UI States:**
   - **Loading:** Spinner overlays on the dashboard during CSV ingestion/clustering execution.
   - **Empty:** Clean illustration and file dropzone when no database rows exist.
   - **Validation:** Banners and inputs check for correct CSV headers (`feedback text`, `source`, `user type`, `product area`, `date`, `rating`).
   - **Success/Failure:** Alert toasts indicating database updates, API errors, or export completion.
6. **Structured Logging:**
   - Express and Python write structured JSON logs to `backend/logs/app.log` (tracking request times, DB transactions, API key verification, and token usage).
7. **Focused Tests:**
   - Unit tests in `backend/tests/` verifying CSV header validation, Python Pandas calculations (counts, distributions, monthly timeline buckets), and Prisma query operations.
8. **Deployed Application Configuration:**
   - Multi-stage `Dockerfile` and a Render blueprint `render.yaml` for containerized hosting of the React app, Express server, and PostgreSQL database on Render's free tier.

---

## Proposed Changes

### Component 1: Relational Schema (Prisma)
Defines raw feedback, active/historical themes, product notes, and audit history. Stored in standard relational tables.

#### [NEW] [schema.prisma.template](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/backend/prisma/schema.prisma.template)
```prisma
datasource db {
  provider = "TEMPLATE_PROVIDER" // Replaced dynamically with "sqlite" or "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model RawFeedback {
  row_id        Int      @id
  feedback_text String
  source        String
  user_type     String
  product_area  String
  date          DateTime
  rating        Int?
}

model HistoricalTheme {
  id                String   @id @default(uuid())
  title             String
  problem_statement String
  product_area      String
  first_seen_date   DateTime
  embedding         String   // Stored as JSON string representation of Float[] for database portability
}

model ProductNote {
  id           String   @id @default(uuid())
  version      String
  note_type    String
  title        String
  description  String
  product_area String
  release_date DateTime
  embedding    String   // Stored as JSON string representation of Float[] for database portability
}

model ActiveTheme {
  id                          String   @id @default(uuid())
  title                       String
  problem_statement           String
  primary_product_area        String
  status                      String   // PENDING, APPROVED, REJECTED, MERGED
  supporting_row_ids          String   // JSON array [0, 1, 12, ...]
  is_pattern                  Boolean
  matched_historical_theme_id String?
  matched_product_note_id     String?
  created_at                  DateTime @default(now())
  embedding                   String   // Stored as JSON string representation of Float[]
}

model AuditLog {
  id         String   @id @default(uuid())
  action     String   // UPLOAD, RENAME, MERGE, SPLIT, STATUS_CHANGE
  details    String   // JSON string detailing the transition
  created_at DateTime @default(now())
}
```

---

### Component 2: Python AI & Analytics Engine

#### [NEW] [cluster.py](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/backend/python_engine/cluster.py)
A standalone Python script that:
- Reads input JSON (raw feedback rows, historical themes, product notes) from `stdin`.
- Batch requests embeddings from Gemini API.
- Runs `sklearn.cluster.HDBSCAN` on embeddings.
- Summarizes each cluster using Gemini with strict JSON schema outputs.
- Calculates the cluster centroid embedding and compares it against historical themes and product notes using standard `numpy` cosine similarity.
- Returns a structured JSON list of candidate themes, their `supporting_row_ids`, centroids, and matched historical/release note IDs back to the Express server.

---

### Component 3: Backend (Express Server & Logger)

#### [NEW] [logger.js](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/backend/src/logger.js)
A custom logging utility that writes structured timestamped JSON logs to `backend/logs/app.log`.

#### [NEW] [server.js](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/backend/src/server.js)
Endpoints:
- `POST /api/upload-csv`: Multer upload + CSV parser + Python execution + database persist. 
- `GET /api/themes`: Returns active themes + computed metrics (source distribution, user type distribution, monthly timeline resampled in JS).
- `POST /api/themes/merge`: Human merge action. Combines `supporting_row_ids` and updates stats. Recalculates centroid and re-runs matches in Node/Python.
- `POST /api/themes/:id/split`: Human split action. Removes chosen row IDs and starts a new theme. Recalculates centroid and re-runs matches.
- `PUT /api/themes/:id`: Rename / Edit problem statement.
- `POST /api/themes/:id/status`: Approve / Reject update.
- `GET /api/report`: Plaintext ASCII synthesis report compiler.
- `GET /api/seed`: Seed database with historical themes and release notes.

---

### Component 4: Frontend (React UI with Tailwind CSS)

#### [NEW] [App.jsx](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/frontend/src/App.jsx)
Dynamic workspace dashboard using React state, Tailwind utility classes, and `@headlessui/react` for drawers/modals:
- Drag-and-drop CSV uploader with loading progress spinner.
- Empty state message when no data is loaded.
- Clean validation banner for incorrect headers.
- Grid board with glassmorphic cards. Cards contain:
  - Statistics (exact counts, progress bars for distribution, HTML5 Canvas or SVG mini-timelines).
  - Flags (Isolated comment vs Pattern, matched history alerts).
  - Quick action buttons (Rename, split, merge, status toggles).
- Custom Drawer view for supporting raw feedback rows.
- Report Generator preview modal with a copy-to-clipboard button.

---

### Component 5: Deployment Configurations

#### [NEW] [Dockerfile](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/Dockerfile)
Multi-stage Dockerfile containing Node.js runtime, Python virtual environment with `scikit-learn`/`pandas`, and Prisma client setup.

#### [NEW] [render.yaml](file:///c:/Users/tulik/Desktop/MINE/aggroso%20task/render.yaml)
Configuration file for deploying the Express server and PostgreSQL DB on Render as a blueprint.

---

## Expected Synthesis Report Layout

When the user clicks "Save Reviewed Report", the backend queries all active themes where `status = 'APPROVED'` and compiles them into a single plaintext ASCII report matching the exact format below:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME 1: [Theme Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem Statement:
[Detailed synthesis of problem statement generated by Gemini/Human edits]

Pattern:
[Recurring / Isolated Comment]

Historical Context:
⚠️ Matches Historical Theme: [Title of matched historical theme, or "None"]
🚀 Related Release Note: [Version & Title of matched product note, or "None"]

Feedback Count:
[Deterministic count of row IDs associated with this theme]

Product Area:
[Primary Product Area]

SOURCE DISTRIBUTION
[Source 1]     [Count]
[Source 2]     [Count]

USER TYPE DISTRIBUTION
[Type 1]       [Count]
[Type 2]       [Count]

FEEDBACK FREQUENCY
[Time Bucket 1 (e.g. Week 1 / Month)]   █████████    [Count]
[Time Bucket 2 (e.g. Week 2 / Month)]   ███████████  [Count]

SUPPORTING CITATIONS & RAW EVIDENCE
• Row #[ID] [[Source] / [User Type]]: "[Feedback text quote]"
• Row #[ID] [[Source] / [User Type]]: "[Feedback text quote]"
```

---

## Verification & Testing Plan

### 1. Automated Tests
* **CSV Validator (`backend/tests/csv.test.js`):** Asserts that CSVs with missing headers fail validation, and valid rows are parsed and mapped to sequential integer IDs starting from `0`.
* **Analytics Engine (`backend/tests/analytics.test.js`):** Tests the deterministic calculations of source distribution, user type distribution, and monthly timeline bucket counts.
* **Vector Cosine Similarity Tests:** Compares calculated python centroids against mock embeddings and asserts correct similarity rankings.

### 2. Manual Verification Walkthrough
1. **Empty State:** Open application; confirm the empty state dashboard and drag-and-drop area display.
2. **Ingestion & Validation:** Attempt to upload a text file or incorrect CSV; verify validation alerts appear. Upload a valid CSV; verify the loading overlay blocks interaction.
3. **Clustering Output:** Confirm themes display on the Kanban grid board with correct counts, metadata badges, and vector context matches.
4. **Theme Editing:**
   - Rename a theme card; confirm the database updates.
   - Open a card drawer, check off three rows, click "Split", and verify a new card is created and counts update.
   - Select two theme cards, click "Merge", and verify that they are combined, statuses updated, and statistics recalculated.
   - Set status of card to "Approved" or "Rejected".
5. **Report Generation:** Click "Save Reviewed Report"; verify that only approved themes appear in the ASCII preview layout and copy successfully.
