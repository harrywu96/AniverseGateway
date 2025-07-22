# 开发规范和规则

- 生产环境后端服务启动修复：1) 修复了Electron主进程中backend.exe的路径验证和工作目录设置；2) 改进了PyInstaller配置，增加了必要的依赖和数据文件；3) 修改了backend/main.py以正确处理PyInstaller打包环境；4) 配置了同时生成安装包和便携版应用；5) 增强了错误处理和调试日志输出
