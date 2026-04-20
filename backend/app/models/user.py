# Import datetime for timestamp fields (created_at, updated_at)
from datetime import datetime
# Import Optional for nullable field types
from typing import Optional, Literal
# Import UUID type for unique identifier fields
from uuid import UUID

# Import Pydantic BaseModel for data validation and serialisation
# ConfigDict for model configuration, EmailStr for email validation, Field for constraints
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Define the allowed user roles as a Literal type - restricts values to these 4 options
# This is used for Role-Based Access Control (RBAC) throughout the application
Role = Literal["lecturer", "moderator", "third_marker", "admin"]


# Base user model with common fields shared between create/read operations
class UserBase(BaseModel):
    username: str = Field(..., min_length=1, max_length=50, description="Unique username")   # Login identifier
    email: EmailStr = Field(..., description="User email")                                    # Validated email format
    full_name: Optional[str] = Field(None, max_length=120, description="Optional full name")  # Display name (optional)
    role: Role = Field(..., description="System role (RBAC)")                                  # One of the 4 allowed roles


# Model for user registration requests - extends base with password field
class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)           # Username for the new account
    email: EmailStr                                                    # Email address (validated format)
    full_name: Optional[str] = Field(None, max_length=120)            # Optional display name
    role: Role                                                         # Role to assign to the user
    password: str = Field(..., min_length=8, description="Plain password; will be hashed server-side")  # Min 8 chars, hashed with Argon2


# Model for login requests - only needs email and password
class UserLogin(BaseModel):
    email: EmailStr      # Email used as login identifier
    password: str        # Plaintext password to verify against stored hash


# Model for user data returned in API responses - extends base with database fields
class UserOut(UserBase):
    id: UUID              # Unique identifier from the database
    is_active: bool       # Whether the account is active (can be deactivated by admin)
    created_at: datetime  # When the account was created
    updated_at: datetime  # When the account was last modified

    # Allow creating this model from database row objects (asyncpg Record)
    model_config = ConfigDict(from_attributes=True)
