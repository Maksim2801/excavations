from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ExcavationMember(Base):
    __tablename__ = "excavation_members"
    excavation_id: Mapped[int] = mapped_column(ForeignKey("excavations.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
