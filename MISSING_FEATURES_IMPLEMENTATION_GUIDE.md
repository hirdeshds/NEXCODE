# Missing NexCode Features Implementation Guide

This guide turns the open checklist items into a practical implementation plan for the current repository layout.

## Target features

- Reachable MCP-driven pipeline integration
- Vercel deployment integration
- Celery workers
- Redis-backed pipeline queue
- Registered keyboard shortcuts
- Registered pipeline command in the extension
- Extension automated tests

## Recommended implementation order

1. MCP reachability and config wiring
2. Vercel deployment flow
3. Celery + Redis queue migration
4. Keyboard shortcuts and command polish
5. Extension automated tests

---

## 1. Reachable MCP-driven pipeline integration

### Goal
Make the pipeline able to connect to an external MCP server and confirm that the server is reachable before running the scan.

### Files to touch
- [backend/app/pipeline/mcp_connect.py](backend/app/pipeline/mcp_connect.py)
- [backend/app/main.py](backend/app/main.py)
- [nexcode.config.json](nexcode.config.json)
- [backend/requirements.txt](backend/requirements.txt)

### Implementation steps

1. Extend the repository config with an MCP section.
   Example:

   ```json
   {
     "mcp": {
       "base_url": "https://your-mcp-host.example.com",
       "timeout_seconds": 10,
       "headers": {
         "Authorization": "Bearer YOUR_TOKEN"
       }
     }
   }
   ```

2. Make [backend/app/pipeline/mcp_connect.py](backend/app/pipeline/mcp_connect.py) expose a health or ping method.
   - Add a function named `check_mcp_health()`.
   - Use `httpx` with a timeout.
   - Return structured JSON like:

   ```json
   {
     "reachable": true,
     "status": "ok"
   }
   ```

3. Add an API route in [backend/app/main.py](backend/app/main.py) such as:
   - `POST /pipeline/mcp/health`
   - `POST /pipeline/mcp/run`

4. Connect the pipeline to the MCP server before stage execution.
   - If the MCP server is unreachable, fail early with a clear message.
   - If reachable, forward a small payload such as repository context, config, and scan metadata.

5. Add test coverage in [backend/tests](backend/tests).

### Acceptance criteria
- The backend can prove whether the MCP endpoint is reachable.
- An unreachable server returns a friendly error.
- The pipeline fails fast with the MCP error instead of silently continuing.

---

## 2. Vercel deployment integration

### Goal
Add an end-to-end deployment path so a successful pipeline run can trigger a Vercel deployment.

### Files to touch
- [backend/app/main.py](backend/app/main.py)
- [backend/app/pipeline](backend/app/pipeline)
- [nexcode.config.json](nexcode.config.json)
- [Extension/src/extension.ts](Extension/src/extension.ts)
- [Extension/src/apiClient.ts](Extension/src/apiClient.ts)

### Implementation steps

1. Extend the deployment config section in [nexcode.config.json](nexcode.config.json).

   ```json
   {
     "deployment": {
       "provider": "vercel",
       "token": "YOUR_VERCEL_TOKEN",
       "team_id": "YOUR_TEAM_ID",
       "project_id": "YOUR_PROJECT_ID",
       "production": true
     }
   }
   ```

2. Add a backend endpoint such as:
   - `POST /pipeline/deploy`

3. Call the Vercel API with `https://api.vercel.com/v13/deployments`.
   - Send the project identifier and environment values.
   - Return the deployment URL and status.

4. Add an extension command such as:
   - `NexCode: Deploy to Vercel`

5. Optionally add a command palette entry and keyboard shortcut.

### Acceptance criteria
- A valid deployment request returns a deployment URL or deployment ID.
- The extension can trigger the backend deployment route.
- Errors from Vercel are surfaced clearly to the user.

---

## 3. Celery workers and Redis queue

### Goal
Move the pipeline job processing off the FastAPI process and into a real background worker system.

### Files to touch
- [backend/app/main.py](backend/app/main.py)
- [backend/app/pipeline](backend/app/pipeline)
- [backend/requirements.txt](backend/requirements.txt)
- [backend/Dockerfile](backend/Dockerfile)

### Implementation steps

1. Create a Celery app module.
   Example file:
   - [backend/app/pipeline/worker.py](backend/app/pipeline/worker.py) or [backend/app/celery_app.py](backend/app/celery_app.py)

2. Define a task for the pipeline scan.
   - The task should receive the request payload and call [backend/app/pipeline/agent.py](backend/app/pipeline/agent.py).

3. Use Redis as the broker and result backend.
   - Add Redis connection settings.
   - Default values:

   ```text
   CELERY_BROKER_URL=redis://localhost:6379/0
   CELERY_RESULT_BACKEND=redis://localhost:6379/0
   ```

4. Replace the SQLite worker loop with Celery task submission.
   - Keep the current SQLite job store as a compatibility fallback if needed.
   - When a scan request arrives, enqueue a Celery task and persist the job id.

5. Add a worker process entry in Docker or local startup.
   - Example:

   ```bash
   celery -A app.celery_app worker -l info
   ```

6. Add a Flower or simple status endpoint if you want monitoring.

### Acceptance criteria
- A pipeline scan is queued and processed by a Celery worker.
- Redis contains the job metadata and the task is executed outside the web process.
- Job status can still be retrieved through the existing route.

---

## 4. Keyboard shortcuts

### Goal
Make the most common commands reachable from the keyboard without opening the command palette.

### Files to touch
- [Extension/package.json](Extension/package.json)

### Implementation steps

1. Add a `contributes.keybindings` section to [Extension/package.json](Extension/package.json).

2. Suggested shortcuts:
   - `Ctrl+Shift+E` → `nexcode.explainCode`
   - `Ctrl+Shift+F` → `nexcode.fixCode`
   - `Ctrl+Shift+R` → `nexcode.reviewCode`
   - `Ctrl+Shift+G` → `nexcode.generateCode`
   - `Ctrl+Shift+P` → `nexcode.runPipeline`

3. Reload the extension host and verify the shortcuts in the Keyboard Shortcuts editor.

### Acceptance criteria
- The shortcuts appear in the VS Code keyboard shortcuts list.
- Pressing the key combination triggers the command and the expected UI result.

---

## 5. Registered pipeline command in the extension

### Goal
Ensure the pipeline command is confidently discoverable and works from the command palette, editor context menu, and keyboard shortcuts.

### Files to touch
- [Extension/src/extension.ts](Extension/src/extension.ts)
- [Extension/package.json](Extension/package.json)

### Implementation steps

1. Confirm the command is registered in [Extension/src/extension.ts](Extension/src/extension.ts).
2. Add or keep a contribution entry in [Extension/package.json](Extension/package.json).
3. Add the command to the command palette menu and editor context menu.
4. Verify the command shows up in the Command Palette and can run.

### Acceptance criteria
- `NexCode: Run Pipeline Scan` appears in the Command Palette.
- The command runs against the current editor selection.
- The command surfaces pipeline status and result notifications.

---

## 6. Extension automated tests

### Goal
Add real tests for extension behavior instead of relying only on manual verification.

### Files to touch
- [Extension/package.json](Extension/package.json)
- [Extension/test](Extension/test)
- [Extension/src](Extension/src)

### Implementation steps

1. Add test dependencies:
   - `@types/mocha`
   - `@vscode/test-electron`
   - `mocha`

2. Add scripts to [Extension/package.json](Extension/package.json):
   - `test`: `node ./out/test/runTest.js`

3. Create a minimal test harness in [Extension/test](Extension/test):
   - `runTest.ts`
   - `suite/index.ts`
   - `suite/extension.test.ts`

4. Write tests for core behaviors:
   - command registration
   - API client request formatting
   - pipeline scan prompt flow
   - notification behavior

5. Run the tests locally:

   ```bash
   cd Extension
   npm install
   npm run test
   ```

### Acceptance criteria
- The extension test suite runs successfully in CI or locally.
- At least one command registration test and one API client test exist.
- The tests cover the new pipeline workflow.

---

## Suggested delivery checklist

- [ ] MCP health check and config entry
- [ ] Vercel deployment backend route
- [ ] Celery task + Redis broker integration
- [ ] Keyboard shortcuts contribution
- [ ] Pipeline command visibility in palette/context menu
- [ ] Extension test harness and first tests

## Local verification commands

```bash
cd backend
python -m pytest
```

```bash
cd Extension
npm run compile
npm run bundle
npm run test
```

## Notes

- The current repository already has a pipeline command registration path in [Extension/src/extension.ts](Extension/src/extension.ts), so that part is closer to done than the checklist suggests.
- The backend already has SQLite-backed durable jobs and worker-style processing in [backend/app/pipeline/job_store.py](backend/app/pipeline/job_store.py), so the Celery/Redis work should be treated as an evolution rather than a fresh rewrite.
