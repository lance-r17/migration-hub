import contextvars
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


# Context variable to pass authenticated user from SSE route handler to tool handlers.
# asyncio / anyio task groups copy the parent context, so each tool call sees the user
# that was set when the SSE connection was established.
mcp_user_ctx: contextvars.ContextVar[User | None] = contextvars.ContextVar("mcp_user", default=None)


@dataclass
class McpContext:
    """Context passed to every tool handler."""

    user: User
    db: AsyncSession
