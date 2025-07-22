# 开发规范和规则

- 生产环境后端服务启动修复：1) 修复了Electron主进程中backend.exe的路径验证和工作目录设置；2) 改进了PyInstaller配置，增加了必要的依赖和数据文件；3) 修改了backend/main.py以正确处理PyInstaller打包环境；4) 配置了同时生成安装包和便携版应用；5) 增强了错误处理和调试日志输出
- 便携版应用后端启动问题调试修复：1) 增加了详细的错误日志和进程监控；2) 延长了生产环境的启动超时时间到60秒；3) 调整了健康检查间隔；4) 改进了PyInstaller配置包含所有必要的backend模块；5) 在backend/main.py中增加了环境检测和模块导入测试；6) 创建了debug_backend.bat和test_backend_imports.py用于独立测试backend.exe
- 后端服务启动问题已解决：关键是虚拟环境中缺少uvicorn、httpx、pydantic-settings等依赖，以及代码中直接导入torch导致PyInstaller打包失败。修复方法：1) 安装缺失的依赖到虚拟环境；2) 将torch导入改为条件导入以避免打包时的硬依赖；3) backend.exe现在可以正常启动并运行API服务
