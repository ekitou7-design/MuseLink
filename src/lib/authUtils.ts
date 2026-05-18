// Authentication utilities and constants

// 登录账号规则：普通用户是 8-10 位数字，管理员可使用字母账号。
export const MUSE_ID_REGEX = /^[A-Za-z0-9_-]{4,24}$/;
export const MUSE_ID_DESCRIPTION = "MuseLink 登录账号";

// 本地存储键
export const REGISTER_SUCCESS_STORAGE_KEY = "muselink_register_success_museId";

/**
 * 规范化 MuseLink ID：验证格式并去除空白
 */
export function normalizeMuseId(value: string | null | undefined): string | null {
  const museId = value?.trim() || "";
  return MUSE_ID_REGEX.test(museId) ? museId : null;
}

/**
 * 从本地存储获取已注册的 MuseLink ID
 */
export function getStoredMuseId(): string | null {
  return normalizeMuseId(localStorage.getItem(REGISTER_SUCCESS_STORAGE_KEY));
}

/**
 * 保存 MuseLink ID 到本地存储
 */
export function saveMuseId(museId: string): void {
  localStorage.setItem(REGISTER_SUCCESS_STORAGE_KEY, museId);
}

/**
 * 清除本地存储中的 MuseLink ID
 */
export function clearStoredMuseId(): void {
  localStorage.removeItem(REGISTER_SUCCESS_STORAGE_KEY);
}

/**
 * 复制文本到剪贴板（支持兼容性处理）
 */
export async function copyToClipboard(text: string): Promise<void> {
  // 优先使用现代 Clipboard API
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // 降级方案：使用 textarea 和 execCommand
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
