# 火山引擎SDK配置指南

## 问题背景

在使用火山引擎SDK时，可能会遇到以下常见问题：

1. **包名错误**：正确的包名是`volcengine`，而不是`volc-sdk-python`
2. **pyproject.toml配置错误**：UV工具不支持`pip-compile-options`选项
3. **依赖解析失败**：无法找到指定版本的包

## 正确安装火山引擎SDK

### 方法一：使用UV工具安装（推荐）

```powershell
# 激活虚拟环境
.\.venv\Scripts\Activate.ps1

# 安装火山引擎SDK
uv pip install volcengine
```

### 方法二：使用pip安装

```powershell
# 激活虚拟环境
.\.venv\Scripts\Activate.ps1

# 安装火山引擎SDK
pip install volcengine
```

如果需要安装火山方舟大模型SDK，应使用：

```powershell
pip install 'volcengine-python-sdk[ark]'
```

## 配置环境变量

火山引擎SDK支持通过环境变量配置身份验证信息：

```powershell
# PowerShell 设置环境变量
$env:VOLC_ACCESSKEY = "您的AccessKey"
$env:VOLC_SECRETKEY = "您的SecretKey"
$env:VOLC_REGION = "cn-beijing"
```

## SDK初始化示例

```python
import os
from volcengine.auth.SignatureV4 import SignatureV4  # 基础SDK

# 初始化普通火山引擎SDK
service_info = {
    "host": "open.volcengineapi.com",
    "region": "cn-beijing",
    "service": "iam",
    "timeout": 10,
}
signature = SignatureV4(os.environ.get("VOLC_ACCESSKEY"), os.environ.get("VOLC_SECRETKEY"))
```

## 方舟大模型SDK初始化示例

```python
import os
from volcenginesdkarkruntime import Ark  # 方舟SDK

# 初始化方舟SDK (API Key方式)
client = Ark(
    api_key=os.environ.get("ARK_API_KEY"),
)

# 或者使用AK/SK方式
client = Ark(
    ak=os.environ.get("VOLC_ACCESSKEY"),
    sk=os.environ.get("VOLC_SECRETKEY"),
)
```

## 常见错误及解决方案

### 1. pyproject.toml中的UV配置错误

**错误信息**：
```
warning: Failed to parse `pyproject.toml` during settings discovery:
  TOML parse error at line 123, column 1
      |
  123 | pip-compile-options = ["--generate-hashes", "--allow-unsafe", "--quiet"]
      | ^^^^^^^^^^^^^^^^^^^
  unknown field `pip-compile-options`
```

**解决方案**：
修改`pyproject.toml`文件，删除或替换不支持的`pip-compile-options`选项：

```toml
[tool.uv]
# 删除 pip-compile-options 行
index-url = "https://pypi.org/simple/"
dependency-mode = "development"
cache-dir = "./.uv"
respect-active-env = true
```

### 2. 火山引擎SDK包名错误

**错误信息**：
```
No solution found when resolving dependencies:
Because volc-sdk-python was not found in the package registry and you require volc-sdk-python>=1.0.180, we can conclude that your requirements are unsatisfiable.
```

**解决方案**：
在`requirements.txt`文件中将包名从`volc-sdk-python`修改为`volcengine`：

```
# 错误
volc-sdk-python>=1.0.180

# 正确
volcengine>=1.0.180
```

## 自动修复脚本

为了方便解决上述问题，项目提供了自动修复脚本`check-environment.ps1`。运行此脚本可以自动检测并修复常见配置问题：

```powershell
.\check-environment.ps1
```

该脚本会：
1. 设置PowerShell执行策略
2. 检查并激活虚拟环境
3. 修复pyproject.toml中的UV配置问题
4. 修复requirements.txt中的火山引擎SDK包名
5. 同步项目依赖

## 参考链接

- [火山引擎SDK GitHub仓库](https://github.com/volcengine/volc-sdk-python)
- [火山方舟大模型服务平台SDK文档](https://www.volcengine.com/docs/82379/1319847)
- [UV工具官方文档](https://github.com/astral-sh/uv) 