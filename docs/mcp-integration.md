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

## K8s Deployment Notes

The MCP endpoint runs inside the same `backend-api` Deployment as the REST API. No new pods or services are required. See the [K8s Deployment Pattern](../plans/mcp-service-design.md) section for SSE-specific ingress considerations (idle timeouts, buffering).
