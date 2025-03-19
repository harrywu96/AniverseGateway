# UV 依赖管理指南 - SubTranslate 项目

本文档详细介绍了在 SubTranslate 项目中使用 UV 进行 Python 依赖管理的方法和最佳实践。UV 是一个新型的 Python 包管理工具，它比传统的 pip 更快、更安全、更现代化。

## 为什么选择 UV

UV 相比传统的 pip 和 virtualenv 工具链有以下优势：

1. **执行速度快**：C 语言实现，比 pip 快 10-100 倍
2. **可靠的依赖解析**：精确的依赖解析算法，避免版本冲突
3. **原子化安装**：安装过程原子化，避免依赖安装中断导致的环境损坏
4. **更好的缓存机制**：智能缓存提高重复安装速度
5. **一体化工具**：集成了 venv、pip、pip-compile 等功能
6. **安全性更高**：更严格的依赖锁定和验证

## 安装 UV

在开始开发前，所有开发人员应先安装 UV：

### Windows

```powershell
# 使用 PowerShell 安装
curl.exe -sSf https://astral.sh/uv/install.ps1 | powershell
```

### macOS/Linux

```bash
# 使用 curl 安装
curl -sSf https://astral.sh/uv/install.sh | sh
```

### 验证安装

```bash
uv --version
```

## 项目环境设置

### 1. 创建虚拟环境

使用 UV 创建虚拟环境，而不是传统的 `python -m venv` 或 `virtualenv`：

```bash
# 在项目根目录执行
uv venv

# 激活环境
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 2. 安装依赖

使用 `uv pip sync` 而不是 `pip install -r requirements.txt`：

```bash
# 从 requirements.txt 安装依赖
uv pip sync requirements.txt

# 安装开发依赖
uv pip sync requirements.txt --extra=dev
```

## 依赖管理工作流

### 1. 添加新依赖

当需要添加新依赖时，**不要**直接修改 requirements.txt，而应该：

```bash
# 添加运行时依赖
uv pip add package_name

# 添加特定版本
uv pip add package_name==1.2.3

# 添加开发依赖
uv pip add --dev pytest black mypy
```

添加后，更新 requirements.txt：

```bash
# 生成/更新 requirements.txt（运行时依赖）
uv pip freeze > requirements.txt

# 确保开发依赖被标记为额外依赖
uv pip freeze --exclude-extras > requirements.txt
uv pip freeze --only-extras=dev >> requirements.txt
```

### 2. 锁定依赖版本

对于生产环境，我们应该锁定所有依赖的精确版本：

```bash
# 锁定所有依赖
uv pip compile pyproject.toml -o requirements.lock.txt
```

### 3. 更新依赖

定期更新依赖以获取安全补丁和新功能：

```bash
# 检查过时的依赖
uv pip list --outdated

# 更新单个包
uv pip add --upgrade package_name

# 更新所有依赖
uv pip sync requirements.txt --upgrade
```

## CI/CD 集成

在持续集成流程中使用 UV：

```yaml
# 示例 GitHub Actions 配置
setup:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-python@v4
      with:
        python-version: '3.10'
    - name: Install uv
      run: curl -sSf https://astral.sh/uv/install.sh | sh
    - name: Setup venv
      run: uv venv
    - name: Install dependencies
      run: |
        . .venv/bin/activate
        uv pip sync requirements.txt
```

## 多环境配置

针对不同环境创建不同的依赖文件：

```bash
# 开发环境
uv pip compile pyproject.toml --extra=dev -o requirements-dev.txt

# 测试环境
uv pip compile pyproject.toml --extra=test -o requirements-test.txt

# 生产环境
uv pip compile pyproject.toml -o requirements-prod.txt
```

## 依赖审查和安全检查

定期审查依赖的安全性：

```bash
# 使用 UV 与安全检查工具结合
uv pip freeze | safety check --stdin

# 或直接扫描已安装的包
uv pip list --json | python -c "import json, sys; print('\n'.join([f'{p[\"name\"]}=={p[\"version\"]}' for p in json.load(sys.stdin)]))" | safety check --stdin
```

## UV 项目环境共享

为确保团队成员使用相同的环境，推荐以下工作流：

1. 一位开发者使用 `uv pip compile` 生成锁定文件
2. 提交锁定文件到版本控制系统
3. 其他开发者使用 `uv pip sync` 安装精确相同的依赖

## 故障排除

### 常见问题与解决方案

1. **依赖解析冲突**

   ```bash
   # 查看详细的依赖关系
   uv pip list --tree
   
   # 尝试使用不同的依赖版本
   uv pip add package_name~=1.0.0
   ```

2. **虚拟环境问题**

   ```bash
   # 重新创建虚拟环境
   rm -rf .venv
   uv venv
   uv pip sync requirements.txt
   ```

3. **二进制包安装失败**

   ```bash
   # 为二进制包安装编译工具
   # Windows
   uv pip add --dev build tools-windows
   
   # Linux
   uv pip add --dev build tools-linux
   
   # 然后重试安装
   uv pip add package_with_binary
   ```

## UV 与项目生命周期

### 初始化项目

```bash
# 创建新项目
mkdir new_project && cd new_project

# 初始化 UV 环境
uv venv
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate  # Windows

# 添加基础依赖
uv pip add fastapi uvicorn pydantic

# 添加开发依赖
uv pip add --dev pytest black mypy ruff

# 生成初始依赖文件
uv pip freeze > requirements.txt
```

### 日常开发

```bash
# 激活环境
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate  # Windows

# 保持依赖更新
uv pip sync requirements.txt

# 添加新依赖时
uv pip add new_package
uv pip freeze > requirements.txt
```

### 发布准备

```bash
# 确保所有依赖都被锁定到确切版本
uv pip compile pyproject.toml -o requirements-lock.txt

# 验证锁定文件
uv pip sync requirements-lock.txt
pytest  # 运行测试确保一切正常
```

## 最佳实践总结

1. **始终使用 `uv pip sync` 而非 `pip install`**
2. **使用 `uv venv` 创建虚拟环境**
3. **依赖变更后立即更新 requirements.txt**
4. **提交锁定的依赖文件到版本控制系统**
5. **为不同环境维护不同的依赖文件**
6. **定期审查和更新依赖**
7. **使用 `--extra` 区分开发和生产依赖**
8. **避免全局安装包，始终在虚拟环境中工作**

---

遵循本指南将确保 SubTranslate 项目的依赖管理高效、安全且一致。如有问题请联系项目技术负责人。 