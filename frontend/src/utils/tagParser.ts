/**
 * 标签解析工具
 * 支持从文本中提取 #标签，支持中英文
 */

// 标签正则：支持中文、英文、数字
const TAG_REGEX = /#([a-zA-Z0-9\u4e00-\u9fa5]+)/g;

/**
 * 从文本中提取所有标签
 * @param text 原始文本
 * @returns 标签数组（去重）
 */
export function extractTags(text: string): string[] {
    if (!text) return [];

    const matches = text.matchAll(TAG_REGEX);
    const tags = new Set<string>();

    for (const match of matches) {
        if (match[1]) {
            // 限制标签长度
            if (match[1].length <= 50) {
                tags.add(match[1]);
            }
        }
    }

    return Array.from(tags);
}

/**
 * 验证标签格式
 * @param tag 标签名（不含#号）
 * @returns 是否合法
 */
export function isValidTag(tag: string): boolean {
    if (!tag || tag.length === 0) return false;
    if (tag.length > 50) return false;

    // 只允许中英文和数字
    const validRegex = /^[a-zA-Z0-9\u4e00-\u9fa5]+$/;
    return validRegex.test(tag);
}

/**
 * 高亮文本中的标签
 * @param text 原始文本
 * @param onTagClick 标签点击回调
 * @returns React 元素数组
 */
export function highlightTags(
    text: string,
    onTagClick?: (tag: string) => void
): Array<string | { type: 'tag'; value: string }> {
    const result: Array<string | { type: 'tag'; value: string }> = [];
    let lastIndex = 0;

    const regex = new RegExp(TAG_REGEX);
    let match;

    while ((match = regex.exec(text)) !== null) {
        // 添加标签前的文本
        if (match.index > lastIndex) {
            result.push(text.substring(lastIndex, match.index));
        }

        // 添加标签
        result.push({
            type: 'tag',
            value: match[1]
        });

        lastIndex = regex.lastIndex;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
        result.push(text.substring(lastIndex));
    }

    return result;
}

/**
 * 从文本中移除标签标记（保留标签文字）
 * @param text 原始文本
 * @returns 处理后的文本
 */
export function removeTagMarkers(text: string): string {
    return text.replace(TAG_REGEX, '$1');
}

/**
 * 统计文本中的标签数量
 * @param text 原始文本
 * @returns 标签数量
 */
export function countTags(text: string): number {
    return extractTags(text).length;
}

/**
 * 将标签数组转换为显示文本
 * @param tags 标签数组
 * @returns 格式化的标签文本
 */
export function formatTags(tags: string[]): string {
    return tags.map(tag => `#${tag}`).join(' ');
}

/**
 * 检查文本是否包含指定标签
 * @param text 文本内容
 * @param tag 要查找的标签（不含#）
 * @returns 是否包含
 */
export function hasTag(text: string, tag: string): boolean {
    const tags = extractTags(text);
    return tags.includes(tag);
}

/**
 * 标签搜索建议（模糊匹配）
 * @param query 搜索词
 * @param allTags 所有可用标签
 * @returns 匹配的标签列表
 */
export function suggestTags(query: string, allTags: string[]): string[] {
    if (!query) return allTags.slice(0, 10);

    const lowerQuery = query.toLowerCase();
    return allTags
        .filter(tag => tag.toLowerCase().includes(lowerQuery))
        .slice(0, 10);
}

/**
 * 限制标签数量
 * @param tags 标签数组
 * @param maxTags 最大数量
 * @returns 截断后的标签数组
 */
export function limitTags(tags: string[], maxTags: number = 10): string[] {
    return tags.slice(0, maxTags);
}

// 导出常量
export const TAG_CONSTANTS = {
    MAX_TAG_LENGTH: 50,
    MAX_TAGS_PER_POST: 10,
    TAG_REGEX: TAG_REGEX,
};