from pydantic import BaseModel
from typing import List


class AccountCreate(BaseModel):
    workspace_id: str
    code: str
    name: str
    type: str


class AccountResponse(AccountCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
