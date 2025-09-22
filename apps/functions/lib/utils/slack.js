"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postToSlackChannel = postToSlackChannel;
exports.fetchSlackChannels = fetchSlackChannels;
exports.fetchSlackChannelMembers = fetchSlackChannelMembers;
const context_1 = require("../context");
/**
 * Slack APIへの投稿処理（リトライ・レート対応）
 * @param payload 投稿ペイロード
 * @param token Slack Bot Token
 * @returns 投稿結果
 */
async function postToSlackChannel(payload, token) {
    var _a;
    const maxRetries = 3;
    let retryCount = 0;
    while (retryCount < maxRetries) {
        try {
            const response = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.ok) {
                return data;
            }
            // Slack API エラーの場合
            if (data.error === 'rate_limited') {
                const retryAfter = parseInt(((_a = data.headers) === null || _a === void 0 ? void 0 : _a['retry-after']) || '1') * 1000;
                context_1.logger.warn(`Rate limited. Retrying after ${retryAfter}ms`);
                await new Promise(resolve => setTimeout(resolve, retryAfter));
                retryCount++;
                continue;
            }
            throw new Error(`Slack API error: ${data.error}`);
        }
        catch (error) {
            retryCount++;
            if (retryCount >= maxRetries) {
                throw error;
            }
            // 指数バックオフ
            const delay = Math.pow(2, retryCount) * 1000;
            context_1.logger.warn(`Slack API error, retrying in ${delay}ms:`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries exceeded');
}
/**
 * Slackチャンネル一覧を取得（ページング対応）
 * @param token Slack Bot Token
 * @returns チャンネル一覧
 */
async function fetchSlackChannels(token) {
    var _a;
    const channels = [];
    let url = 'https://slack.com/api/conversations.list?exclude_archived=true&limit=200&types=public_channel,private_channel';
    while (url) {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Slack API error: ${data.error}`);
        }
        channels.push(...data.channels);
        const cursor = (_a = data.response_metadata) === null || _a === void 0 ? void 0 : _a.next_cursor;
        url = cursor ?
            `https://slack.com/api/conversations.list?exclude_archived=true&limit=200&types=public_channel,private_channel&cursor=${encodeURIComponent(cursor)}` :
            '';
    }
    return channels;
}
/**
 * Slackチャンネルメンバー一覧を取得
 * @param token Slack Bot Token
 * @param channelId チャンネルID
 * @returns メンバー一覧
 */
async function fetchSlackChannelMembers(token, channelId) {
    var _a;
    const memberIds = [];
    let url = `https://slack.com/api/conversations.members?channel=${encodeURIComponent(channelId)}&limit=200`;
    // メンバーID一覧を取得
    while (url) {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Slack API error: ${data.error}`);
        }
        memberIds.push(...data.members);
        const cursor = (_a = data.response_metadata) === null || _a === void 0 ? void 0 : _a.next_cursor;
        url = cursor ?
            `https://slack.com/api/conversations.members?channel=${encodeURIComponent(channelId)}&limit=200&cursor=${encodeURIComponent(cursor)}` :
            '';
    }
    // ユーザー情報を取得
    const members = [];
    for (const userId of memberIds.slice(0, 500)) { // 制限を設ける
        try {
            const userResponse = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${token}` } });
            const userData = await userResponse.json();
            if (userData.ok) {
                const profile = userData.user.profile;
                members.push({
                    id: userData.user.id,
                    name: userData.user.name,
                    display_name: profile.display_name || profile.real_name || userData.user.name
                });
            }
            // レート制限対策
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        catch (error) {
            context_1.logger.warn(`Failed to fetch user info for ${userId}:`, error);
        }
    }
    return members;
}
//# sourceMappingURL=slack.js.map