from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    username: str
    email: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    username: str
    password: str


class EbookBase(BaseModel):
    title: str
    author: Optional[str] = None


class EbookResponse(EbookBase):
    id: int
    filename: str
    file_format: str
    file_size: int
    created_at: datetime
    owner_id: int

    class Config:
        from_attributes = True


class ConvertResponse(BaseModel):
    success: bool
    message: str
    converted_filename: Optional[str] = None
