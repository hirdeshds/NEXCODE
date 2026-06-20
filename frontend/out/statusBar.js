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
exports.NexCodeStatusBar = void 0;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
class NexCodeStatusBar {
    item;
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = "nexcode.explainCode";
        this.item.text = "$(sparkle) NexCode";
        this.item.tooltip = "Run NexCode on the selected code";
    }
    show() {
        this.item.show();
        void this.refresh();
    }
    dispose() {
        this.item.dispose();
    }
    async refresh() {
        const isHealthy = await (0, apiClient_1.checkHealth)();
        this.item.text = isHealthy ? "$(sparkle) NexCode" : "$(warning) NexCode";
        this.item.tooltip = isHealthy
            ? "NexCode backend is connected"
            : "NexCode backend is not reachable";
    }
}
exports.NexCodeStatusBar = NexCodeStatusBar;
//# sourceMappingURL=statusBar.js.map