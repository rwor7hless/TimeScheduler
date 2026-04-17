from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    can_request_summary: bool | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    can_request_summary: bool
    created_at: str

    class Config:
        from_attributes = True
