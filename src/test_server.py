"""测试FastAPI服务器

一个简单的FastAPI服务器，用于测试API功能是否正常。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="测试API", description="测试API服务器是否正常运行", version="0.1.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """根端点"""
    return {
        "success": True,
        "message": "API服务器运行正常",
        "data": {"service": "测试API", "version": "0.1.0"},
    }


@app.get("/api/health")
async def health():
    """健康检查端点"""
    return {
        "success": True,
        "message": "服务健康",
        "data": {"status": "healthy"},
    }


if __name__ == "__main__":
    print("启动测试API服务器...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
