"""Database model for agent todo lists.

Todos are a lightweight working-memory tool — a scratchpad for multi-step work.
The whole list is rewritten atomically each turn by the LLM via the `todo_write`
tool (Claude Code's TodoWrite pattern). Active todos are auto-injected into the
user-message prefix every turn so the model always sees current state.

Status workflow:
    pending → in_progress → completed
    (or cancelled if abandoned)
"""

from datetime import datetime
from uuid import uuid4
import enum

from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID

from backend.db.base import Base


class TodoStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Todo(Base):
    __tablename__ = "todos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Imperative form, e.g. "Fix the embedding loader"
    content = Column(Text, nullable=False)
    # Present-continuous form for the spinner / status line, e.g. "Fixing the embedding loader"
    active_form = Column(Text, nullable=True)
    status = Column(
        Enum(TodoStatus, name="todo_status", native_enum=False),
        nullable=False,
        default=TodoStatus.pending,
    )
    # Display order — lower = earlier in the list. Set by todo_write on each rewrite.
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "content": self.content,
            "active_form": self.active_form,
            "status": self.status.value if isinstance(self.status, TodoStatus) else self.status,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
