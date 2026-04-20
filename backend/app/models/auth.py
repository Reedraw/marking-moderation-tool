# Import Pydantic BaseModel for request/response validation, Field for constraints
from pydantic import BaseModel, Field
# Import UserOut model - included in the login response so the frontend knows who logged in
from .user import UserOut

# Response model returned after successful login
# Contains the JWT token and the authenticated user's details
class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token")  # The signed JWT string
    token_type: str = Field("bearer", description="Token type")     # Always "bearer" for OAuth2 compatibility
    user: UserOut                                                    # Full user details (id, name, role, etc.)
