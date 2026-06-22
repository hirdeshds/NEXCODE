import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { getBackendUrl } from "./config";

type HttpMethod = "GET" | "POST";

function requestJson<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const url = new URL(`${getBackendUrl()}${path}`);
  const payload = body ? JSON.stringify(body) : undefined;
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
        },
      },
      (response) => {
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
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error("Backend returned invalid JSON."));
          }
        });
      },
    );

    request.on("error", (error) => {
      reject(error);
    });

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await requestJson<{ status: string }>("GET", "/health");
    return response.status === "ok";
  } catch {
    return false;
  }
}

export async function explainCode(code: string): Promise<string> {
  const response = await requestJson<{ explanation: string }>("POST", "/explain", { code });
  return response.explanation;
}

export async function fixCode(code: string): Promise<string> {
  const response = await requestJson<{ fixed_code: string }>("POST", "/fix", { code });
  return response.fixed_code;
}

export async function generateCode(prompt: string): Promise<string> {
  const response = await requestJson<{ code: string }>("POST", "/generate", { prompt });
  return response.code;
}

export async function completeCode(code: string): Promise<string> {
  const response = await requestJson<{ code: string }>("POST", "/complete", { code });
  return response.code;
}

export async function testCompleteCode(code: string): Promise<string> {
  const response = await requestJson<{ code: string }>("POST", "/test-complete", { code });
  return response.code;
}

export async function streamCompleteCode(code: string, onChunk: (chunk: string) => void): Promise<void> {
  const url = new URL(`${getBackendUrl()}/stream/complete`);
  const payload = JSON.stringify({ code });
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString(),
        },
      },
      (response) => {
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          onChunk(chunk);
        });

        response.on("end", () => {
          if (!response.statusCode || response.statusCode >= 400) {
            reject(new Error(`Backend error ${response.statusCode}`));
            return;
          }
          resolve();
        });
      },
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.write(payload);
    request.end();
  });
}
