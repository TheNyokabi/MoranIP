from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Numeric,
    Enum,
    UniqueConstraint,
    Boolean
)
from sqlalchemy.orm import relationship

from app.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)

    workspace_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    reference_id = Column(String, nullable=True)

    posting_date = Column(DateTime, default=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow)

    lines = relationship(
        "JournalLine",
        back_populates="entry",
        cascade="all, delete-orphan",
    )


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, index=True)

    journal_entry_id = Column(
        Integer,
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
    )

    account_code = Column(String, nullable=False, index=True)

    debit = Column(Numeric(14, 2), default=0)
    credit = Column(Numeric(14, 2), default=0)

    currency = Column(String, nullable=False)

    entry = relationship("JournalEntry", back_populates="lines")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)

    workspace_id = Column(String, nullable=False, index=True)

    code = Column(String, nullable=False)
    name = Column(String, nullable=False)

    type = Column(
        Enum(
            "asset",
            "liability",
            "equity",
            "income",
            "expense",
            name="account_type",
        ),
        nullable=False,
    )

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        # same account code cannot repeat in one workspace
        UniqueConstraint("workspace_id", "code", name="uq_workspace_account_code"),
    )