# AI Product Feedback Synthesis Assistant - Original Project Plan

## Problem Statement
Build an application that accepts a CSV with the following defined fields:
- feedback text
- source
- user type
- product area
- date
- optional rating

The AI workflow should:
1. Group related feedback into themes
2. Identify recurring user problems
3. Distinguish repeated patterns from isolated comments
4. Compare new themes with a small set of historical themes or product notes
5. Generate a proposed problem statement for each theme
6. Cite the original feedback supporting every theme and conclusion

The application should calculate the following using deterministic code:
- number of feedback items in each theme
- distribution by source
- distribution by user type
- frequency over time

The user should be able to:
- rename a theme
- merge related themes
- split an incorrect theme
- reject a theme
- approve selected themes
- review all source feedback behind a theme
- save a reviewed synthesis report

The AI must not invent feedback counts or automatically prioritize the product roadmap.

---

## Proposed Tech Stack (Rough Architecture)

### 1. Frontend & Main Application Layer
- **Frontend**: React.js (Vite or Next.js) + Tailwind CSS + Shadcn/UI (For theme review cards, split/merge modals, and side drawers).
- **Backend Framework**: Node.js with Express.js (Main API server, route handling, file uploads, PostgreSQL ORM, authentication, and report generator).
- **Database (Relational / Source of Truth)**: PostgreSQL (Managed via Prisma ORM in Node.js for storing CSV feedback rows, themes, human edit states, product notes, and historical logs).
- **AI & Analytics Microservice / Layer (Python)**:
  - **Micro-Backend**: Python (FastAPI) OR direct Node.js <-> Python child process execution.
  - **Deterministic Analytics Engine**: Python (Pandas) (Computes exact counts, source distribution, user type breakdowns).
  - **Vector Database (RAG)**: ChromaDB (Stores embeddings for historical themes & product notes).
  - **LLM Orchestration**: Gemini API SDK / OpenAI SDK (with Pydantic or JSON schema mode enabled).

---

## Phases

### PHASE 1: Data Ingestion & Storage Setup
1. **Ingestion Endpoint (`POST /api/upload-csv`)**
   - Express accepts the `.csv` file upload via `multer`.
   - Express passes raw text to the CSV parser.
   - Row ID Assignment: Express injects an explicit, auto-incrementing integer `row_id` (0, 1, 2, ..., N-1) into every record.
   - Database Persist: Saves every row to PostgreSQL (`raw_feedback` table).

2. **PostgreSQL Relational Schema (Prisma)**
   - `raw_feedback`: `row_id` (PK), `feedback_text`, `source`, `user_type`, `product_area`, `date`, `rating` (optional).
   - `historical_themes`: `id`, `title`, `problem_statement`, `product_area`, `first_seen_date`.
   - `product_notes`: `id`, `version`, `note_type`, `title`, `description`, `product_area`, `release_date`, `created_at`.
   - `active_themes`: `id`, `title`, `problem_statement`, `status` (PENDING, APPROVED, REJECTED, MERGED), `supporting_row_ids` (JSON Array), `is_pattern`, `is_reemerging`, `matched_note_id`.

### PHASE 2: AI Theme Generation
1. Take all feedback together -> Generate embedding for each feedback.
2. Run HDBSCAN on all embeddings -> Candidate semantic clusters + outliers.
3. Gemini analyzes each cluster -> Candidate Theme + Problem Statement.
   - JSON Output Schema:
     ```json
     {
       "themes": [
         {
           "theme_id": "theme_001",
           "title": "Safari PDF Export Crashes",
           "problem_statement": "Users running Mac Safari experience tab freezes and white screen crashes when attempting to export multi-page transaction reports.",
           "primary_product_area": "Reporting",
           "affected_product_areas": ["Reporting", "Export System"],
           "is_cross_cutting": false,
           "supporting_row_ids": [0, 4, 18, 29]
         }
       ]
     }
     ```

### PHASE 3: RAG Comparison
Compare theme queries against two ChromaDB / PostgreSQL vector database collections:
- `historical_themes` Collection: Search past resolved or recurring customer complaint clusters.
- `product_notes` Collection: Search recent product release notes, hotfixes, and known bug logs.

### PHASE 4: Deterministic Analytics (Pandas Engine)
The Python script takes the `supporting_row_ids` array and queries Pandas/PostgreSQL.
Calculates strictly with code (no LLM math):
- `total_count` = len(supporting_row_ids)
- `source_distribution` = value_counts('source')
- `user_type_distribution` = value_counts('user_type')
- `frequency_over_time` = Resampled weekly/monthly histogram counts.

### PHASE 5: Human-in-the-Loop Review Dashboard
The React frontend renders an interactive review board.
- **View Citations**: Drawer showing original raw feedback quotes corresponding to `supporting_row_ids`.
- **Rename/Edit**: Edit theme title or problem statement.
- **Approve/Reject**: Click Approve (status = APPROVED) or Reject (status = REJECTED).
- **Merge Themes**: Combine Theme A and Theme B row IDs and re-run analytics engine in real-time.

### PHASE 6: Final Synthesis Report Generation
User clicks "Save Reviewed Report", Node.js filters for `APPROVED` themes and outputs the final report in the exact required layout.
