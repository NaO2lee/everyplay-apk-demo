from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class DeviceRegister(BaseModel):
    event_code: str
    device_id: str
    device_name: str


class DeviceTokenResponse(BaseModel):
    device_token: str
    event: dict
    expires_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    expires_at: datetime


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True


# Update forward reference
TokenResponse.model_rebuild()
