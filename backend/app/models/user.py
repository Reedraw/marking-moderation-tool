from datetime import datetime
from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["lecturer", "moderator", "third_marker", "admin"]


class UserBase(BaseModel):
    username: str = Field(..., min_length=1, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="User email")
    full_name: Optional[str] = Field(None, max_length=120, description="Optional full name")
    role: Role = Field(..., description="System role (RBAC)")


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=120)
    role: Role
    password: str = Field(..., min_length=8, description="Plain password; will be hashed server-side")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
