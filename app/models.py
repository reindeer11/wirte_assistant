from pydantic import BaseModel
from typing import Optional, List, Union

class AnalyzeRequest(BaseModel):
    topic: str
    file_content: Optional[str] = None
    filename: Optional[str] = None

class WritingOption(BaseModel):
    id: str
    label: str
    type: str  # "select" | "toggle" | "range"
    options: Optional[List[str]] = None  # For select type
    default: Optional[Union[str, int, bool]] = None  # Can be string, int, or bool
    min_val: Optional[int] = None  # For range type
    max_val: Optional[int] = None

class AnalyzeResponse(BaseModel):
    persona: str
    article_type: str
    system_prompt: str
    content_outline: List[str]
    writing_options: List[WritingOption]

class WriteRequest(BaseModel):
    system_prompt: str
    user_instructions: str
    selected_options: Optional[dict] = None  # User's selected options

class WriteResponse(BaseModel):
    content: str

