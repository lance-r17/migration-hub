# MCP Integration Guide

Migration Hub exposes its data and planning capabilities via the **Model Context Protocol (MCP)** over **Server-Sent Events (SSE)**. This allows external AI agents to perform deep analysis, wave planning, and scheduling assistance.

## Endpoint

```
GET /mcp/sse
POST /mcp/messages?session_id=<uuid>
```

The SSE endpoint is mounted inside the existing FastAPI application at `/mcp/sse`. The message endpoint is automatically provided by the MCP transport.

## Authentication

The MCP endpoint uses the same authentication as the REST API. Supported modes:

- **API Key**: `X-API-Key: <key>` header
- **Backend JWT**: `Authorization: Bearer <token>` (when `OAUTH_SERVICE_URL` is configured)
- **OIDC JWT**: `Authorization: Bearer <token>` (when `OIDC_ISSUER` is configured)
- **Mock mode**: No auth required (development only)

Unauthenticated SSE connections receive **HTTP 401**.

## Connecting an MCP Client (Python)

```python
from mcp.client.sse import sse_client
from mcp import ClientSession

async with sse_client("http://localhost:8000/mcp/sse") as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        print([t.name for t in tools.tools])

        result = await session.call_tool("get_overall_stats", {})
        print(result.content[0].text)
```

## Agent Configuration

### Claude Desktop (Anthropic)

Claude Desktop supports MCP servers via its configuration file.

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "migration-hub": {
      "command": "python",
      "args": [
        "-m", "mcp.client.sse",
        "--url", "https://migration-hub.example.com/mcp/sse"
      ],
      "env": {
        "X_API_KEY": "mhub_your-api-key-here"
      }
    }
  }
}
```

For SSE-based connections, use an HTTP header approach with a proxy or connect via a local bridge script:

```python
# bridge.py — local SSE-to-stdio bridge for Claude Desktop
import asyncio
import os
from mcp.client.sse import sse_client
from mcp import ClientSession

async def main():
    url = os.environ.get("MCP_URL", "https://migration-hub.example.com/mcp/sse")
    headers = {"X-API-Key": os.environ.get("X_API_KEY", "")}
    async with sse_client(url, headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            # Bridge to stdio here if needed

if __name__ == "__main__":
    asyncio.run(main())
```

### Claude Code

Claude Code reads MCP servers from `.mcp.json` in the project root or user home directory:

```json
{
  "mcpServers": {
    "migration-hub": {
      "url": "https://migration-hub.example.com/mcp/sse",
      "headers": {
        "X-API-Key": "mhub_your-api-key-here"
      }
    }
  }
}
```

### Cursor

Cursor supports MCP servers via `.cursor/mcp.json` in your project or workspace:

```json
{
  "mcpServers": {
    "migration-hub": {
      "url": "https://migration-hub.example.com/mcp/sse",
      "headers": {
        "X-API-Key": "mhub_your-api-key-here"
      }
    }
  }
}
```

### PI (Project Intelligence)

PI reads MCP configuration from `.pi/mcp.json` in the project root:

```json
{
  "mcpServers": {
    "migration-hub": {
      "url": "https://migration-hub.example.com/mcp/sse",
      "headers": {
        "X-API-Key": "mhub_your-api-key-here"
      },
      "auth": false,
      "lifecycle": "lazy",
      "directTools": true
    }
  }
}
```

Place this file at `.pi/mcp.json` in your project root. The `lifecycle: lazy` setting ensures the connection is only established when a tool is actually invoked.

### GitHub Copilot / VS Code

VS Code with GitHub Copilot Chat supports MCP servers through `settings.json`:

```json
{
  "github.copilot.chat.mcpServers": {
    "migration-hub": {
      "url": "https://migration-hub.example.com/mcp/sse",
      "headers": {
        "X-API-Key": "mhub_your-api-key-here"
      }
    }
  }
}
```

> **Note:** VS Code MCP support is experimental. Check the [VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for the latest configuration format.

### Windsurf (Codeium)

Windsurf supports MCP through its cascade configuration:

```json
{
  "mcpServers": {
    "migration-hub": {
      "url": "https://migration-hub.example.com/mcp/sse",
      "headers": {
        "X-API-Key": "mhub_your-api-key-here"
      }
    }
  }
}
```

### OpenAI Codex

OpenAI Codex (in preview) supports function calling. To bridge MCP to Codex, use the OpenAI Agents SDK with an MCP adapter:

```python
from openai import OpenAI
from mcp.client.sse import sse_client
from mcp import ClientSession

client = OpenAI()

async def call_migration_hub_tool(tool_name: str, arguments: dict):
    async with sse_client(
        "https://migration-hub.example.com/mcp/sse",
        headers={"X-API-Key": "mhub_your-api-key-here"}
    ) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            return result.content[0].text

# Register as an OpenAI function
tools = [{
    "type": "function",
    "function": {
        "name": "analyze_wave_readiness",
        "description": "Analyze readiness of all projects in a wave",
        "parameters": {
            "type": "object",
            "properties": {
                "wave_id": {"type": "string"}
            },
            "required": ["wave_id"]
        }
    }
}]
```

## Tool Catalog

### Discovery & Search

| Tool | Description |
|------|-------------|
| `search_projects` | Search projects by status, wave, progress, BA ID, or unsynced resources |
| `get_project_detail` | Full project details including all sections, resources, risks, and approvals |
| `list_waves` | List all migration waves with project counts |
| `get_wave_detail` | Wave details plus all assigned projects |
| `list_embargos` | List change-freeze embargo records |
| `list_users` | List users, optionally filtered by project |

### Analysis & Planning

| Tool | Description |
|------|-------------|
| `analyze_wave_readiness` | Readiness breakdown per project in a wave |
| `check_scheduling_conflicts` | Detect conflicts between wave dates, project constraints, and embargos |
| `analyze_dependency_graph` | Build dependency graph with cycle detection |
| `compute_resource_migration_progress` | Resource counts by sync status and completion |
| `analyze_risk_exposure` | Open risks grouped by severity with mitigation coverage |
| `identify_approval_bottlenecks` | Projects stalled at each approval stage |
| `suggest_wave_assignments` | Heuristic wave placement suggestions for unassigned projects |

### Dashboard & Reporting

| Tool | Description |
|------|-------------|
| `get_overall_stats` | Overall migration statistics |
| `get_recent_activity` | Recent audit log activity |
| `get_risk_register` | Flattened risk register with project and wave context |
| `get_jira_execution_status` | Jira story/subtask keys and job status per project |
| `get_migration_settings` | Platform period, cloud setup period, duration options |

## Example Agent Prompts

- *"Analyze wave readiness for wave-1 and list the top 5 blocking issues."*
- *"Find all scheduling conflicts between wave cutover dates and embargo records."*
- *"Suggest wave assignments for all unassigned projects based on their constraints."*
- *"Identify approval bottlenecks across all waves."*
- *"Compute resource migration progress by product category for wave-2."*
- *"Which projects have critical open risks and no mitigation plan?"*
- *"Give me a dependency analysis for wave-3 — are there any upstream projects that will miss their cutover?"*
- *"What is the overall migration progress and how many assets are still pending?"*

## Security Notes

| Concern | Recommendation |
|---------|----------------|
| **API Keys** | Use service accounts with scoped permissions. Rotate keys regularly. Never commit keys to version control. |
| **JWT Tokens** | Backend JWT tokens expire (default: 8 hours). MCP connections using JWT will fail after expiry — the client must re-authenticate. |
| **CORS** | The SSE endpoint inherits FastAPI CORS settings. In production, restrict `CORS_ORIGINS` to known agent hosts. |
| **Rate Limiting** | Consider adding per-IP rate limits on `/mcp/sse` if agent traffic is high. |
| **Audit Logging** | All tool calls run under the authenticated user's identity. Audit logs record the actor for any data access. |

## K8s Deployment Notes

The MCP endpoint runs inside the same `backend-api` Deployment as the REST API. No new pods or services are required. See the [K8s Deployment Pattern](deployment/k8s-architecture.md) section for SSE-specific ingress considerations (idle timeouts, buffering).
