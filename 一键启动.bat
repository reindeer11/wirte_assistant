@echo off
chcp 65001 >nul
echo 正在启动写作助手...

:: 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python。请先安装 Python 3.10 或以上版本。
    pause
    exit
)

:: 检查虚拟环境是否存在
if not exist ".venv" (
    echo [初始化] 正在创建虚拟环境...
    python -m venv .venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败。
        pause
        exit
    )
)

:: 激活虚拟环境
call .venv\Scripts\activate.bat

:: 安装/更新依赖
echo [初始化] 正在检查依赖库...
pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 安装依赖失败。
    pause
    exit
)

:: 启动服务
echo.
echo [成功] 服务已准备就绪！
echo [提示] 正在打开浏览器...
start http://localhost:8000

echo [提示] 按 Ctrl+C 可以停止服务。
echo.
python main.py

pause
