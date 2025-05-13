# SubTranslate 实现计划：本地模型支持与字幕翻译功能

本文档详细描述了实现本地模型支持和字幕翻译功能的具体计划，包括需要修改的文件、添加的组件和实现步骤。

## 目标功能

1. **支持本地模型**
   - 支持通用本地模型服务
   - 支持Ollama模型服务
   - 在设置界面增加本地模型的配置和管理

2. **视频详情页字幕翻译功能**
   - 支持单行字幕翻译
   - 支持全文字幕翻译
   - 可选择使用本地模型、Ollama模型或自定义供应商的大语言模型
   - 利用已实现的字幕文本提取优化功能
   - 显示翻译前后的比对结果

## 系统架构

### 整体架构

本功能的系统架构采用前后端分离设计，主要包含以下几个核心部分：

1. **前端（Electron应用）**
   - 用户界面层：提供模型配置和字幕翻译界面
   - 数据管理层：管理本地配置和与后端的通信
   - 状态管理层：处理翻译状态和进度显示

2. **后端（Python FastAPI）**
   - API层：提供RESTful接口，处理前端请求
   - 服务层：实现模型服务和翻译逻辑
   - 数据层：管理配置和字幕数据

3. **模型服务**
   - 本地模型服务：支持GGUF格式的本地模型
   - Ollama服务：集成Ollama提供的模型服务
   - 自定义供应商：支持OpenAI兼容的API格式

### 数据流程

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Electron   │      │   FastAPI   │      │  AI 模型    │
│  前端界面   │◄────►│   后端服务  │◄────►│  服务       │
└─────────────┘      └─────────────┘      └─────────────┘
       ▲                    ▲                    ▲
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  本地配置   │      │  字幕数据   │      │  模型文件   │
│  存储       │      │  处理       │      │  管理       │
└─────────────┘      └─────────────┘      └─────────────┘
```

### 翻译流程

字幕翻译功能的处理流程如下：

1. **单行翻译流程**
   - 用户选择字幕行并点击翻译按钮
   - 前端发送翻译请求到后端API
   - 后端根据配置选择合适的AI服务
   - AI服务处理翻译请求并返回结果
   - 后端格式化翻译结果并返回给前端
   - 前端显示原文和译文的对比结果

2. **全文翻译流程**
   - 用户配置翻译参数并启动全文翻译
   - 后端创建异步翻译任务
   - 前端通过WebSocket监听翻译进度
   - 后端分批处理字幕文本，保持上下文一致性
   - 翻译完成后，更新字幕文件
   - 前端刷新显示翻译后的字幕内容

## 一、后端实现

### 1. 完善本地模型配置和服务

#### 1.1 更新 LocalModelConfig 类
- **文件路径**: `src/subtranslate/schemas/config.py`
- **修改内容**:
  - 完善 `LocalModelConfig` 类，添加对 GGUF 格式模型的支持
  - 添加模型路径、服务类型等配置项
  - 示例代码:
  ```python
  class LocalModelConfig(BaseAIConfig):
      """本地模型配置"""
      api_key: Optional[SecretStr] = Field(None, description="API密钥（可选）")
      base_url: str = Field(..., description="API基础URL")
      model: str = Field(default="default", description="使用的模型")
      model_path: Optional[str] = Field(None, description="模型文件路径")
      model_type: str = Field(default="gguf", description="模型类型")
      # 其他配置参数...
  ```

#### 1.2 实现 LocalModelService 类
- **文件路径**: `src/subtranslate/services/local_model_service.py`
- **实现内容**:
  - 创建新文件，实现与本地模型服务的通信
  - 支持 OpenAI 兼容的 API 格式
  - 处理模型加载和请求发送
  - 实现错误处理和重试机制
  - 示例代码:
  ```python
  class LocalModelService(AIService):
      """本地模型服务，用于与本地运行的模型服务通信"""

      def __init__(self, config: AIServiceConfig):
          super().__init__(config)
          if not config.local:
              raise ValueError("本地模型配置缺失")

          # 初始化配置...

      async def chat_completion(self, system_prompt: str, user_prompt: str, examples: Optional[List[Dict[str, str]]] = None) -> str:
          """发送聊天请求到本地模型服务"""
          # 实现与本地模型服务的通信逻辑
  ```

#### 1.3 实现 OllamaService 类
- **文件路径**: `src/subtranslate/services/ollama_service.py`
- **实现内容**:
  - 创建新文件，实现与Ollama服务的通信
  - 继承AIService抽象基类
  - 实现chat_completion和get_token_count方法
  - 支持与Ollama API的通信
  - 处理错误和重试机制
  - 示例代码:
  ```python
  class OllamaService(AIService):
      """Ollama服务实现，用于与本地运行的Ollama模型服务通信"""

      def __init__(self, config: AIServiceConfig):
          """初始化Ollama服务"""
          if not config.ollama:
              raise ValueError("Ollama配置缺失")

          # 初始化Ollama配置...

      async def chat_completion(
          self,
          system_prompt: str,
          user_prompt: str,
          examples: Optional[List[Dict[str, str]]] = None,
      ) -> str:
          """使用Ollama API发送聊天完成请求"""
          # 实现与Ollama API的通信逻辑
  ```

#### 1.4 更新 AIServiceFactory
- **文件路径**: `src/subtranslate/services/ai_service.py`
- **修改内容**:
  - 更新工厂方法，支持创建本地模型和Ollama服务实例
  - 示例代码:
  ```python
  elif provider_type == AIProviderType.LOCAL.value:
      from .local_model_service import LocalModelService
      return LocalModelService(config)
  elif provider_type == AIProviderType.OLLAMA.value:
      from .ollama_service import OllamaService
      return OllamaService(config)
  ```

### 2. 完善模型管理 API

#### 2.1 修改模型管理API，集成Ollama模型
- **文件路径**: `src/subtranslate/api/routers/models.py`
- **实现内容**:
  - 修改模型列表API，集成Ollama模型
  - 添加Ollama配置管理API
  - 示例代码:
  ```python
  @router.get("/models", response_model=ModelsResponse, tags=["模型管理"])
  async def get_models(
      config: SystemConfig = Depends(get_system_config),
  ):
      """获取所有可用模型列表，包括Ollama模型"""
      try:
          models = []

          # 获取Ollama模型列表（如果已配置）
          if config.ai_service.ollama:
              ollama_models = await _get_ollama_models(config.ai_service.ollama)
              models.extend(ollama_models)

          # 获取其他模型列表...

          return ModelsResponse(
              success=True,
              message="获取模型列表成功",
              data={"models": models}
          )
      except Exception as e:
          # 错误处理...
  ```

#### 2.2 创建请求和响应模型
- **文件路径**: `src/subtranslate/schemas/models.py`
- **实现内容**:
  - 添加模型相关的请求和响应模型
  - 添加Ollama配置请求模型
  - 示例代码:
  ```python
  class OllamaConfigRequest(BaseModel):
      """Ollama配置请求"""
      base_url: str = Field(..., description="Ollama服务基础URL")
      model: str = Field(..., description="要使用的模型名称")
      api_key: Optional[str] = Field(None, description="API密钥（可选）")

  class ModelInfo(BaseModel):
      """模型信息"""
      id: str = Field(..., description="模型ID")
      name: str = Field(..., description="模型名称")
      # 其他字段...
  ```

### 3. 完善翻译 API

#### 3.1 完善单行翻译 API
- **文件路径**: `src/subtranslate/api/routers/translate.py`
- **修改内容**:
  - 确保 `translate_line` 端点支持本地模型、Ollama模型和自定义供应商
  - 添加对翻译前后比对的支持
  - 添加提供商和模型解析逻辑
  - 示例代码:
  ```python
  @router.post("/line", response_model=TranslateResponse, tags=["实时翻译"])
  async def translate_line(
      request: LineTranslateRequest,
      config: SystemConfig = Depends(get_system_config),
      translator: SubtitleTranslator = Depends(get_subtitle_translator),
  ):
      """翻译单行字幕"""
      try:
          # 获取翻译配置
          translation_config = TranslationConfig(
              style=request.style,
              source_language=request.source_language,
              target_language=request.target_language,
              # 其他配置...
          )

          # 解析提供商和模型
          provider, model = parse_provider_and_model(request.provider, request.model)

          # 执行翻译
          result = await translator.translate_text(
              text=request.text,
              config=translation_config,
              provider=provider,
              model=model,
          )

          # 返回结果，包含原文和译文
          return TranslateResponse(
              success=True,
              message="翻译成功",
              data={
                  "original": request.text,
                  "translated": result,
                  "provider": request.provider,
                  "model": request.model,
              },
          )
      except Exception as e:
          # 错误处理...
  ```

#### 3.2 实现字幕片段翻译 API
- **文件路径**: `src/subtranslate/api/routers/translate.py`
- **修改内容**:
  - 完成 `translate_section` 端点的实现
  - 支持翻译一组连续的字幕行，保持上下文一致性
  - 示例代码:
  ```python
  @router.post("/section", response_model=TranslateResponse, tags=["实时翻译"])
  async def translate_section(
      request: SectionTranslateRequest,
      config: SystemConfig = Depends(get_system_config),
      translator: SubtitleTranslator = Depends(get_subtitle_translator),
  ):
      """翻译字幕片段"""
      try:
          # 获取翻译配置
          translation_config = TranslationConfig(
              style=request.style,
              source_language=request.source_language,
              target_language=request.target_language,
              # 其他配置...
          )

          # 解析提供商和模型
          provider, model = parse_provider_and_model(request.provider, request.model)

          # 执行翻译
          results = await translator.translate_section(
              lines=request.lines,
              config=translation_config,
              provider=provider,
              model=model,
          )

          # 返回结果
          return TranslateResponse(
              success=True,
              message="翻译成功",
              data={
                  "original": request.lines,
                  "translated": results,
                  "provider": request.provider,
                  "model": request.model,
              },
          )
      except Exception as e:
          # 错误处理...
  ```

#### 3.3 更新翻译服务，支持Ollama模型
- **文件路径**: `src/subtranslate/services/translator.py`
- **修改内容**:
  - 添加Ollama专用的翻译模板
  - 优化翻译提示模板，适应Ollama模型的特点
  - 增强翻译结果解析逻辑，处理不同输出格式
  - 示例代码:
  ```python
  # 在TranslationTemplate类中添加Ollama专用的翻译模板
  OLLAMA_TRANSLATION_TEMPLATE = TranslationTemplate(
      id="ollama_translation",
      name="Ollama翻译模板",
      description="针对Ollama模型优化的翻译模板",
      system_prompt_template=(
          "你是一个专业的翻译助手，擅长将{source_language}翻译成{target_language}。"
          "请按照以下要求进行翻译：\n"
          "1. 保持原文的意思和风格\n"
          "2. 翻译要自然流畅，符合目标语言的表达习惯\n"
          # 其他指令...
      ),
      # 其他模板配置...
  )
  ```

## 二、前端实现

### 1. 更新设置界面，添加本地模型和Ollama支持

#### 1.1 更新提供商列表，添加本地模型和Ollama选项
- **文件路径**: `src/packages/electron-app/src/components/ProviderList.tsx`
- **修改内容**:
  - 添加本地模型和Ollama图标和描述
  - 确保本地模型和Ollama显示在提供商列表中
  - 示例代码:
  ```tsx
  // 在 getProviderList 函数中添加本地模型和Ollama
  function getProviderList() {
    const providersData = loadProviders();
    const providers = [];

    // 添加硬基流动提供商
    providers.push({
      id: 'siliconflow',
      name: 'SiliconFlow',
      is_active: providersData.active_provider === 'siliconflow',
      is_configured: true,
      model_count: 0
    });

    // 添加本地模型提供商
    providers.push({
      id: 'local',
      name: '本地模型',
      is_active: providersData.active_provider === 'local',
      is_configured: true,
      model_count: providersData.local_models ? providersData.local_models.length : 0
    });

    // 添加Ollama提供商
    providers.push({
      id: 'ollama',
      name: 'Ollama',
      is_active: providersData.active_provider === 'ollama',
      is_configured: providersData.ollama_config !== undefined,
      model_count: providersData.ollama_models ? providersData.ollama_models.length : 0
    });

    // 添加自定义提供商...

    return {
      providers,
      current_provider: providersData.active_provider
    };
  }
  ```

#### 1.2 创建本地模型配置对话框
- **文件路径**: `src/packages/electron-app/src/components/LocalModelDialog.tsx`
- **实现内容**:
  - 创建新组件，允许用户配置本地模型
  - 提供模型路径选择和服务地址配置
  - 添加模型测试功能
  - 示例代码:
  ```tsx
  import React, { useState, useEffect } from 'react';
  import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    Alert,
    CircularProgress,
  } from '@mui/material';
  import { testLocalModel, saveLocalModel } from '../services/api';

  interface LocalModelDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    editModel?: any;
  }

  const LocalModelDialog: React.FC<LocalModelDialogProps> = ({
    open,
    onClose,
    onSave,
    editModel
  }) => {
    // 状态管理
    const [name, setName] = useState('');
    const [modelPath, setModelPath] = useState('');
    const [serviceUrl, setServiceUrl] = useState('http://localhost:8080');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [testResult, setTestResult] = useState<any>(null);

    // 生命周期和事件处理函数...

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{editModel ? `编辑本地模型: ${editModel.name}` : '添加本地模型'}</DialogTitle>
        <DialogContent>
          {/* 错误和成功提示 */}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {testResult && <Alert severity="success" sx={{ mb: 2 }}>连接测试成功！模型可用。</Alert>}

          {/* 表单内容 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>基本信息</Typography>
          <Box sx={{ mb: 3 }}>
            {/* 模型名称输入框 */}
            <TextField
              fullWidth
              margin="normal"
              label="模型名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            {/* 模型路径选择 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <TextField
                fullWidth
                margin="normal"
                label="模型文件路径"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                sx={{ mr: 1 }}
              />
              <Button variant="outlined" onClick={handleSelectModelFile} sx={{ mt: 2, height: 56 }}>
                浏览...
              </Button>
            </Box>

            {/* 服务地址输入框 */}
            <TextField
              fullWidth
              margin="normal"
              label="服务地址"
              value={serviceUrl}
              onChange={(e) => setServiceUrl(e.target.value)}
              placeholder="例如: http://localhost:8080"
              required
            />

            {/* 测试连接按钮 */}
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleTestConnection}
                disabled={loading || !serviceUrl}
              >
                {loading ? <CircularProgress size={24} /> : '测试连接'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={loading || !name || !serviceUrl}
          >
            {loading ? <CircularProgress size={24} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  export default LocalModelDialog;
  ```

#### 1.3 创建Ollama配置对话框
- **文件路径**: `src/packages/electron-app/src/components/OllamaDialog.tsx`
- **实现内容**:
  - 创建新组件，允许用户配置Ollama服务
  - 提供模型选择和服务地址配置
  - 使用后端API进行配置管理
  - 示例代码:
  ```tsx
  import React, { useState, useEffect } from 'react';
  import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Alert,
    CircularProgress,
  } from '@mui/material';
  import { getOllamaConfig, saveOllamaConfig, getAllModels } from '../services/api';

  interface OllamaDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    initialConfig?: any;
  }

  const OllamaDialog: React.FC<OllamaDialogProps> = ({
    open,
    onClose,
    onSave,
    initialConfig = {}
  }) => {
    // 状态管理
    const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
    const [selectedModel, setSelectedModel] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modelLoading, setModelLoading] = useState(false);
    const [error, setError] = useState('');
    const [testResult, setTestResult] = useState<any>(null);

    // 生命周期和事件处理函数...

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>配置Ollama服务</DialogTitle>
        <DialogContent>
          {/* 错误和成功提示 */}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {testResult && <Alert severity="success" sx={{ mb: 2 }}>连接测试成功！Ollama服务可用。</Alert>}

          {/* 服务配置部分 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>服务配置</Typography>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              margin="normal"
              label="服务地址"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如: http://localhost:11434"
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="API密钥（可选）"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
            />
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleTestConnection}
                disabled={loading || !baseUrl}
              >
                {loading ? <CircularProgress size={24} /> : '测试连接'}
              </Button>
            </Box>
          </Box>

          {/* 模型选择部分 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>模型选择</Typography>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="model-select-label">选择模型</InputLabel>
              <Select
                labelId="model-select-label"
                value={selectedModel}
                label="选择模型"
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={modelLoading || models.length === 0}
              >
                {models.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              注意：Ollama模型需要预先在本地安装并启动Ollama服务。
              请访问 <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">Ollama官网</a> 了解更多信息。
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={loading || !baseUrl || !selectedModel}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  export default OllamaDialog;
  ```

#### 1.4 更新设置页面，集成本地模型和Ollama配置
- **文件路径**: `src/packages/electron-app/src/pages/Settings.tsx`
- **修改内容**:
  - 添加本地模型和Ollama配置选项
  - 集成本地模型和Ollama对话框
  - 示例代码:
  ```tsx
  // 导入本地模型和Ollama对话框
  import LocalModelDialog from '../components/LocalModelDialog';
  import OllamaDialog from '../components/OllamaDialog';

  // 在组件中添加状态
  const [localModelDialogOpen, setLocalModelDialogOpen] = useState(false);
  const [localModelToEdit, setLocalModelToEdit] = useState(null);
  const [localModels, setLocalModels] = useState([]);
  const [ollamaDialogOpen, setOllamaDialogOpen] = useState(false);
  const [ollamaConfig, setOllamaConfig] = useState(null);

  // 处理函数和API调用...

  // 在界面中添加本地模型配置部分
  {selectedProvider === 'local' && (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>本地模型配置</Typography>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAddLocalModel}
        sx={{ mb: 2 }}
      >
        添加本地模型
      </Button>

      {/* 本地模型列表 */}
      <List>
        {localModels.map((model) => (
          <ListItem
            key={model.id}
            secondaryAction={
              <IconButton edge="end" onClick={() => handleEditLocalModel(model)}>
                <EditIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={model.name}
              secondary={`路径: ${model.path || '未指定'}`}
            />
          </ListItem>
        ))}
      </List>

      {/* 本地模型对话框 */}
      <LocalModelDialog
        open={localModelDialogOpen}
        onClose={() => setLocalModelDialogOpen(false)}
        onSave={handleSaveLocalModel}
        editModel={localModelToEdit}
      />
    </Box>
  )}

  {/* Ollama配置部分 */}
  {selectedProvider === 'ollama' && (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Ollama配置</Typography>

      {ollamaConfig ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">当前配置</Typography>
          <Typography variant="body2">服务地址: {ollamaConfig.base_url}</Typography>
          <Typography variant="body2">模型: {ollamaConfig.model}</Typography>
          <Typography variant="body2">API密钥: {ollamaConfig.api_key ? '已设置' : '未设置'}</Typography>

          <Button variant="outlined" onClick={handleOpenOllamaDialog} sx={{ mt: 2 }}>
            修改配置
          </Button>
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            尚未配置Ollama服务。Ollama是一个本地运行的大语言模型服务，可以在没有互联网连接的情况下使用。
          </Typography>

          <Button variant="contained" onClick={handleOpenOllamaDialog}>
            配置Ollama
          </Button>
        </Box>
      )}

      {/* Ollama对话框 */}
      <OllamaDialog
        open={ollamaDialogOpen}
        onClose={() => setOllamaDialogOpen(false)}
        onSave={handleSaveOllamaConfig}
        initialConfig={ollamaConfig}
      />
    </Box>
  )}
  ```

### 2. 更新视频详情页，添加翻译功能

#### 2.1 创建翻译配置组件
- **文件路径**: `src/packages/electron-app/src/components/TranslationConfig.tsx`
- **实现内容**:
  - 创建新组件，用于配置翻译参数
  - 支持选择翻译提供商、模型、语言等
  - 示例代码:
  ```tsx
  import React, { useState, useEffect } from 'react';
  import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Paper,
    SelectChangeEvent,
  } from '@mui/material';
  import { getProviders, getProviderModels } from '../services/api';
  import { LANGUAGE_OPTIONS, TRANSLATION_STYLES } from '@subtranslate/shared';

  interface TranslationConfigProps {
    onChange: (config: any) => void;
    defaultConfig?: any;
  }

  const TranslationConfig: React.FC<TranslationConfigProps> = ({
    onChange,
    defaultConfig = {}
  }) => {
    // 状态
    const [providers, setProviders] = useState<any[]>([]);
    const [selectedProvider, setSelectedProvider] = useState(defaultConfig.provider || 'siliconflow');
    const [models, setModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState(defaultConfig.model || '');
    const [sourceLanguage, setSourceLanguage] = useState(defaultConfig.sourceLanguage || 'en');
    const [targetLanguage, setTargetLanguage] = useState(defaultConfig.targetLanguage || 'zh');
    const [style, setStyle] = useState(defaultConfig.style || 'natural');
    const [loading, setLoading] = useState(false);

    // 生命周期和事件处理函数...

    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>翻译配置</Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 提供商选择 */}
          <FormControl fullWidth>
            <InputLabel id="provider-label">翻译提供商</InputLabel>
            <Select
              labelId="provider-label"
              value={selectedProvider}
              label="翻译提供商"
              onChange={handleProviderChange}
              disabled={loading}
            >
              {providers.map((provider) => (
                <MenuItem key={provider.id} value={provider.id}>
                  {provider.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 模型选择 */}
          <FormControl fullWidth>
            <InputLabel id="model-label">翻译模型</InputLabel>
            <Select
              labelId="model-label"
              value={selectedModel}
              label="翻译模型"
              onChange={handleModelChange}
              disabled={loading || models.length === 0}
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 语言选择 */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="source-language-label">源语言</InputLabel>
              <Select
                labelId="source-language-label"
                value={sourceLanguage}
                label="源语言"
                onChange={handleSourceLanguageChange}
              >
                {/* 语言选项 */}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="target-language-label">目标语言</InputLabel>
              <Select
                labelId="target-language-label"
                value={targetLanguage}
                label="目标语言"
                onChange={handleTargetLanguageChange}
              >
                {/* 语言选项 */}
              </Select>
            </FormControl>
          </Box>

          {/* 翻译风格 */}
          <FormControl fullWidth>
            <InputLabel id="style-label">翻译风格</InputLabel>
            <Select
              labelId="style-label"
              value={style}
              label="翻译风格"
              onChange={handleStyleChange}
            >
              {/* 风格选项 */}
            </Select>
          </FormControl>
        </Box>
      </Paper>
    );
  };

  export default TranslationConfig;
  ```

#### 2.2 更新字幕编辑器，添加单行翻译功能
- **文件路径**: `src/packages/electron-app/src/components/SubtitleEditor.tsx`
- **修改内容**:
  - 添加翻译按钮和结果显示
  - 实现单行翻译功能
  - 示例代码:
  ```tsx
  // 导入必要的组件和API
  import { translateSubtitleLine } from '../services/api';

  // 在 SubtitleItem 接口中添加翻译相关字段
  export interface SubtitleItem {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    translated?: string; // 添加翻译结果字段
    translating?: boolean; // 添加翻译中状态字段
  }

  // 在组件 props 中添加翻译相关属性
  interface SubtitleEditorProps {
    subtitles: SubtitleItem[];
    currentTime: number;
    loading: boolean;
    error: string | null;
    onSave: (subtitle: SubtitleItem) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onTranslate?: (id: string, config: any) => Promise<void>; // 添加翻译回调
    translationConfig?: any; // 添加翻译配置
  }

  // 在组件中添加翻译功能
  const handleTranslate = async (subtitle: SubtitleItem) => {
    if (!translationConfig || !onTranslate) return;

    try {
      // 更新字幕状态为翻译中
      const updatedSubtitle = { ...subtitle, translating: true };
      setEditingSubtitle(updatedSubtitle);

      // 调用翻译API
      await onTranslate(subtitle.id, translationConfig);

      // 更新编辑状态
      setEditingSubtitle(null);
    } catch (error) {
      console.error('翻译失败:', error);
      // 恢复原始状态
      setEditingSubtitle({ ...subtitle, translating: false });
    }
  };

  // 在字幕项渲染中添加翻译按钮和结果显示
  <ListItem
    key={subtitle.id}
    selected={isSelected}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      p: 1,
      borderBottom: '1px solid #eee',
      bgcolor: isSelected ? 'action.selected' : 'background.paper',
    }}
  >
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
      </Typography>
      <Box>
        {isEditing ? (
          <>
            <IconButton size="small" onClick={() => handleSave(subtitle)} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : <SaveIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={() => setEditingSubtitle(null)}>
              <CancelIcon fontSize="small" />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton size="small" onClick={() => setEditingSubtitle(subtitle)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleDelete(subtitle.id)} disabled={deleting}>
              {deleting ? <CircularProgress size={20} /> : <DeleteIcon fontSize="small" />}
            </IconButton>
            {/* 添加翻译按钮 */}
            {onTranslate && (
              <IconButton
                size="small"
                onClick={() => handleTranslate(subtitle)}
                disabled={subtitle.translating}
                color={subtitle.translated ? "primary" : "default"}
              >
                {subtitle.translating ? <CircularProgress size={20} /> : <TranslateIcon fontSize="small" />}
              </IconButton>
            )}
          </>
        )}
      </Box>
    </Box>

    {isEditing ? (
      <TextField
        fullWidth
        multiline
        value={subtitle.text}
        onChange={(e) => handleTextChange(e.target.value)}
        variant="outlined"
        size="small"
      />
    ) : (
      <>
        <Typography variant="body2" sx={{ width: '100%', whiteSpace: 'pre-wrap' }}>
          {subtitle.text}
        </Typography>

        {/* 显示翻译结果 */}
        {subtitle.translated && (
          <Box sx={{
            width: '100%',
            mt: 1,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
            borderLeft: '3px solid #1976d2'
          }}>
            <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              翻译:
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {subtitle.translated}
            </Typography>
          </Box>
        )}
      </>
    )}
  </ListItem>
  ```

#### 2.3 更新视频详情页，添加翻译功能
- **文件路径**: `src/packages/electron-app/src/pages/VideoDetail.tsx`
- **修改内容**:
  - 添加翻译配置组件
  - 实现单行翻译和全文翻译功能
  - 示例代码:
  ```tsx
  // 导入必要的组件和API
  import TranslationConfig from '../components/TranslationConfig';
  import { translateSubtitleLine, translateSubtitleFile } from '../services/api';
  import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

  // 在组件中添加状态
  const [translationConfig, setTranslationConfig] = useState<any>({
    provider: 'siliconflow',
    model: '',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    style: 'natural'
  });
  const [translationDialogOpen, setTranslationDialogOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);

  // 处理翻译配置变化
  const handleTranslationConfigChange = (config: any) => {
    setTranslationConfig(config);
  };

  // 处理单行翻译
  const handleTranslateLine = async (id: string, config: any) => {
    try {
      if (!video || !selectedTrack) return;

      // 查找要翻译的字幕
      const subtitle = subtitles.find(s => s.id === id);
      if (!subtitle) return;

      // 准备翻译请求
      const request = {
        text: subtitle.text,
        provider: config.provider,
        model: config.model,
        source_language: config.sourceLanguage,
        target_language: config.targetLanguage,
        style: config.style,
        preserve_formatting: true,
        context_preservation: true
      };

      // 调用翻译API
      const response = await translateSubtitleLine(request);

      if (response.success && response.data) {
        // 更新字幕列表
        setSubtitles(prev =>
          prev.map(item =>
            item.id === id
              ? { ...item, translated: response.data.translated, translating: false }
              : item
          )
        );
      } else {
        throw new Error(response.message || '翻译失败');
      }
    } catch (error) {
      console.error('翻译字幕失败:', error);
      // 更新字幕状态
      setSubtitles(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, translating: false }
            : item
        )
      );
      // 显示错误消息
      alert('翻译失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 处理全文翻译
  const handleTranslateAll = async () => {
    try {
      if (!video || !selectedTrack) return;

      setTranslating(true);
      setTranslationProgress(0);

      // 获取视频ID和轨道索引
      const videoId = (video as any).backendId || video.id;
      let trackIndex = 0;

      // 如果轨道有backendIndex属性，直接使用
      if ((selectedTrack as any).backendIndex !== undefined) {
        trackIndex = (selectedTrack as any).backendIndex;
      } else {
        // 否则尝试将轨道ID转换为数字
        try {
          const parsedIndex = parseInt(selectedTrack.id);
          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            trackIndex = parsedIndex;
          }
        } catch (e) {
          console.warn('轨道ID转换为索引失败，使用默认值0:', e);
        }
      }

      // 准备翻译请求
      const request = {
        video_id: videoId,
        track_index: trackIndex,
        provider: translationConfig.provider,
        model: translationConfig.model,
        source_language: translationConfig.sourceLanguage,
        target_language: translationConfig.targetLanguage,
        style: translationConfig.style,
        preserve_formatting: true,
        context_preservation: true
      };

      // 调用翻译API
      const response = await translateSubtitleFile(request);

      if (response.success && response.data) {
        // 获取任务ID
        const taskId = response.data.task_id;

        // 监听翻译进度
        const socket = new WebSocket(`ws://localhost:8000/api/ws/tasks/${taskId}`);

        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'progress') {
            setTranslationProgress(data.progress * 100);
          } else if (data.type === 'completed') {
            // 翻译完成，刷新字幕
            loadSubtitleContent(videoId, selectedTrack.id);
            setTranslating(false);
            setTranslationDialogOpen(false);
            socket.close();
          } else if (data.type === 'failed') {
            throw new Error(data.message || '翻译失败');
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket错误:', error);
          setTranslating(false);
          alert('翻译进度监听失败');
        };
      } else {
        throw new Error(response.message || '翻译任务创建失败');
      }
    } catch (error) {
      console.error('翻译全部字幕失败:', error);
      setTranslating(false);
      alert('翻译失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 添加翻译对话框
  const renderTranslationDialog = () => (
    <Dialog
      open={translationDialogOpen}
      onClose={() => !translating && setTranslationDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>翻译配置</DialogTitle>
      <DialogContent>
        <TranslationConfig
          onChange={handleTranslationConfigChange}
          defaultConfig={translationConfig}
        />

        {translating && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              翻译进度: {Math.round(translationProgress)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={translationProgress}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => setTranslationDialogOpen(false)}
          disabled={translating}
        >
          取消
        </Button>
        <Button
          onClick={handleTranslateAll}
          variant="contained"
          color="primary"
          disabled={translating || !translationConfig.model}
        >
          {translating ? '翻译中...' : '开始翻译'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // 在字幕编辑区域添加翻译按钮
  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
    <Button
      variant="outlined"
      color="primary"
      disabled={!selectedTrack}
      onClick={() => {
        if (video && selectedTrack) {
          const videoId = (video as any).backendId || video.id;
          loadSubtitleContent(videoId, selectedTrack.id);
        }
      }}
      startIcon={loading ? <CircularProgress size={20} /> : null}
    >
      刷新字幕
    </Button>

    <Box>
      <Button
        variant="outlined"
        color="secondary"
        disabled={!selectedTrack}
        sx={{ mr: 1 }}
      >
        导出字幕
      </Button>

      <Button
        variant="outlined"
        color="primary"
        disabled={!selectedTrack}
        onClick={() => setTranslationDialogOpen(true)}
        startIcon={<TranslateIcon />}
        sx={{ mr: 1 }}
      >
        翻译字幕
      </Button>

      <Button
        variant="contained"
        color="primary"
        disabled={!selectedTrack}
        onClick={async () => {
          try {
            if (!video || !selectedTrack) return;

            // 尝试调用后端 API 保存所有字幕
            const apiPort = '8000';
            const videoId = (video as any).backendId || video.id;
            // 使用轨道的后端索引
            let trackIndex = 0;

            // 如果轨道有backendIndex属性，直接使用
            if ((selectedTrack as any).backendIndex !== undefined) {
              trackIndex = (selectedTrack as any).backendIndex;
              console.log('使用轨道的backendIndex:', trackIndex);
            } else {
              // 否则尝试将轨道ID转换为数字
              try {
                const parsedIndex = parseInt(selectedTrack.id);
                if (!isNaN(parsedIndex) && parsedIndex >= 0) {
                  trackIndex = parsedIndex;
                }
              } catch (e) {
                console.warn('轨道ID转换为索引失败，使用默认值0:', e);
              }
            }

            const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/save`;

            const response = await fetch(url, {
              method: 'POST'
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                alert('字幕保存成功');
                return;
              }
            }

            // 如果 API 调用失败，显示模拟成功消息
            console.warn('调用保存字幕API失败，显示模拟成功消息');
            alert('字幕保存成功');
          } catch (error) {
            console.error('保存字幕失败:', error);
            alert('字幕保存失败，请重试');
          }
        }}
      >
        保存所有修改
      </Button>
    </Box>
  </Box>

  {/* 渲染翻译对话框 */}
  {renderTranslationDialog()}
  ```

### 3. 更新API服务

#### 3.1 添加翻译和模型管理API调用方法
- **文件路径**: `src/packages/electron-app/src/services/api.ts`
- **修改内容**:
  - 添加单行翻译和全文翻译的API调用方法
  - 添加本地模型和Ollama模型管理API调用方法
  - 示例代码:
  ```tsx
  /**
   * 获取所有模型列表
   */
  export async function getAllModels() {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/models`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取模型列表失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        data: { models: [] }
      };
    }
  }

  /**
   * 获取本地模型列表
   */
  export async function getLocalModels() {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/models/local`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取本地模型列表失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('获取本地模型列表失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        data: { models: [] }
      };
    }
  }

  /**
   * 测试本地模型连接
   */
  export async function testLocalModel(serviceUrl: string, modelName?: string) {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/models/local/test`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_url: serviceUrl,
          model: modelName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`测试本地模型连接失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('测试本地模型连接失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 保存本地模型配置
   */
  export async function saveLocalModel(modelConfig: any) {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/models/local`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelConfig)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`保存本地模型配置失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('保存本地模型配置失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取Ollama配置
   */
  export async function getOllamaConfig() {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/config/ollama`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取Ollama配置失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('获取Ollama配置失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误',
        data: null
      };
    }
  }

  /**
   * 保存Ollama配置
   */
  export async function saveOllamaConfig(config: any) {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/config/ollama`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`保存Ollama配置失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('保存Ollama配置失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 翻译单行字幕
   */
  export async function translateSubtitleLine(request: any) {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/translate/line`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`翻译失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('翻译单行字幕失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 翻译字幕文件
   */
  export async function translateSubtitleFile(request: any) {
    try {
      const apiPort = '8000';
      const url = `http://localhost:${apiPort}/api/translate/file`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`翻译失败 (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('翻译字幕文件失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      };
    }
  }
  ```

## 三、实施计划

### 1. 任务分解与依赖关系

#### 1.1 后端实现

| 任务ID | 任务描述 | 依赖任务 | 优先级 |
|--------|----------|----------|--------|
| B1 | 更新 `src/subtranslate/schemas/config.py`，完善 `LocalModelConfig` 类 | 无 | 高 |
| B2 | 创建 `src/subtranslate/services/local_model_service.py` | B1 | 高 |
| B3 | 创建 `src/subtranslate/services/ollama_service.py` | B1 | 高 |
| B4 | 更新 `src/subtranslate/services/ai_service.py` | B2, B3 | 高 |
| B5 | 创建 `src/subtranslate/schemas/models.py` | 无 | 中 |
| B6 | 更新 `src/subtranslate/api/routers/models.py` | B4, B5 | 中 |
| B7 | 添加 `src/subtranslate/api/routers/config.py` | B1 | 中 |
| B8 | 更新 `src/subtranslate/services/translator.py` | B4 | 高 |
| B9 | 更新 `src/subtranslate/api/routers/translate.py` | B8 | 高 |
| B10 | 实现API密钥管理，参考现有项目配置方法 | B1, B7 | 高 |
| B11 | 实现错误处理和日志记录机制 | B2, B3, B4, B8, B9 | 高 |
| B12 | 实现性能监控和优化 | B8, B9 | 中 |

#### 1.2 前端实现

| 任务ID | 任务描述 | 依赖任务 | 优先级 |
|--------|----------|----------|--------|
| F1 | 更新 `src/packages/electron-app/src/services/api.ts` | B6, B7, B9 | 高 |
| F2 | 创建 `src/packages/electron-app/src/components/LocalModelDialog.tsx` | F1 | 高 |
| F3 | 创建 `src/packages/electron-app/src/components/OllamaDialog.tsx` | F1 | 高 |
| F4 | 更新 `src/packages/electron-app/src/components/ProviderList.tsx` | F1 | 中 |
| F5 | 更新 `src/packages/electron-app/src/pages/Settings.tsx` | F2, F3, F4 | 中 |
| F6 | 创建 `src/packages/electron-app/src/components/TranslationConfig.tsx` | F1 | 高 |
| F7 | 更新 `src/packages/electron-app/src/components/SubtitleEditor.tsx` | F6 | 高 |
| F8 | 更新 `src/packages/electron-app/src/pages/VideoDetail.tsx` | F6, F7 | 高 |
| F9 | 实现API密钥管理UI，参考现有项目实现 | F2, F3, F5 | 高 |
| F10 | 优化用户体验，添加加载状态和错误反馈 | F7, F8 | 高 |
| F11 | 实现离线模式和网络错误处理 | F1, F8 | 中 |

#### 1.3 测试与优化

| 任务ID | 任务描述 | 依赖任务 | 优先级 |
|--------|----------|----------|--------|
| T1 | 测试本地模型配置和连接 | B2, F2, F5 | 高 |
| T2 | 测试Ollama服务配置和连接 | B3, F3, F5 | 高 |
| T3 | 测试模型列表API | B6, F1 | 中 |
| T4 | 测试单行字幕翻译功能 | B9, F7 | 高 |
| T5 | 测试全文字幕翻译功能 | B9, F8 | 高 |
| T6 | 测试翻译结果显示和比对 | F7, F8 | 中 |
| T7 | 测试与自定义供应商的集成 | B4, F1 | 低 |
| T8 | 测试配置持久化 | F5 | 中 |
| T9 | 性能优化与问题修复 | 所有测试 | 高 |
| T10 | API密钥管理测试（参考现有项目实现） | B10, F9 | 高 |
| T11 | 用户体验测试（响应性、错误反馈等） | F10 | 中 |
| T12 | 网络异常和离线模式测试 | F11 | 中 |

#### 1.4 文档与部署

| 任务ID | 任务描述 | 依赖任务 | 优先级 |
|--------|----------|----------|--------|
| D1 | 更新用户文档（包括安装指南、使用手册、故障排除） | 所有实现 | 中 |
| D2 | 更新开发文档（包括API文档、架构说明、扩展指南） | 所有实现 | 中 |
| D3 | 制定部署包准备计划（待应用完全开发后实施） | T9 | 低 |
| D4 | 最终验收测试 | 所有实现 | 高 |

### 2. 里程碑

1. **M1: 后端基础架构完成**
   - 完成所有后端组件的实现（任务B1-B9）
   - 通过基本单元测试
   - API能够正常响应
   - API密钥管理和错误处理实现（任务B10-B11）

2. **M2: 前端界面完成**
   - 完成所有前端组件的实现（任务F1-F8）
   - 界面功能可以正常操作
   - 与后端API集成正常
   - 用户体验优化和API密钥管理UI实现（任务F9-F11）

3. **M3: 功能测试完成**
   - 所有测试用例通过（任务T1-T12）
   - 性能满足要求
   - 主要问题已修复
   - API密钥管理和用户体验测试通过

4. **M4: 项目交付**
   - 文档完善（任务D1-D2）
   - 最终验收测试通过（任务D4）
   - 部署包准备计划制定（任务D3）

### 3. 测试策略

#### 3.1 测试类型与方法

| 测试类型 | 测试方法 | 工具 | 覆盖范围 |
|---------|---------|------|---------|
| 单元测试 | 自动化测试，测试各个组件的独立功能 | pytest (后端)，Jest (前端) | 核心功能模块，覆盖率目标 >80% |
| 集成测试 | 自动化测试，测试组件间的交互 | pytest，Cypress | API接口，前后端交互 |
| 端到端测试 | 半自动化测试，模拟真实用户操作 | Playwright | 关键用户流程 |
| 性能测试 | 负载测试，测试系统在高负载下的表现 | Locust | 翻译API，大文件处理 |
| 用户体验测试 | 用户反馈，可用性测试 | 用户测试会话 | 界面交互，错误反馈 |

#### 3.2 测试用例设计

1. **本地模型测试**
   - 测试不同格式模型的加载
   - 测试模型服务连接异常处理
   - 测试模型参数配置

2. **Ollama服务测试**
   - 测试Ollama API连接
   - 测试不同Ollama模型的兼容性
   - 测试API密钥验证

3. **翻译功能测试**
   - 测试中英文翻译的准确性
   - 测试长文本翻译的性能和稳定性
   - 测试翻译上下文保持

4. **界面交互测试**
   - 测试响应性和加载状态
   - 测试错误提示和恢复
   - 测试不同屏幕尺寸的适配

5. **API密钥管理测试**
   - 测试API密钥的存储和读取
   - 测试API密钥在请求中的正确使用
   - 参考现有项目的API密钥管理实现

#### 3.3 测试环境

1. **开发环境**：用于单元测试和初步集成测试
2. **测试环境**：模拟生产环境，用于完整的集成测试和性能测试
3. **生产前环境**：与生产环境配置相同，用于最终验收测试

#### 3.4 测试流程

1. 开发人员提交代码前进行单元测试
2. CI/CD流程中自动运行单元测试和基本集成测试
3. 每个功能模块完成后进行完整的集成测试
4. 在主要里程碑完成后进行端到端测试和性能测试
5. 发布前进行全面的回归测试

## 四、错误处理与日志记录

### 1. 错误处理策略

#### 1.1 后端错误处理

1. **统一错误响应格式**
   - 所有API错误返回统一的JSON格式
   - 包含错误代码、错误消息和详细信息
   - 示例：
   ```json
   {
     "success": false,
     "message": "操作失败",
     "error_code": "MODEL_CONNECTION_ERROR",
     "details": "无法连接到Ollama服务，请检查服务是否启动"
   }
   ```

2. **错误分类**
   - 用户输入错误：参数验证失败、格式错误等
   - 系统错误：数据库连接失败、文件操作错误等
   - 外部服务错误：模型服务连接失败、API调用超时等
   - 业务逻辑错误：翻译失败、配置错误等

3. **异常处理机制**
   - 使用FastAPI的异常处理器统一处理异常
   - 实现自定义异常类，对应不同类型的错误
   - 在服务层捕获并转换底层异常

#### 1.2 前端错误处理

1. **用户友好的错误提示**
   - 显示简洁明了的错误消息
   - 提供可行的解决建议
   - 对技术错误进行适当转译，便于用户理解

2. **错误恢复机制**
   - 提供重试选项
   - 自动恢复机制（如网络连接恢复后自动重试）
   - 保存用户输入，避免数据丢失

3. **全局错误处理**
   - 实现全局错误边界组件
   - 捕获未处理的异常，防止应用崩溃
   - 提供错误报告功能

### 2. 日志记录机制

#### 2.1 后端日志

1. **日志级别**
   - ERROR：影响功能的错误
   - WARNING：潜在问题或异常情况
   - INFO：重要操作和状态变化
   - DEBUG：详细的调试信息

2. **日志内容**
   - 时间戳
   - 日志级别
   - 模块/组件名称
   - 操作描述
   - 相关参数（注意脱敏处理敏感信息）
   - 错误详情（如适用）

3. **日志存储**
   - 按日期滚动的日志文件
   - 日志文件大小限制和自动归档
   - 错误日志单独存储

#### 2.2 前端日志

1. **客户端日志**
   - 记录用户操作和界面交互
   - 捕获前端异常
   - 性能指标收集

2. **日志上报**
   - 关键错误自动上报到后端
   - 用户可选的错误报告功能
   - 批量上传以减少网络请求

### 3. 监控与告警

1. **性能监控**
   - API响应时间
   - 资源使用情况（CPU、内存）
   - 翻译任务队列长度

2. **错误监控**
   - 错误率统计
   - 重复出现的错误模式
   - 关键功能失败告警

## 五、性能优化

### 1. 后端性能优化

#### 1.1 翻译性能优化

1. **批量处理**
   - 将长文本分批处理，减少单次请求的负载
   - 实现并行处理机制，提高翻译速度
   - 优化上下文保持算法，平衡速度和翻译质量

2. **缓存机制**
   - 实现翻译结果缓存，避免重复翻译
   - 使用LRU（最近最少使用）策略管理缓存大小
   - 缓存过期策略，确保数据新鲜度

3. **资源管理**
   - 实现请求限流，防止过载
   - 优化内存使用，避免内存泄漏
   - 实现任务队列，管理长时间运行的翻译任务

#### 1.2 API性能优化

1. **响应优化**
   - 实现分页机制，减少大量数据传输
   - 使用压缩减少响应大小
   - 优化JSON序列化/反序列化

2. **数据库优化**
   - 优化查询语句
   - 实现适当的索引
   - 使用连接池管理数据库连接

### 2. 前端性能优化

1. **界面响应优化**
   - 实现虚拟滚动，高效处理大量字幕
   - 延迟加载非关键组件
   - 优化渲染性能，减少不必要的重绘

2. **资源加载优化**
   - 代码分割，按需加载
   - 静态资源优化（压缩、缓存）
   - 预加载关键资源

3. **状态管理优化**
   - 优化状态更新逻辑，减少不必要的重渲染
   - 实现高效的数据结构，优化大数据集处理
   - 本地存储优化，减少内存使用

### 3. 大文件处理优化

1. **流式处理**
   - 实现流式API，支持大文件的分块处理
   - 渐进式UI更新，提供实时反馈
   - 断点续传支持

2. **内存管理**
   - 优化大文件的内存使用
   - 实现数据清理机制，及时释放不需要的资源
   - 监控内存使用，防止内存溢出

## 六、风险评估与应对策略

### 1. 技术风险

| 风险描述 | 影响程度 | 发生概率 | 应对策略 |
|----------|----------|----------|----------|
| 本地模型服务不稳定 | 高 | 中 | 1. 实现健壮的错误处理和重试机制<br>2. 添加详细的日志记录<br>3. 提供明确的错误提示和故障排除指南 |
| Ollama API兼容性问题 | 中 | 中 | 1. 在开发初期进行全面的API测试<br>2. 实现适配层处理不同版本的API差异<br>3. 提供配置选项以适应不同版本 |
| 大文件翻译性能问题 | 高 | 高 | 1. 实现分批处理和异步翻译<br>2. 添加进度显示和取消功能<br>3. 优化内存使用和并发处理 |
| 前后端集成问题 | 中 | 低 | 1. 明确定义API契约<br>2. 编写全面的集成测试<br>3. 实现详细的错误报告机制 |
| API密钥管理问题 | 中 | 中 | 1. 参考现有项目的API密钥管理实现<br>2. 确保API密钥在应用重启后正确恢复<br>3. 实现API密钥验证机制 |

### 2. 项目风险

| 风险描述 | 影响程度 | 发生概率 | 应对策略 |
|----------|----------|----------|----------|
| 任务复杂度评估不准确 | 中 | 中 | 1. 优先实现核心功能<br>2. 设置明确的范围控制机制<br>3. 根据实际进展调整任务优先级 |
| 需求变更 | 高 | 低 | 1. 采用模块化设计以适应变更<br>2. 明确定义变更流程<br>3. 保持与利益相关者的定期沟通 |
| 依赖组件更新 | 中 | 低 | 1. 锁定关键依赖的版本<br>2. 定期更新依赖并进行兼容性测试<br>3. 为关键依赖准备备选方案 |
| 测试覆盖不足 | 高 | 中 | 1. 制定详细的测试计划<br>2. 实现自动化测试<br>3. 进行用户验收测试 |

### 3. 外部风险

| 风险描述 | 影响程度 | 发生概率 | 应对策略 |
|----------|----------|----------|----------|
| 模型服务提供商变更 | 高 | 低 | 1. 设计灵活的提供商接口<br>2. 支持多种模型服务<br>3. 提供自定义配置选项 |
| Windows环境兼容性问题 | 中 | 低 | 1. 明确记录系统要求<br>2. 提供详细的安装指南<br>3. 实现环境检查功能 |
| 网络连接问题 | 中 | 高 | 1. 实现离线模式<br>2. 添加重试和恢复机制<br>3. 提供明确的网络故障提示 |
| 本地模型可用性问题 | 高 | 中 | 1. 提供模型下载和安装指南<br>2. 实现模型可用性检查<br>3. 提供备选模型推荐 |

### 4. 风险监控与控制

1. **定期风险评估**：每周评估一次风险状态，更新风险登记表
2. **预警指标**：为每个主要风险设置预警指标，及时发现潜在问题
3. **应急计划**：为高影响风险准备详细的应急响应计划
4. **沟通机制**：建立风险沟通渠道，确保团队成员了解风险状态和应对措施

## 五、总结

本实现计划详细描述了支持本地模型和字幕翻译功能的实现方案，包括系统架构、后端实现、前端实现、实施计划和风险评估。通过遵循本计划，可以确保项目高质量地完成，并有效应对可能出现的风险和挑战。

主要优势：
1. 模块化设计，便于维护和扩展
2. 支持多种模型服务，满足不同用户需求
3. 完善的错误处理和用户反馈机制
4. 清晰的任务依赖关系和优先级排序

实施本计划需要注意以下几点：
1. 严格按照依赖关系执行任务
2. 定期评估进度和风险状态
3. 保持与团队成员和利益相关者的沟通
4. 优先实现核心功能，确保基本功能可用

## 六、注意事项

1. 本地模型需要通过外部工具（如llama.cpp或Ollama）启动服务，确保服务地址配置正确
2. 翻译功能需要考虑大文件的性能和稳定性
3. 确保翻译前后的比对结果清晰可见
4. 翻译过程中要显示进度，并支持取消操作
5. 本地模型的配置需要持久化保存，确保应用重启后仍然可用
6. Ollama模型需要预先下载并在本地启动服务，确保模型可用
7. 对于翻译任务，应选择支持多语言的模型，如llama3或其他多语言模型
8. 翻译提示模板需要针对Ollama模型的特点进行优化，确保翻译质量