# NexCode

## Your Refined Idea — In One Line

NexCode is an AI-powered VS Code extension that helps developers write, fix, and complete code — and connects to any company's CI/CD pipeline to MCP/JSON to automatically scan, test, and raise PRs before a single line reaches production.

## What Makes This Different from Copilot

Copilot only helps you write code. NexCode also plugs into your pipeline, scans the code in 3 stages using an AI agent, creates a replica environment to test safely, and only raises a real PR after all checks pass.

## Features

- **AI-Powered Code Assistance** - Write, fix, and complete code with intelligent suggestions
- **Multi-Stage Code Scanning** - Scan code in 3 stages using an AI agent for comprehensive analysis
- **CI/CD Integration** - Seamlessly connects to any company's CI/CD pipeline
- **Safe Testing Environment** - Creates a replica environment to test code changes safely
- **Automated PR Management** - Automatically raises PRs only after all checks pass

## Project Structure

```
├── backend/           # Python FastAPI backend
├── frontend/          # TypeScript VS Code extension
├── LICENSE
├── README.md
└── nexcode.config.json
```

## Getting Started

### Prerequisites

- Node.js 16+
- Python 3.8+
- VS Code 1.60+

### Installation

1. Clone the repository
2. Install backend dependencies: `pip install -r backend/requirements.txt`
3. Install frontend dependencies: `cd frontend && npm install`
4. Build the extension

## License

See [LICENSE](LICENSE) for details.
