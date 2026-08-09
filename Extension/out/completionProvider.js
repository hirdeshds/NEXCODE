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
exports.NexCodeCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
const config_1 = require("./config");
const COMPLETION_DEBOUNCE_MS = 400;
const MAX_CONTEXT_LINES = 50;
function waitForDebounce(token) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            disposable.dispose();
            resolve(!token.isCancellationRequested);
        }, COMPLETION_DEBOUNCE_MS);
        const disposable = token.onCancellationRequested(() => {
            clearTimeout(timer);
            disposable.dispose();
            resolve(false);
        });
    });
}
function getCompletionContext(document, position) {
    const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    return prefix.split("\n").slice(-MAX_CONTEXT_LINES).join("\n");
}
class NexCodeCompletionProvider {
    async provideInlineCompletionItems(document, position, _context, token) {
        if (!(0, config_1.isInlineCompletionEnabled)() || !(await waitForDebounce(token))) {
            return [];
        }
        const codeContext = getCompletionContext(document, position);
        if (!codeContext.trim() || token.isCancellationRequested) {
            return [];
        }
        try {
            const code = await (0, apiClient_1.completeCode)(codeContext);
            if (token.isCancellationRequested) {
                return [];
            }
            return [
                new vscode.InlineCompletionItem(code, new vscode.Range(position, position)),
            ];
        }
        catch {
            return [];
        }
    }
}
exports.NexCodeCompletionProvider = NexCodeCompletionProvider;
//# sourceMappingURL=completionProvider.js.map