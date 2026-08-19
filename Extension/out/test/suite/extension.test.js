"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const apiClient = __importStar(require("../../src/apiClient"));
suite("NexCode Extension Test Suite", () => {
    let server;
    let serverPort;
    let receivedRequests = [];
    let serverResponseData = {};
    let serverStatusCode = 200;
    let originalBackendUrl;
    suiteSetup(async () => {
        // Save original backend URL
        originalBackendUrl = vscode.workspace.getConfiguration("nexcode").get("backendUrl");
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
                    }
                    catch {
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
        await new Promise((resolve) => {
            server.listen(0, "127.0.0.1", () => {
                const address = server.address();
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
        await new Promise((resolve) => {
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
        const healthRequests = receivedRequests.filter(r => r.url === "/health");
        assert.ok(healthRequests.length >= 1, "Should have received at least one health request");
        assert.strictEqual(healthRequests[0].method, "GET");
    });
    test("3. API Client Request Formatting - startPipelineScan", async () => {
        serverResponseData = { job_id: "test-job-id-999" };
        const jobId = await apiClient.startPipelineScan("const code = 1;", "javascript");
        assert.strictEqual(jobId, "test-job-id-999");
        const scanRequests = receivedRequests.filter(r => r.url === "/pipeline/scan");
        assert.strictEqual(scanRequests.length, 1);
        assert.strictEqual(scanRequests[0].method, "POST");
        assert.deepStrictEqual(scanRequests[0].body, {
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
                    }
                    catch {
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
                }
                else if (req.url === "/pipeline/status/job-workflow-test") {
                    statusRequestReceived = true;
                    res.end(JSON.stringify({
                        result: {
                            overall_status: "passed",
                            pr: { status: "success", pr_url: "https://github.com/mock/pr" }
                        }
                    }));
                }
                else {
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
//# sourceMappingURL=extension.test.js.map