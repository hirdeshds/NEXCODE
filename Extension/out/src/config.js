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
exports.setExtensionContext = setExtensionContext;
exports.getSecret = getSecret;
exports.storeSecret = storeSecret;
exports.getBackendUrl = getBackendUrl;
exports.isInlineCompletionEnabled = isInlineCompletionEnabled;
const vscode = __importStar(require("vscode"));
const DEFAULT_BACKEND_URL = "https://nexcode-3n9e.onrender.com";
let extensionContext;
function setExtensionContext(context) {
    extensionContext = context;
}
async function getSecret(key) {
    if (!extensionContext) {
        return undefined;
    }
    return extensionContext.secrets.get(key);
}
async function storeSecret(key, value) {
    if (!extensionContext) {
        return;
    }
    if (value === undefined) {
        await extensionContext.secrets.delete(key);
    }
    else {
        await extensionContext.secrets.store(key, value);
    }
}
function getBackendUrl() {
    const configuredUrl = vscode.workspace
        .getConfiguration("nexcode")
        .get("backendUrl", DEFAULT_BACKEND_URL);
    return configuredUrl.replace(/\/$/, "");
}
function isInlineCompletionEnabled() {
    return vscode.workspace
        .getConfiguration("nexcode")
        .get("enableInlineCompletion", true);
}
//# sourceMappingURL=config.js.map