from pydantic import BaseModel, Field
from .user import UserOut

class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")
    user: UserOut
