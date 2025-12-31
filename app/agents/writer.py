from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

# Load environment variables
# Try multiple paths: current directory, project root (3 levels up), parent directory
current_dir = os.path.dirname(__file__)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
paths_to_check = [
    ".env",                     # Current working directory
    os.path.join(project_root, ".env"),  # Project root
    os.path.join(os.path.dirname(project_root), ".env"), # Parent of project root
]

for path in paths_to_check:
    if os.path.exists(path):
        load_dotenv(path)
        break

# Fallback
if not os.environ.get("SILICONFLOW_API_KEY"):
    load_dotenv()

class WriterAgent:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="Qwen/Qwen2.5-72B-Instruct", 
            temperature=0.7,
            api_key=os.environ.get("SILICONFLOW_API_KEY"),
            base_url=os.environ.get("SILICONFLOW_BASE_URL"),
            streaming=True  # Enable streaming
        )
        self.output_parser = StrOutputParser()

    def _build_prompt(self, system_prompt: str, user_instructions: str):
        prompt = ChatPromptTemplate.from_messages([
            ("system", """{system_prompt}

**【强制格式规则 - 必须严格遵守】**

1. 关于文章长度：
   - 短文(500字左右)：写大约500-800字
   - 中等(1500字左右)：写大约1500-2000字
   - 长文(3000字以上)：写至少3000字
   - 超长(5000字以上)：写至少5000字

2. 关于Markdown语法（这是强制要求！）：
   如果用户选择"否"不使用Markdown语法：
   - 绝对禁止使用任何 # ## ### 等标题符号
   - 绝对禁止使用 * ** - 等列表和强调符号
   - 绝对禁止使用任何Markdown语法
   - 小标题直接用纯文字写，不加任何符号
   - 如果使用编号小标题，只用 1.1、1.2、2.1 这种数字格式

3. 关于标题格式（这是强制要求！）：
   - 文章大标题必须单独一行
   - 文章大标题必须居中对齐（在标题前后加适当空格使其看起来居中）
   - 小标题要加粗显示（如果不用Markdown，可以用书名号或直接突出）
   
4. 关于段落格式：
   - 每个段落开头必须空两格
   - 小标题和下面的段落之间不要有空行，直接衔接
   - 段落和段落之间空一行
   - 每段内容要写得非常详细充实，至少100字以上

5. 关于写作风格（重要！）：
   - 文章要写得连贯自然，段落之间要有逻辑衔接
   - 尽量少用生硬的连接词，如"然后"、"此外"、"另外"、"同时"等
   - 用更自然流畅的方式过渡，让读者感觉是一篇完整的文章而非拼凑的段落
   - 语言要优美流畅，避免机械式的罗列
"""),
            ("user", """请根据以上要求开始写作。
{user_instructions}
""")
        ])
        return prompt



    def run(self, system_prompt: str, user_instructions: str) -> str:
        prompt = self._build_prompt(system_prompt, user_instructions)
        chain = prompt | self.llm | self.output_parser
        return chain.invoke({
            "system_prompt": system_prompt,
            "user_instructions": user_instructions
        })

    def stream(self, system_prompt: str, user_instructions: str):
        """Yields content chunks for streaming output."""
        prompt = self._build_prompt(system_prompt, user_instructions)
        chain = prompt | self.llm | self.output_parser
        for chunk in chain.stream({
            "system_prompt": system_prompt,
            "user_instructions": user_instructions
        }):
            yield chunk
