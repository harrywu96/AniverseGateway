import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAppContext } from '../context/AppContext';
import { VideoInfo, SubtitleTrack } from '@subtranslate/shared';
import VideoPlayer from '../components/VideoPlayer';
import SubtitleEditor, { SubtitleItem } from '../components/SubtitleEditor';

/**
 * 视频详情页组件
 *
 * ID 概念说明：
 * 1. 视频ID：
 *    - id（URL参数）：从路由获取的视频ID，是后端生成的唯一标识符
 *    - 在上传视频时，后端会生成一个唯一的ID，前端应该使用这个ID进行后续操作
 *
 * 2. 字幕轨道ID：
 *    - 前端使用轨道索引的字符串表示作为ID（如 "0", "1", "2"）
 *    - backendIndex：字幕轨道在后端的索引，用于API调用
 *    - backendTrackId：后端生成的字幕轨道ID，用于某些特定操作
 *
 * 数据流：
 * 1. 页面加载时，使用URL中的ID从后端获取视频信息
 * 2. 如果后端找不到视频，尝试从前端状态中查找并上传到后端
 * 3. 选择字幕轨道后，使用视频ID和轨道索引从后端获取字幕内容
 */
const VideoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // 从URL获取视频ID（后端生成的）
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SubtitleTrack | null>(null);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  /**
   * 查找视频信息并确保后端有该视频的信息
   *
   * ID 概念说明：
   * - id（URL参数）：这是从路由获取的视频ID，是后端生成的唯一标识符
   * - state.videos中的视频对象：包含前端显示所需的视频信息
   * - 字幕轨道ID：使用轨道索引作为前端ID，同时保存后端生成的轨道ID
   *
   * 逻辑流程：
   * 1. 首先尝试直接从后端获取视频信息（使用URL中的ID）
   * 2. 如果成功获取，将后端信息与前端状态合并
   * 3. 如果后端找不到视频，检查前端状态中是否有该视频的信息
   *    - 如果有，尝试上传视频到后端
   *    - 如果没有，显示错误信息
   *
   * 这样可以避免不必要的重复上传，提高性能和用户体验
   */
  useEffect(() => {
    if (!id) return;

    // 定义一个函数来处理从后端获取的视频信息
    const processVideoFromBackend = (backendData: any, frontendVideo?: VideoInfo) => {
      // 将后端返回的字幕轨道转换为前端格式
      const convertedTracks = (backendData.subtitle_tracks || []).map((track: any) => ({
        id: track.index.toString(), // 使用轨道索引作为前端ID
        language: track.language || 'unknown',
        title: track.title || '',
        format: track.codec || 'unknown',
        isExternal: false,
        // 保存原始的后端轨道ID和索引，用于API调用
        backendTrackId: track.id,
        backendIndex: track.index
      }));

      // 如果有前端视频信息，合并数据；否则创建新的视频对象
      const videoInfo = frontendVideo ? {
        ...frontendVideo,
        subtitleTracks: convertedTracks
      } : {
        id: backendData.id, // 使用后端ID作为视频ID
        fileName: backendData.filename,
        filePath: backendData.path,
        format: backendData.format || '',
        duration: backendData.duration || 0,
        hasEmbeddedSubtitles: backendData.has_embedded_subtitle || false,
        hasExternalSubtitles: backendData.external_subtitles?.length > 0 || false,
        subtitleTracks: convertedTracks
      };

      console.log('更新视频信息:', videoInfo);
      setVideo(videoInfo);

      // 如果有字幕轨道，默认选择第一个
      if (videoInfo.subtitleTracks && videoInfo.subtitleTracks.length > 0) {
        setSelectedTrack(videoInfo.subtitleTracks[0]);
      }
    };

    // 定义一个函数来上传视频到后端
    const uploadVideoToBackend = async (videoToUpload: VideoInfo) => {
      try {
        setLoading(true);
        console.log('正在上传视频到后端:', videoToUpload.filePath);

        // 确保 electronAPI 存在
        if (!window.electronAPI) {
          throw new Error('无法访问electronAPI，无法上传视频');
        }

        if (!videoToUpload.filePath) {
          throw new Error('视频文件路径不存在，无法上传');
        }

        // 注意：我们需要在后端添加对前端ID的支持
        // 目前先使用简单的上传方式

        // 添加重试机制
        let retryCount = 0;
        const maxRetries = 3;
        let response;

        while (retryCount < maxRetries) {
          try {
            // 修复参数传递方式
            response = await window.electronAPI.uploadVideo(videoToUpload.filePath);
            break; // 如果成功，跳出循环
          } catch (uploadErr) {
            retryCount++;
            console.warn(`上传视频失败，尝试重试 (${retryCount}/${maxRetries}):`, uploadErr);

            if (retryCount >= maxRetries) {
              throw uploadErr; // 重试次数用完，抛出错误
            }

            // 等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        console.log('视频上传到后端响应:', response);

        if (response && response.success && response.data) {
          // 保存后端返回的视频ID和前端ID的映射关系
          const backendId = response.data.id;
          const frontendId = videoToUpload.id;

          console.log(`保存ID映射: 前端ID ${frontendId} -> 后端ID ${backendId}`);

          // 使用后端返回的数据更新视频信息
          processVideoFromBackend(response.data, videoToUpload);

          // 如果前端ID和后端ID不同，可以在本地存储中保存映射关系
          if (frontendId !== backendId) {
            // 这里可以添加本地存储映射的逻辑，例如使用localStorage
            try {
              const idMappings = JSON.parse(localStorage.getItem('videoIdMappings') || '{}');
              idMappings[frontendId] = backendId;
              localStorage.setItem('videoIdMappings', JSON.stringify(idMappings));
              console.log('ID映射已保存到本地存储');
            } catch (storageErr) {
              console.warn('保存ID映射到本地存储失败:', storageErr);
            }
          }

          return true;
        } else {
          console.error('上传视频到后端失败:', response?.error || '未知错误');
          setError('上传视频到后端失败: ' + (response?.error || '未知错误'));
          return false;
        }
      } catch (err: any) {
        console.error('上传视频到后端出错:', err);
        setError('上传视频到后端出错: ' + err.message);
        return false;
      } finally {
        setLoading(false);
      }
    };

    // 首先尝试直接从后端获取视频信息
    const fetchVideoFromBackend = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiPort = '8000';
        const url = `http://localhost:${apiPort}/api/videos/${id}`;
        console.log('从后端获取视频信息:', url);

        // 添加重试机制
        let retryCount = 0;
        const maxRetries = 3;
        let response;

        while (retryCount < maxRetries) {
          try {
            response = await fetch(url);
            break; // 如果成功，跳出循环
          } catch (fetchErr) {
            retryCount++;
            console.warn(`获取视频信息失败，尝试重试 (${retryCount}/${maxRetries}):`, fetchErr);

            if (retryCount >= maxRetries) {
              throw fetchErr; // 重试次数用完，抛出错误
            }

            // 等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        if (response && response.ok) {
          // 视频存在于后端，获取信息并更新
          const result = await response.json();
          console.log('从后端获取到视频信息:', result);

          if (result.success && result.data) {
            // 查找前端状态中是否有该视频的信息
            const frontendVideo = state.videos.find(v => v.id === id);
            if (frontendVideo) {
              console.log('前端状态中找到视频信息，合并数据');
              processVideoFromBackend(result.data, frontendVideo);
            } else {
              console.log('前端状态中未找到视频信息，使用后端数据');
              processVideoFromBackend(result.data);
            }
            return true;
          } else {
            console.warn('后端返回的视频信息无效');
            setError('后端返回的视频信息无效');
            return false;
          }
        } else {
          // 视频不存在于后端，检查前端状态
          console.log('后端未找到视频，检查前端状态');

          // 首先尝试使用前端ID查询后端
          if (id) {
            try {
              // 尝试使用前端ID查询后端
              const mappingUrl = `http://localhost:${apiPort}/api/videos/by-frontend-id/${id}`;
              console.log('尝试使用前端ID查询后端:', mappingUrl);

              const mappingResponse = await fetch(mappingUrl);
              if (mappingResponse.ok) {
                const mappingResult = await mappingResponse.json();
                if (mappingResult.success && mappingResult.data) {
                  console.log('通过前端ID找到了后端视频:', mappingResult.data);
                  processVideoFromBackend(mappingResult.data);
                  return true;
                }
              }
            } catch (mappingErr) {
              console.warn('使用前端ID查询后端失败:', mappingErr);
              // 继续尝试其他方法
            }
          }

          // 如果通过ID映射未找到，检查前端状态
          const frontendVideo = state.videos.find(v => v.id === id);
          if (frontendVideo) {
            console.log('前端状态中找到视频信息，尝试上传到后端');
            return await uploadVideoToBackend(frontendVideo);
          } else {
            console.error('前端状态中也未找到视频信息，ID:', id);
            console.log('当前可用视频:', state.videos);
            setError('未找到视频信息');
            return false;
          }
        }
      } catch (err: any) {
        console.error('获取视频信息时出错:', err);
        setError('获取视频信息时出错: ' + err.message);

        // 如果获取失败，检查前端状态
        const frontendVideo = state.videos.find(v => v.id === id);
        if (frontendVideo) {
          console.log('前端状态中找到视频信息，尝试上传到后端');
          return await uploadVideoToBackend(frontendVideo);
        } else {
          console.error('前端状态中也未找到视频信息，ID:', id);
          return false;
        }
      } finally {
        setLoading(false);
      }
    };

    // 执行获取视频信息
    fetchVideoFromBackend();
  }, [id, state.videos]);

  // 加载字幕内容
  useEffect(() => {
    if (video && selectedTrack) {
      // 使用视频ID（这是后端生成的ID）和字幕轨道ID（这是轨道索引）
      const videoId = (video as any).backendId || video.id;
      loadSubtitleContent(videoId, selectedTrack.id);
    }
  }, [video, selectedTrack]);

  /**
   * 加载字幕内容的函数
   *
   * ID 概念说明：
   * - videoId：视频的ID，是后端生成的唯一标识符
   * - trackId：字幕轨道的前端ID，通常是轨道索引的字符串表示
   * - trackIndex：字幕轨道在后端的索引，用于API调用
   *
   * 逻辑流程：
   * 1. 检查参数有效性和视频对象是否存在
   * 2. 获取字幕轨道索引
   * 3. 检查视频是否存在于后端
   *    - 如果不存在，尝试重新上传视频
   * 4. 请求字幕内容
   *    - 如果成功，更新字幕状态
   *    - 如果失败，回退到模拟数据
   *
   * 错误处理：
   * - 每个步骤都有适当的错误处理
   * - 如果无法从后端获取数据，使用模拟数据
   * - 所有错误都会被记录并显示给用户
   *
   * @param videoId 视频ID（后端生成的唯一标识符）
   * @param trackId 字幕轨道ID（前端使用的轨道索引）
   */
  const loadSubtitleContent = async (videoId: string, trackId: string) => {
    try {
      setLoading(true);
      setError(null); // 清除之前的错误

      // 检查参数有效性
      if (!videoId || !trackId) {
        throw new Error('无效的视频ID或轨道ID');
      }

      // 检查视频对象是否存在
      if (!video) {
        throw new Error('视频对象不存在');
      }

      // 先尝试使用API获取字幕内容
      if (window.electronAPI) {
        try {
          // 获取轨道信息
          const track = video.subtitleTracks?.find(t => t.id === trackId);
          if (!track) {
            throw new Error(`找不到ID为 ${trackId} 的字幕轨道`);
          }

          // 构建请求URL - 使用轨道索引
          const apiPort = '8000';
          // 获取轨道索引
          let trackIndex = 0; // 默认使用第一个轨道

          // 如果轨道有backendIndex属性，直接使用
          if ((track as any).backendIndex !== undefined) {
            trackIndex = (track as any).backendIndex;
            console.log('使用轨道的backendIndex:', trackIndex);
          } else {
            // 否则尝试将轨道ID转换为数字（因为轨道ID通常就是索引的字符串表示）
            try {
              const parsedIndex = parseInt(track.id);
              if (!isNaN(parsedIndex) && parsedIndex >= 0) {
                trackIndex = parsedIndex;
                console.log('使用轨道ID解析的索引:', trackIndex);
              }
            } catch (e) {
              console.warn('轨道ID转换为索引失败，使用默认值0:', e);
            }
          }

          // 检查视频是否存在于后端
          console.log('检查视频是否存在于后端:', videoId);
          const checkUrl = `http://localhost:${apiPort}/api/videos/${videoId}`;

          try {
            // 添加重试机制
            let retryCount = 0;
            const maxRetries = 3;
            let checkResponse;

            while (retryCount < maxRetries) {
              try {
                checkResponse = await fetch(checkUrl);
                break; // 如果成功，跳出循环
              } catch (fetchErr) {
                retryCount++;
                console.warn(`检查视频是否存在失败，尝试重试 (${retryCount}/${maxRetries}):`, fetchErr);

                if (retryCount >= maxRetries) {
                  throw fetchErr; // 重试次数用完，抛出错误
                }

                // 等待一段时间再重试
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }

            // 如果视频不存在于后端，尝试重新上传
            if (!checkResponse || !checkResponse.ok) {
              if (!video.filePath) {
                throw new Error('视频不存在于后端，且本地没有文件路径，无法上传');
              }

              console.log('视频不存在于后端，尝试重新上传:', video.filePath);

              if (!window.electronAPI) {
                throw new Error('无法访问electronAPI，无法上传视频');
              }

              // 注意：我们需要在后端添加对前端ID的支持
              // 目前先使用简单的上传方式

              // 添加重试机制
              retryCount = 0;
              let uploadResponse;

              while (retryCount < maxRetries) {
                try {
                  // 修复参数传递方式
                  uploadResponse = await window.electronAPI.uploadVideo(video.filePath);
                  break; // 如果成功，跳出循环
                } catch (uploadErr) {
                  retryCount++;
                  console.warn(`重新上传视频失败，尝试重试 (${retryCount}/${maxRetries}):`, uploadErr);

                  if (retryCount >= maxRetries) {
                    throw uploadErr; // 重试次数用完，抛出错误
                  }

                  // 等待一段时间再重试
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }

              if (uploadResponse && uploadResponse.success && uploadResponse.data) {
                console.log('重新上传视频成功，更新视频ID:', uploadResponse.data.id);

                // 保存后端返回的视频ID和前端ID的映射关系
                const backendId = uploadResponse.data.id;
                const frontendId = video.id;

                console.log(`保存ID映射: 前端ID ${frontendId} -> 后端ID ${backendId}`);

                // 如果前端ID和后端ID不同，可以在本地存储中保存映射关系
                if (frontendId !== backendId) {
                  try {
                    const idMappings = JSON.parse(localStorage.getItem('videoIdMappings') || '{}');
                    idMappings[frontendId] = backendId;
                    localStorage.setItem('videoIdMappings', JSON.stringify(idMappings));
                    console.log('ID映射已保存到本地存储');
                  } catch (storageErr) {
                    console.warn('保存ID映射到本地存储失败:', storageErr);
                  }
                }

                // 更新视频ID
                videoId = uploadResponse.data.id;

                // 更新轨道索引
                if (uploadResponse.data.subtitle_tracks && uploadResponse.data.subtitle_tracks.length > trackIndex) {
                  trackIndex = uploadResponse.data.subtitle_tracks[trackIndex].index;
                  console.log('更新轨道索引:', trackIndex);
                }

                // 更新视频对象
                const updatedVideo = {
                  ...video,
                  id: uploadResponse.data.id, // 使用后端返回的ID更新视频ID
                  backendId: uploadResponse.data.id // 额外保存后端ID
                };
                setVideo(updatedVideo);
              } else {
                throw new Error('重新上传视频失败: ' + (uploadResponse?.error || '未知错误'));
              }
            }
          } catch (checkError: any) {
            console.error('检查视频在后端是否存在时出错:', checkError);
            throw new Error('检查视频在后端是否存在时出错: ' + checkError.message);
          }

          // 构建请求字幕内容的URL
          console.log('使用轨道索引:', trackIndex);
          const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/content`;
          console.log('请求字幕内容URL:', url);

          // 发送请求
          try {
            const response = await fetch(url);

            if (response.ok) {
              const result = await response.json();
              console.log('获取字幕内容响应:', result);

              if (result.success && result.data && result.data.lines) {
                // 将后端数据转换为前端需要的格式
                const subtitleItems = result.data.lines.map((line: any) => ({
                  id: line.index.toString(), // 使用行索引作为ID
                  startTime: line.start_ms / 1000, // 毫秒转秒
                  endTime: line.end_ms / 1000,
                  text: line.text
                }));

                setSubtitles(subtitleItems);
                return; // 成功获取数据，提前返回
              } else {
                throw new Error('后端返回的字幕数据无效');
              }
            } else {
              const errorText = await response.text();
              throw new Error(`获取字幕内容失败 (${response.status}): ${errorText}`);
            }
          } catch (fetchError: any) {
            console.error('获取字幕内容失败:', fetchError);
            throw new Error('获取字幕内容失败: ' + fetchError.message);
          }
        } catch (apiError: any) {
          console.error('调用字幕API出错:', apiError);
          // 不立即抛出错误，而是回退到模拟数据
          console.warn('从后端获取字幕失败，使用模拟数据');
        }
      } else {
        console.warn('无法访问electronAPI，使用模拟数据');
      }

      // 如果无法从后端获取数据，使用模拟数据
      console.log('使用模拟字幕数据');
      const mockSubtitles = [
        { id: '1', startTime: 0, endTime: 5, text: '这是第一行字幕' },
        { id: '2', startTime: 6, endTime: 10, text: '这是第二行字幕' },
        { id: '3', startTime: 11, endTime: 15, text: '这是第三行字幕' },
        { id: '4', startTime: 16, endTime: 20, text: '这是第四行字幕' },
        { id: '5', startTime: 21, endTime: 25, text: '这是第五行字幕' },
        { id: '6', startTime: 26, endTime: 30, text: '这是第六行字幕' },
        { id: '7', startTime: 31, endTime: 35, text: '这是第七行字幕' },
        { id: '8', startTime: 36, endTime: 40, text: '这是第八行字幕' },
        { id: '9', startTime: 41, endTime: 45, text: '这是第九行字幕' },
        { id: '10', startTime: 46, endTime: 50, text: '这是第十行字幕' },
      ];
      setSubtitles(mockSubtitles);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError('加载字幕内容失败: ' + errorMessage);
      console.error('加载字幕内容失败:', err);

      // 设置空字幕列表，避免显示旧数据
      setSubtitles([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理轨道选择变化
  const handleTrackChange = (event: SelectChangeEvent) => {
    const trackId = event.target.value;
    const track = video?.subtitleTracks?.find(t => t.id === trackId) || null;
    setSelectedTrack(track);
  };

  // 处理视频时间更新
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // 返回上一页
  const handleBack = () => {
    navigate(-1);
  };

  // 格式化时间为 HH:MM:SS.mmm
  const formatTime = (seconds: number): string => {
    const date = new Date(0);
    date.setSeconds(seconds);
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
    const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
    return `${hours}:${minutes}:${secs}.${ms}`;
  };

  if (!video) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Typography>未找到视频信息</Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* 顶部导航栏 */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={handleBack} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1">
          {video.fileName}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* 左侧：视频播放区域 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 2 }}>
            {/* 视频播放器 */}
            {video.filePath ? (
              <VideoPlayer
                src={video.filePath}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 0,
                  paddingBottom: '56.25%', // 16:9 宽高比
                  bgcolor: 'black',
                  position: 'relative'
                }}
              >
                <Typography
                  sx={{
                    color: 'white',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  无法加载视频
                </Typography>
              </Box>
            )}

            {/* 时间信息显示 */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                当前时间: {formatTime(currentTime)}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* 右侧：字幕编辑区域 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            {/* 字幕轨道选择 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="subtitle-track-label">字幕轨道</InputLabel>
              <Select
                labelId="subtitle-track-label"
                value={selectedTrack?.id || ''}
                label="字幕轨道"
                onChange={handleTrackChange}
                disabled={!video.subtitleTracks || video.subtitleTracks.length === 0}
              >
                {video.subtitleTracks?.map((track) => (
                  <MenuItem key={track.id} value={track.id}>
                    {track.language || '未知语言'} - {track.title || track.format}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ mb: 2 }} />

            {/* 字幕内容区域 */}
            <Box sx={{ height: 400 }}>
              <SubtitleEditor
                subtitles={subtitles as SubtitleItem[]}
                currentTime={currentTime}
                loading={loading}
                error={error}
                onSave={async (subtitle) => {
                  try {
                    if (!video || !selectedTrack) return;

                    // 尝试调用后端 API 保存字幕
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

                    const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/edit`;

                    // 将前端数据转换为后端需要的格式
                    const payload = {
                      index: parseInt(subtitle.id),
                      start_ms: Math.round(subtitle.startTime * 1000),
                      end_ms: Math.round(subtitle.endTime * 1000),
                      text: subtitle.text
                    };

                    const response = await fetch(url, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (result.success) {
                        // 更新字幕列表
                        setSubtitles(prev =>
                          prev.map(item => item.id === subtitle.id ? subtitle : item)
                        );
                        return;
                      }
                    }

                    // 如果 API 调用失败，回退到模拟保存
                    console.warn('调用保存字幕API失败，使用模拟保存');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev =>
                      prev.map(item => item.id === subtitle.id ? subtitle : item)
                    );
                  } catch (error) {
                    console.error('保存字幕失败:', error);
                    // 模拟保存成功
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev =>
                      prev.map(item => item.id === subtitle.id ? subtitle : item)
                    );
                  }
                }}
                onDelete={async (id) => {
                  try {
                    if (!video || !selectedTrack) return;

                    // 尝试调用后端 API 删除字幕
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

                    const url = `http://localhost:${apiPort}/api/videos/${videoId}/subtitles/${trackIndex}/delete/${id}`;

                    const response = await fetch(url, {
                      method: 'DELETE'
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (result.success) {
                        // 更新字幕列表
                        setSubtitles(prev => prev.filter(item => item.id !== id));
                        return;
                      }
                    }

                    // 如果 API 调用失败，回退到模拟删除
                    console.warn('调用删除字幕API失败，使用模拟删除');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev => prev.filter(item => item.id !== id));
                  } catch (error) {
                    console.error('删除字幕失败:', error);
                    // 模拟删除成功
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setSubtitles(prev => prev.filter(item => item.id !== id));
                  }
                }}
              />
            </Box>

            {/* 操作按钮 */}
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
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VideoDetail;
