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
exports.checkHealth = checkHealth;
exports.explainCode = explainCode;
exports.fixCode = fixCode;
exports.reviewCode = reviewCode;
exports.generateCode = generateCode;
exports.completeCode = completeCode;
exports.testCompleteCode = testCompleteCode;
exports.startPipelineScan = startPipelineScan;
exports.getPipelineStatus = getPipelineStatus;
exports.streamCompleteCode = streamCompleteCode;
exports.deployToVercel = deployToVercel;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
const config_1 = require("./config");
async function requestJson(method, path, body) {
    const url = new url_1.URL(`${(0, config_1.getBackendUrl)()}${path}`);
    const payload = body ? JSON.stringify(body) : undefined;
    const client = url.protocol === "https:" ? https : http;
    const headers = {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
    };
    const githubToken = await (0, config_1.getSecret)("nexcode.githubToken");
    if (githubToken) {
        headers["X-GitHub-Token"] = githubToken;
    }
    const githubRepo = await (0, config_1.getSecret)("nexcode.githubRepo");
    if (githubRepo) {
        headers["X-GitHub-Repo"] = githubRepo;
    }
    const vercelToken = await (0, config_1.getSecret)("nexcode.vercelToken");
    if (vercelToken) {
        headers["X-Vercel-Token"] = vercelToken;
    }
    const vercelProjectId = await (0, config_1.getSecret)("nexcode.vercelProjectId");
    if (vercelProjectId) {
        headers["X-Vercel-Project-Id"] = vercelProjectId;
    }
    const vercelTeamId = await (0, config_1.getSecret)("nexcode.vercelTeamId");
    if (vercelTeamId) {
        headers["X-Vercel-Team-Id"] = vercelTeamId;
    }
    return new Promise((resolve, reject) => {
        const request = client.request(url, {
            method,
            headers,
        }, (response) => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => {
                if (!response.statusCode || response.statusCode >= 400) {
                    reject(new Error(`Backend error ${response.statusCode}: ${data}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error("Backend returned invalid JSON."));
                }
            });
        });
        request.on("error", (error) => {
            reject(error);
        });
        if (payload) {
            request.write(payload);
        }
        request.end();
    });
}
async function checkHealth() {
    try {
        const response = await requestJson("GET", "/health");
        return response.status === "ok";
    }
    catch {
        return false;
    }
}
async function explainCode(code) {
    const response = await requestJson("POST", "/explain", { code });
    return response.explanation;
}
async function fixCode(code) {
    const response = await requestJson("POST", "/fix", { code });
    return response.fixed_code;
}
async function reviewCode(code) {
    const response = await requestJson("POST", "/review", { code });
    return response.review;
}
async function generateCode(prompt) {
    const response = await requestJson("POST", "/generate", { prompt });
    return response.code;
}
async function completeCode(code) {
    const response = await requestJson("POST", "/complete", { code });
    return response.code;
}
async function testCompleteCode(code) {
    const response = await requestJson("POST", "/test-complete", { code });
    return response.code;
}
async function startPipelineScan(code, language) {
    const response = await requestJson("POST", "/pipeline/scan", {
        code,
        language,
    });
    return response.job_id;
}
async function getPipelineStatus(jobId) {
    const response = await requestJson("GET", `/pipeline/status/${jobId}`);
    return response.result;
}
async function streamCompleteCode(code, onChunk) {
    const url = new url_1.URL(`${(0, config_1.getBackendUrl)()}/stream/complete`);
    const payload = JSON.stringify({ code });
    const client = url.protocol === "https:" ? https : http;
    const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload).toString(),
    };
    const githubToken = await (0, config_1.getSecret)("nexcode.githubToken");
    if (githubToken) {
        headers["X-GitHub-Token"] = githubToken;
    }
    const githubRepo = await (0, config_1.getSecret)("nexcode.githubRepo");
    if (githubRepo) {
        headers["X-GitHub-Repo"] = githubRepo;
    }
    const vercelToken = await (0, config_1.getSecret)("nexcode.vercelToken");
    if (vercelToken) {
        headers["X-Vercel-Token"] = vercelToken;
    }
    const vercelProjectId = await (0, config_1.getSecret)("nexcode.vercelProjectId");
    if (vercelProjectId) {
        headers["X-Vercel-Project-Id"] = vercelProjectId;
    }
    const vercelTeamId = await (0, config_1.getSecret)("nexcode.vercelTeamId");
    if (vercelTeamId) {
        headers["X-Vercel-Team-Id"] = vercelTeamId;
    }
    return new Promise((resolve, reject) => {
        const request = client.request(url, {
            method: "POST",
            headers,
        }, (response) => {
            response.setEncoding("utf8");
            let buffer = "";
            response.on("data", (chunk) => {
                buffer += chunk;
                const events = buffer.split("\n\n");
                buffer = events.pop() ?? "";
                for (const event of events) {
                    const data = event
                        .split("\n")
                        .filter((line) => line.startsWith("data:"))
                        .map((line) => line.slice(5).trimStart())
                        .join("\n");
                    if (!data || data === "[DONE]") {
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        onChunk(parsed.text ?? data);
                    }
                    catch {
                        onChunk(data);
                    }
                }
            });
            response.on("end", () => {
                if (!response.statusCode || response.statusCode >= 400) {
                    reject(new Error(`Backend error ${response.statusCode}`));
                    return;
                }
                if (buffer.startsWith("data:")) {
                    const data = buffer.slice(5).trim();
                    if (data && data !== "[DONE]") {
                        try {
                            const parsed = JSON.parse(data);
                            onChunk(parsed.text ?? data);
                        }
                        catch {
                            onChunk(data);
                        }
                    }
                }
                resolve();
            });
        });
        request.on("error", (error) => {
            reject(error);
        });
        request.write(payload);
        request.end();
    });
}
async function deployToVercel(repo, branch) {
    return requestJson("POST", "/pipeline/deploy", { repo, branch });
}
//# sourceMappingURL=apiClient.js.map