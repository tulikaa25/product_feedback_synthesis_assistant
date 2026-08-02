# Agent Usage and Decisions Log (`AGENT_USAGE.md`)

This document outlines the tools used by the AI coding assistant, representative prompts, work delegated to subagents, agent mistakes or rejected suggestions, and output verification strategies during the development of the **AI Product Feedback Synthesis Assistant**.

---

## 1. Tools Used
The following tools are utilized during this project:
- **`list_dir` / `view_file` / `grep_search`**: For inspecting workspace folders and reading project files.
- **`write_to_file` / `replace_file_content` / `multi_replace_file_content`**: For creating and editing codebase files (schemas, server logic, frontend layouts, styles, and configurations).
- **`run_command`**: For executing commands like initializing directories, running database migrations, starting dev servers, and executing test scripts.
- **`invoke_subagent` / `send_message`**: For delegating background tasks to subagents.

---

## 2. Representative Prompts
Representative prompts sent to LLMs/subagents include:
- **Clustering Prompt (Sent to Gemini 1.5 Flash)**:
  - *"Analyze the following N feedback comments. Group them semantically into active themes. For each theme, write a detailed proposed problem statement, assign its primary product area, list the exact indices (`row_id`) of the comments that support it, and identify if it matches any historical theme in [LIST] or is related to a product note in [LIST]. Return the result strictly in the JSON format matching the schema..."*
- **Report Generation Prompt**:
  - *"Compile the approved feedback themes, historical context matches, and deterministic source/user-type distribution data into a plaintext ASCII formatted report..."*

---

## 3. Work Delegated to Subagents
- **Research Subagent**: Assigned to audit package dependencies and explore error logs during database or dev server setup.
- **Self Subagent**: Run parallel unit testing processes during code validation.

---

## 4. Agent Mistakes & Rejected Suggestions (Living Section)
This section tracks corrections, adjustments, and feedback received from the user.

### SQLite vs. PostgreSQL Deployment Decision
* **Initial Agent Suggestion:** Use SQLite locally because it requires zero configuration and avoids dependency setup issues on Windows.
* **User Rejection/Correction:** Deployed applications need persistent storage. SQLite databases are transient on serverless environments and lose data on redeployment.
* **Adjusted Plan:** Use PostgreSQL with Prisma ORM. Prisma allows configuring a `DATABASE_URL` for production persistence while still permitting a local SQLite backup during development if desired.

### Gemini API Subscription & Token Context Clarification
* **Initial Agent Suggestion:** Leverage Gemini's "massive context window" in Node.js to cluster comments, omitting local Python models/embeddings.
* **User Question:** What "context" are you talking about? I don't have a paid Gemini API subscription.
* **Agent Correction/Explanation:** Clarified that the **Gemini API Free Tier (via Google AI Studio)** supports the full **1,000,000 token context window** at 15 RPM for free, which is more than sufficient for development and small-scale deployments. The paid tier is not required.

### pgvector Vector Database Decision
* **Initial Agent Suggestion:** Use ChromaDB in Python to perform similarity comparisons.
* **User Guidance:** Explicitly request to use `pgvector` inside PostgreSQL.
* **Adjusted Plan:** Store embeddings as native `vector(768)` type using Prisma's `Unsupported("vector(768)")` property. Run raw SQL similarity queries (`$queryRaw`) using the native `<=>` cosine distance operator. This unifies all relational and vector storage directly inside PostgreSQL.


### Shadcn/UI vs. Custom Tailwind CSS Components
* **Initial Agent Suggestion:** Integrate Shadcn/UI for drawers, modals, and theme cards.
* **User Guidance:** Skip Shadcn/UI if it is too complicated; use it only if it acts like a simple library.
* **Agent Reasoning & Adjusted Plan:** Omit Shadcn/UI. Shadcn/UI is not a simple library; it is a component copier that requires custom CLI initializations (`npx shadcn-ui init`), path alias configurations (`@/*`), and TS/JS configuration alterations that frequently fail in automated Windows environments. Instead, we will use **Tailwind CSS v4** directly along with **`@headlessui/react`** (a true, zero-configuration dropdown component library from the Tailwind CSS team) to build our modals, drawers, and boards. This ensures 100% reliability, zero configuration bugs, and identical styling control.

### One-Shot Clustering vs. Incremental Batching vs. Global HDBSCAN
* **Initial Agent Suggestion:** Send all 1,000 feedback comments in a single "one-shot" call to the LLM to cluster them.
* **User Concern:** The LLM might hallucinate row mappings, omit feedback, or exceed generation output limits when dealing with 1,000+ items and historical themes.
* **Agent Modification Suggestion:** Implement an **Incremental Batch Clustering** pipeline (batches of 100 comments).
* **User Rejection of Batching:** User correctly pointed out that incremental batching introduces sequence bias; early batches define a partial taxonomy, leading to incomplete or biased themes. The user preferred sticking to the Python clustering approach.
* **Final Adjusted Plan:** Implement a **Global HDBSCAN Clustering pipeline in Python** (using `scikit-learn`). The Python engine fetches embeddings for all 1,000+ feedback items, clusters them mathematically using HDBSCAN globally (unbiased), and then sends each resulting cluster (10-50 rows) individually to Gemini to write the theme and problem statement. This eliminates sequence bias, prevents row ID hallucinations, and stays within token generation limits. Simple `numpy` cosine similarity replaces the complex ChromaDB requirement for matching historical themes/notes.

### Gemini API Model Deprecation, Rate Limiting, & Capping Adjustments
* **Issue 1 (404 Model Deprecation):** The legacy `gemini-1.5-flash` model was retired by Google in early 2026, causing all generation content calls to fail with a `404 Not Found` error and forcing the clustering script to fallback to generic placeholder titles.
* **Issue 2 (429 Rate Limiting):** The Gemini Free Tier has a strict quota of 15 Requests Per Minute (RPM). Bursting requests sequentially in a Python loop for all clusters caused immediate `429 Too Many Requests` (Quota Exceeded) errors, leading to incomplete theme generations.
* **Issue 3 (Token Usage):** LLM-generated problem statements were occasionally too verbose, cluttering the UI and consuming excessive output tokens.
* **Adjustments implemented:**
  1. Updated the generation model to **`gemini-3.5-flash`** across the python engine.
  2. Implemented request throttling (1.0s delay between calls) and automated **exponential backoff retries** (up to 5 attempts) on `429` status codes.
  3. Added prompt-level instructions restricting the summary to **maximum 150 characters** (1-2 sentences), combined with backend code-level safety truncation capping descriptions at 160 characters.

---

## 5. Submission Criteria Mapping & Verification
The codebase satisfies the required submission items as follows:

1. **Usable Frontend & Working Backend:** React Vite dashboard connecting to Express REST endpoints (CRUD for active themes).
2. **Basic Data Persistence:** Persistent PostgreSQL storage with database schemas defined and managed via Prisma ORM.
3. **Functional AI Agent & LLM Workflow:** Global HDBSCAN clustering on embeddings in Python + Gemini API cluster summarizing & problem statement generation.
4. **Human Review & Approval:** Dashboard controls for editing problem statements, splitting outlier rows, merging themes, and approving/rejecting active themes before report generation.
5. **Clear UI States:** Expressive loaders for processing CSVs, empty dashboard states, form validation alerts, success toasts, and error states.
6. **Structured Logs:** Built-in JSON logger (`backend/src/logger.js`) capturing API requests, database queries, and AI execution times/tokens.
7. **Focused Tests:** Dedicated tests in `backend/tests/` verifying CSV parsing, math aggregation formulas, and database CRUD.
8. **Deployment Readiness:** Prepared `Dockerfile` and `render.yaml` for instant containerized cloud deployments.

---

## 6. Verification of Generated Output
To verify the application:
1. **API Pipeline Test (`scratch/test_pipeline.js`)**: An automated test script that uploads mock CSV rows, mocks the Gemini API response, runs the database insertions, and executes the mathematical distribution logic to confirm math is 100% deterministic and correct.
2. **Dynamic Math Tests (`backend/tests/analytics.test.js`)**: Verifies calculations for source distributions, user type distributions, and monthly timeline bucket counts.
3. **Manual Verification**: Verify uploading sample data, merging two themes, splitting items from a theme, and outputting the plaintext ASCII report.
