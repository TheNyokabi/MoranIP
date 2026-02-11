from pydantic import BaseModel
from typing import Optional, Dict


class EntityCreate(BaseModel):
    id:str
    type:str
    external_ref: Optional[str] = None
    metadata: Optional[Dict] = {}
    
class EntityOut(EntityCreate):
    active: bool    