/**
 * API工具函数
 */

/**
 * 掩码API密钥，只显示前几位和后几位
 * @param key API密钥
 * @returns 掩码后的API密钥
 */
export function maskApiKey(key: string): string {
  if (!key) return '';

  if (key.length > 24) {
    return `${key.slice(0, 8)}****${key.slice(-8)}`;
  } else if (key.length > 16) {
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  } else if (key.length > 8) {
    return `${key.slice(0, 2)}****${key.slice(-2)}`;
  } else {
    return key;
  }
}

/**
 * 格式化API密钥，将逗号、空格等分隔符统一为逗号
 * @param value 原始API密钥字符串
 * @returns 格式化后的API密钥字符串
 */
export function formatApiKeys(value: string): string {
  return value.replaceAll('，', ',').replaceAll(' ', ',').replaceAll(' ', '').replaceAll('\n', ',');
}
