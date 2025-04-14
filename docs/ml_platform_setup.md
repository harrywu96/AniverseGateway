# 火山引擎机器学习平台SDK安装指南

本文档提供了如何安装和配置火山引擎机器学习平台SDK的详细说明。

## 安装SDK

由于火山引擎机器学习平台SDK没有发布到公共PyPI仓库，需要通过以下方式安装：

```bash
# 安装火山引擎核心SDK
pip install volc-sdk-python

# 下载并安装火山引擎机器学习平台SDK
wget https://ml-platform-public-examples-cn-beijing.tos-cn-beijing.volces.com/python_sdk_installer/volcengine_ml_platform-1.1.0b2-py3-none-any.whl
pip install volcengine_ml_platform-1.1.0b2-py3-none-any.whl
```

## 配置认证信息

在使用SDK前，需要配置火山引擎账号的AK/SK认证信息。有三种配置方式：

### 方法一：配置文件方式（推荐）

```bash
mkdir -p $HOME/.volc

cat <<EOF > $HOME/.volc/credentials
[default]
access_key_id     = <your access key>
secret_access_key = <your secret access key>
EOF

cat <<EOF > $HOME/.volc/config
[default]
region       = cn-beijing  # 目前仅支持cn-beijing区域
EOF
```

### 方法二：代码方式

```python
import volcengine_ml_platform as vemlp

vemlp.init(
    ak='<your access key>',
    sk='<your secret access key>',
    region='cn-beijing',
)
```

### 方法三：环境变量方式

```bash
export VOLC_ACCESSKEY='<your access key>'
export VOLC_SECRETKEY='<your secret access key>'
export VOLC_REGION='cn-beijing'
```

## 基本使用示例

### 工作流使用示例

```python
import os
from volcengine_ml_platform.pipeline import Pipeline

# 从YAML文件加载工作流定义
yaml_file_path = "workflow.yaml"
pipeline_name = "my_pipeline"

# 加载并创建工作流
pipeline = Pipeline.load(yaml_file_path, name=pipeline_name)
if not pipeline.exists():
    pipeline.create()

# 运行工作流
inputs = {"param1": "value1", "param2": "value2"}
pipeline_instance_id = pipeline.launch(inputs=inputs)
print(f"Pipeline Id: {pipeline.id}")
print(f"Pipeline Instance Id: {pipeline_instance_id}")
```

## 注意事项

1. 确保您的账号已开通火山引擎机器学习平台服务
2. 使用的AK/SK必须具有足够的权限
3. 在使用工作流功能时，确保已配置好相应的资源队列

更多详细信息，请参考[火山引擎官方文档](https://www.volcengine.com/docs/6459/1109787)。 