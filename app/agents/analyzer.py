from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI
from app.models import AnalyzeResponse
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

# Fallback: manually check if key is set, if not try to load from default locations
if not os.environ.get("SILICONFLOW_API_KEY"):
    load_dotenv()

class AnalyzerAgent:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="Qwen/Qwen2.5-72B-Instruct", 
            temperature=0.7,
            api_key=os.environ.get("SILICONFLOW_API_KEY"),
            base_url=os.environ.get("SILICONFLOW_BASE_URL")
        )
        
        self.parser = JsonOutputParser(pydantic_object=AnalyzeResponse)
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个写作助手的规划师。用户告诉你他想写什么，你要帮他规划好怎么写。

请输出以下JSON格式：
{{
    "persona": "写作角色（简单描述）",
    "article_type": "文章类型",
    "system_prompt": "给写作AI的详细指令（必须非常非常详细，按下面的格式写）",
    "content_outline": ["要写的第一部分", "要写的第二部分", ...],
    "writing_options": [...]
}}

【关于 writing_options 配置选项】

必须包含以下三个固定选项（每次都要有）：

1. 是否使用Markdown语法
{{
    "id": "use_markdown",
    "label": "是否使用Markdown语法",
    "type": "toggle",
    "default": "否"
}}

2. 文章长度
{{
    "id": "article_length",
    "label": "文章长度",
    "type": "select",
    "options": ["短文(500字左右)", "中等(1500字左右)", "长文(3000字以上)", "超长(5000字以上)"],
    "default": "中等(1500字左右)"
}}

3. 是否使用编号小标题（如1.1、2.1）
{{
    "id": "use_subheadings",
    "label": "是否使用编号小标题（如1.1、2.1）",
    "type": "toggle",
    "default": "是"
}}

除了上面三个固定选项，你必须额外生成2-3个与用户写作内容相关的自适应选项！这是强制要求！

自适应选项示例（根据不同主题生成不同选项）：
- 如果写技术文章：可以问"是否加入代码示例"、"技术讲解深度（入门/进阶/专家）"
- 如果写营销文案：可以问"是否加入促销信息"、"情感基调（理性/感性/煽动）"
- 如果写学术论文：可以问"引用格式（APA/MLA/Chicago）"、"是否需要数据图表"
- 如果写故事创作：可以问"叙事视角（第一人称/第三人称）"、"节奏风格（紧凑/舒缓）"
- 如果写分析报告：可以问"是否需要建议章节"、"分析深度（概要/详细）"

自适应选项要求：
1. 只用 select（多选一）或 toggle（是/否）两种类型
2. 选项文字要简单易懂，用日常用语
3. 必须与用户要写的具体内容相关，不能是通用选项

【关于 system_prompt 写作指令 - 这个必须非常详细！】

system_prompt 必须包含以下四个部分，每个部分都要写得非常详细、非常具体：

===== 角色设定 =====
详细描述写作者应该扮演的角色，包括：
- 这个角色的身份背景是什么
- 这个角色有什么专业知识和经验
- 这个角色的写作风格是怎样的
- 这个角色说话的方式和语气
至少写3-5句话来描述角色

===== 写作目标 =====
详细说明这篇文章要达成什么目的，包括：
- 文章的核心主题是什么
- 读者看完这篇文章应该获得什么
- 文章想传达的关键信息是什么
至少写2-3句话来说明目标

===== 文章要求 =====
非常详细地列出所有写作要求，包括但不限于：
1. 文章篇幅要尽可能长，内容要非常详细深入，每个观点都要充分展开论述
2. 每个小标题下面必须至少有2个段落，内容非常非常详细
3. 用自然段落来写，每个段落写得充实完整，段落之间逻辑清晰
4. 根据用户选择决定是否使用编号小标题（如1.1、1.2、2.1等格式）
5. 不要用项目符号（-、•）来罗列内容，用完整的句子和段落
6. 语言风格要求（根据文章类型决定）
7. 需要举例子、用数据、引用资料来支撑观点
8. 目标读者是谁，专业程度如何
列出至少5-8条具体要求

===== 输出格式（在 system_prompt 中必须强调这些格式规则！） =====
在生成的 system_prompt 中，务必包含以下强制格式要求：

1. 文章大标题必须居中显示（在标题前加空格使其居中）
2. 如果用户选择"否"不使用Markdown语法：
   - 禁止使用 # ## ### 等任何Markdown标题符号
   - 禁止使用 * ** _ - 等任何Markdown符号
   - 小标题只能用纯文字或数字编号（如 1.1、2.1）
3. 如果用户选择使用编号小标题，只能用 1.1、1.2、2.1 格式
4. 每个段落开头必须空两格（中文排版）
5. 段落之间空一行
6. 尽量少用小标题，内容充实详细
"""),
            ("user", """用户想写的内容: {topic}
参考资料: {file_content}

{format_instructions}
""")
        ])



        
        self.chain = self.prompt | self.llm | self.parser

    def run(self, topic: str, file_content: str = None) -> AnalyzeResponse:
        result = self.chain.invoke({
            "topic": topic,
            "file_content": file_content or "No additional file context provided.",
            "format_instructions": self.parser.get_format_instructions()
        })
        return AnalyzeResponse(**result)
