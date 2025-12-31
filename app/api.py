from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.models import AnalyzeRequest, AnalyzeResponse, WriteRequest, WriteResponse
from app.agents.analyzer import AnalyzerAgent
from app.agents.writer import WriterAgent
from app.utils import create_docx
import shutil
import os
import uuid
from typing import Dict, Any

router = APIRouter()

# Initialize Agents
analyzer = AnalyzerAgent()
writer = WriterAgent()

# Store generated content for docx creation
generated_contents = {}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    try:
        # Create uploads directory if not exists
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Basic text extraction for context (very simple version)
        content = ""
        if file.filename.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        # TODO: Add PDF/Docx extraction logic here if needed, 
        # for now we just return the path and filename.
        
        return {
            "filename": file.filename, 
            "file_path": file_path, 
            "content_preview": content[:1000] if content else "Binary/Complex file uploaded"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        result = analyzer.run(request.topic, request.file_content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/write/stream")
async def write_stream(request: WriteRequest):
    """Streaming endpoint for article generation."""
    def generate():
        full_content = []
        for chunk in writer.stream(request.system_prompt, request.user_instructions):
            full_content.append(chunk)
            yield chunk
        # Store the full content for docx generation
        content_id = uuid.uuid4().hex[:8]
        generated_contents[content_id] = "".join(full_content)
        # Send the content ID at the end (marked with special token)
        yield f"\n[CONTENT_ID:{content_id}]"
    
    return StreamingResponse(generate(), media_type="text/plain")

@router.post("/docx/{content_id}")
async def create_docx_file(content_id: str):
    """Create docx from previously generated content."""
    if content_id not in generated_contents:
        raise HTTPException(status_code=404, detail="Content not found")
    
    content = generated_contents[content_id]
    filename = f"article_{content_id}.docx"
    filepath = create_docx(content, filename)
    download_url = f"/static/downloads/{filename}"
    
    # Clean up stored content
    del generated_contents[content_id]
    
    return {"download_url": download_url}

@router.post("/write")
async def write(request: WriteRequest):
    """Non-streaming endpoint (kept for compatibility)."""
    try:
        content = writer.run(request.system_prompt, request.user_instructions)
        
        # Generate Docx
        filename = f"article_{uuid.uuid4().hex[:8]}.docx"
        filepath = create_docx(content, filename)
        
        download_url = f"/static/downloads/{filename}"
        
        return {
            "content": content, 
            "download_url": download_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExpandRequest(BaseModel):
    selected_text: str
    context: str = ""  # Optional surrounding context

@router.post("/expand")
async def expand_section(request: ExpandRequest):
    """Expand a selected section of text to make it longer and more detailed."""
    def generate():
        expand_prompt = f"""请将以下选中的文字内容扩展得更长、更详细。

选中的内容：
{request.selected_text}

要求：
1. 保持原有的主题和观点
2. 增加更多细节、例子、论述
3. 扩展后的内容至少是原来的2-3倍长
4. 保持语言风格一致
5. 直接输出扩展后的内容，不要有任何解释或前言

请直接输出扩展后的内容："""
        
        for chunk in writer.stream(expand_prompt, "请扩展这段内容"):
            yield chunk
    
    return StreamingResponse(generate(), media_type="text/plain")

class DocxRequest(BaseModel):
    content: str

@router.post("/generate_docx")
async def generate_docx_endpoint(request: DocxRequest):
    """Generate docx from provided content string."""
    try:
        filename = f"article_{uuid.uuid4().hex[:8]}.docx"
        filepath = create_docx(request.content, filename)
        download_url = f"/static/downloads/{filename}"
        return {"download_url": download_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
