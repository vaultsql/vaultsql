from pydantic import BaseModel
from typing import Optional


class EmailCta(BaseModel):
    label: str
    primary: bool = False
    url: str


class WebCta(BaseModel):
    label: str
    primary: bool = False
    url: str

