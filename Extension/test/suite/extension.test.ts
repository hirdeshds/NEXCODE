import * as assert from "assert";
import * as vscode from "vscode";
import * as http from "http";
import * as apiClient from "../../src/apiClient";

suite("NexCode Extension Test Suite", () => {
  let server: http.Server;
  let serverPort: number;
  let receivedRequests: { url: string; method: string; body: any }[] = [];
  let serverResponseData: any = {};
  let serverStatusCode = 200;
  let originalBackendUrl: string | undefined;

  suiteSetup(async () => {
    // Save original backend URL
    originalBackendUrl = vscode.workspace.getConfiguration("nexcode").get<string>("backendUrl");

    // Spin up local HTTP server to mock the backend
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        let parsedBody = null;
        if (body) {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }
        }
        receivedRequests.push({
          url: req.url || "",
          method: req.method || "",
          body: parsedBody,
        });

        res.writeHead(serverStatusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(serverResponseData));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        serverPort = address.port;
        resolve();
      });
    });

    // Point extension to our local mock server
    const localUrl = `http://127.0.0.1:${serverPort}`;
    await vscode.workspace.getConfiguration("nexcode").update("backendUrl", localUrl, vscode.ConfigurationTarget.Global);

    // Manually activate extension to ensure all commands are registered
    const ext = vscode.extensions.getExtension("hirdeshds.nexcode-ai-studio-pro");
    if (ext) {
      await ext.activate();
    }
  });

  suiteTeardown(async () => {
    // Restore original backend URL
    await vscode.workspace.getConfiguration("nexcode").update("backendUrl", originalBackendUrl, vscode.ConfigurationTarget.Global);
    
    // Close mock server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  setup(() => {
    receivedRequests = [];
    serverResponseData = {};
    serverStatusCode = 200;
  });

  test("1. Command Registration", async () => {
    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = [
      "nexcode.explainCode",
      "nexcode.fixCode",
      "nexcode.reviewCode",
      "nexcode.generateCode",
      "nexcode.runPipeline",
      "nexcode.deployToVercel",
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered.`);
    }
  });

  test("2. API Client Request Formatting - checkHealth", async () => {
    serverResponseData = { status: "ok" };
    const health = await apiClient.checkHealth();
    assert.strictEqual(health, true);
    assert.strictEqual(receivedRequests.length, 1);
    assert.strictEqual(receivedRequests[0].url, "/health");
    assert.strictEqual(receivedRequests[0].method, "GET");
  });

  test("3. API Client Request Formatting - startPipelineScan", async () => {
    serverResponseData = { job_id: "test-job-id-999" };
    const jobId = await apiClient.startPipelineScan("const code = 1;", "javascript");
    assert.strictEqual(jobId, "test-job-id-999");
    assert.strictEqual(receivedRequests.length, 1);
    assert.strictEqual(receivedRequests[0].url, "/pipeline/scan");
    assert.strictEqual(receivedRequests[0].method, "POST");
    assert.deepStrictEqual(receivedRequests[0].body, {
      code: "const code = 1;",
      language: "javascript",
    });
  });

  test("4. Pipeline Command Workflow - runPipeline execution", async () => {
    // Setup server to respond to scan request, then status request
    let scanRequestReceived = false;
    let statusRequestReceived = false;

    // Reset received requests for this test specifically
    receivedRequests = [];

    // Modify serverResponseData dynamically depending on the route requested
    server.removeAllListeners("request");
    server.on("request", (req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        let parsedBody = null;
        if (body) {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }
        }
        receivedRequests.push({
          url: req.url || "",
          method: req.method || "",
          body: parsedBody,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        if (req.url === "/pipeline/scan") {
          scanRequestReceived = true;
          res.end(JSON.stringify({ job_id: "job-workflow-test" }));
        } else if (req.url === "/pipeline/status/job-workflow-test") {
          statusRequestReceived = true;
          res.end(JSON.stringify({
            result: {
              overall_status: "passed",
              pr: { status: "success", pr_url: "https://github.com/mock/pr" }
            }
          }));
        } else {
          res.end(JSON.stringify({}));
        }
      });
    });

    // Create a new document to set as the active editor
    const doc = await vscode.workspace.openTextDocument({
      content: "console.log('Testing pipeline command workflow');",
      language: "javascript",
    });
    await vscode.window.showTextDocument(doc);

    // Trigger the pipeline command
    await vscode.commands.executeCommand("nexcode.runPipeline");

    // Assert that the server received both the scan start request and status poll request
    assert.ok(scanRequestReceived, "Should have received /pipeline/scan request");
    assert.ok(statusRequestReceived, "Should have received /pipeline/status request");

    // Clean up active editor (close the document)
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});
