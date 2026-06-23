---
trigger: always_on
---

---
description: Mandatory testing policy to use Chrome DevTools MCP and bypass default browser agents.
---

# Testing & Browser Automation Policy

## Core Requirement
**NEVER** use the internal Antigravity browser agent (built-in "computer use" or "browser" tools) for automated testing, UI verification, or web navigation. These tools are token-intensive and inefficient for our workflow.

## Mandatory Tool: Chrome DevTools MCP
All browser-based automation and testing MUST be performed exclusively using the **Chrome DevTools MCP** server.

### 1. Execution Guidelines
- **Automated Testing:** Use the `chrome-devtools` tools (e.g., `Maps_page`, `click`, `fill_form`, `evaluate_script`) to perform functional tests.
- ** Use existing localhost:** Always assume that the app I'm asking you to test is hosted on local host and if the thread history doesn't already provide the port name, then just ask me.
- **Performance Audits:** Use `performance_start_trace` and `performance_stop_trace` for any speed or LCP audits.
- **Debugging:** Use `list_console_messages` and `list_network_requests` to diagnose front-end errors.

### 2. Efficiency & Token Management
- **Token Conservation:** By using the MCP server, you interact with the local browser instance directly via the protocol, which significantly reduces the context window overhead compared to the native browser agent.
- **Speed:** Local execution via the MCP is the preferred method to ensure faster feedback loops during the development of HotWax Commerce apps (Ionic/Moqui/OFBiz).

### 3. Failover Protocol
- If the Chrome DevTools MCP is not connected, **stop and ask the user** to verify the `mcp_config.json` configuration or to run Chrome with the `--remote-debugging-port=9222` flag.
- Do **not** "fall back" to the internal browser agent under any circumstances.

---
**Post-Rule Enforcement:** Every test plan generated must start with a step to initialize the Chrome DevTools MCP session.