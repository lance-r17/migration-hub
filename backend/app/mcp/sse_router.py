import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from mcp.server.sse import SseServerTransport
from starlette.responses import Response

from app.auth import get_current_user
from app.mcp.context import mcp_user_ctx
from app.mcp.server import create_mcp_server
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared transport instance — handles multiple concurrent SSE sessions.
# ``SseServerTransport`` maintains a dict of session writers keyed by UUID.
_transport = SseServerTransport("/mcp/messages")


class _MCPSSEResponse(Response):
    """Custom Starlette response that delegates to ``SseServerTransport.connect_sse``."""

    def __init__(self, server) -> None:
        self.server = server
        super().__init__(content=None, status_code=200, media_type="text/event-stream")

    async def __call__(self, scope, receive, send) -> None:
        async with _transport.connect_sse(scope, receive, send) as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options(),
            )


class _MCPMessagesResponse(Response):
    """Custom Starlette response that delegates to ``SseServerTransport.handle_post_message``."""

    async def __call__(self, scope, receive, send) -> None:
        await _transport.handle_post_message(scope, receive, send)


@router.get("/sse")
async def mcp_sse(request: Request, user: User = Depends(get_current_user)) -> Response:
    """Establish an MCP SSE connection."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Store the authenticated user in the contextvar so that tool handlers
    # running inside this connection's task tree can access it.
    mcp_user_ctx.set(user)

    server = create_mcp_server()
    return _MCPSSEResponse(server)


@router.post("/messages")
async def mcp_messages(request: Request) -> Response:
    """Accept POST messages from an MCP client."""
    return _MCPMessagesResponse()
