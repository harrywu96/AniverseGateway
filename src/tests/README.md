# SubTranslate API测试文档

本目录包含用于测试SubTranslate API的测试脚本和工具。

## 测试脚本说明

- `api_test.py`: 基本API测试，检查核心接口功能
- `api_endpoints_test.py`: 全面API端点测试，覆盖所有API路由
- `run_api_tests.py`: 测试启动脚本，用于启动API服务器并运行测试

## 依赖安装

请确保已安装以下依赖项：

```bash
# 使用uv工具安装依赖
uv pip install requests websockets uvicorn httpx pytest

# 或使用传统pip
pip install requests websockets uvicorn httpx pytest
```

## 运行测试

### 使用测试启动脚本

测试启动脚本可以一键启动API服务器并运行测试：

```bash
# 在Windows上，需要临时更改执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 激活虚拟环境
# 使用uv
uv venv .venv
.venv\Scripts\activate 

# 运行全部测试
python src/tests/run_api_tests.py

# 仅运行简单API测试
python src/tests/run_api_tests.py --test-script simple

# 仅运行全面API测试
python src/tests/run_api_tests.py --test-script full

# 如果API服务器已经运行，可以跳过启动服务器步骤
python src/tests/run_api_tests.py --no-server
```

### 手动运行测试

如果你想要更细粒度的控制，可以手动启动API服务器和运行测试：

1. 启动API服务器：

```bash
# 在项目根目录运行
uvicorn src.subtranslate.api.app:app --reload
```

2. 在另一个终端窗口中运行测试：

```bash
# 在Windows上，需要临时更改执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 激活虚拟环境
# 使用uv
uv venv .venv
.venv\Scripts\activate 

# 运行基本API测试
python src/tests/api_test.py

# 运行全面API端点测试
python src/tests/api_endpoints_test.py
```

## 测试结果说明

测试结果会以彩色输出显示：

- 绿色：测试通过
- 红色：测试失败
- 黄色：测试跳过（通常是因为功能未实现或不适用）

测试结束后会显示测试结果汇总，包括通过、失败和跳过的测试数量。

## 自定义测试

如果需要对特定API进行定制化测试，可以修改现有测试脚本或创建新的测试脚本。测试框架设计为模块化的，可以轻松扩展。

每个测试函数遵循以下模式：

```python
def test_some_api():
    url = f"{API_BASE_URL}/api/some/endpoint"
    try:
        response = requests.get(url)  # 或 post, put, delete 等
        data = response.json()
        
        if response.status_code == 200 and data.get("success"):
            print_result("测试名称", "passed", "可选的成功消息")
            return True
        else:
            print_result("测试名称", "failed", f"状态码: {response.status_code}, 响应: {data}")
            return False
    except Exception as e:
        print_result("测试名称", "failed", f"异常: {str(e)}")
        return False
```

## 常见问题

1. **API服务器未启动**
   
   确保API服务器正在运行，可以尝试手动启动服务器检查是否有错误。

2. **缺少依赖项**
   
   确保已安装所有必要的依赖项。

3. **权限问题**
   
   在Windows上，可能需要临时更改执行策略：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   ```

4. **路径问题**
   
   确保在项目根目录下运行测试脚本，或者通过`sys.path`设置正确的导入路径。 