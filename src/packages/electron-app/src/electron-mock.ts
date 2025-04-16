/**
 * 鎻愪緵妯℃嫙鐨凟lectron API瀹炵幇锛岀敤浜庡湪娴忚鍣ㄧ幆澧冧腑璋冭瘯
 */

// 纭繚window.electronAPI濮嬬粓瀛樺湪
if (typeof window !== 'undefined') {
  // 濡傛灉鐢靛瓙API涓嶅瓨鍦紝鍒涘缓涓€涓ā鎷熷疄鐜?
  if (!window.electronAPI) {
    console.log('鍒濆鍖栨ā鎷熺殑Electron API');
    window.electronAPI = {
      // 妫€鏌ュ悗绔姸鎬?
      checkBackendStatus: async () => {
        console.log('妯℃嫙: 妫€鏌ュ悗绔姸鎬?);
        return true;
      },
      
      // 閫夋嫨瑙嗛鏂囦欢
      selectVideo: async () => {
        console.log('妯℃嫙: 閫夋嫨瑙嗛鏂囦欢');
        return null;
      },
      
      // 涓婁紶鏈湴瑙嗛鏂囦欢
      uploadVideo: async (filePath) => {
        console.log('妯℃嫙: 涓婁紶瑙嗛鏂囦欢', filePath);
        return { success: true };
      },
      
      // 鐩戝惉鍚庣鍚姩浜嬩欢
      onBackendStarted: (callback) => {
        console.log('妯℃嫙: 娉ㄥ唽鍚庣鍚姩浜嬩欢鐩戝惉');
        // 妯℃嫙3绉掑悗鍚姩
        setTimeout(callback, 3000);
        return () => {
          console.log('妯℃嫙: 绉婚櫎鍚庣鍚姩浜嬩欢鐩戝惉');
        };
      },
      
      // 鐩戝惉鍚庣鍋滄浜嬩欢
      onBackendStopped: (callback) => {
        console.log('妯℃嫙: 娉ㄥ唽鍚庣鍋滄浜嬩欢鐩戝惉');
        return () => {
          console.log('妯℃嫙: 绉婚櫎鍚庣鍋滄浜嬩欢鐩戝惉');
        };
      }
    };
  }
}

export {};
