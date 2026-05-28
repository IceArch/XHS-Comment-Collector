// ==UserScript==
// @name         小红书评论采集助手 Pro (修复版)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  自动拦截小红书评论API，支持SPA路由，导出含用户ID、主页链接的CSV
// @author       AI Assistant
// @match        https://www.xiaohongshu.com/*
// @match        https://xhslink.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 调试日志 ====================
    const log = (...args) => console.log('[XHS采集]', ...args);
    log('脚本已注入，当前URL:', location.href);

    // ==================== 数据存储 ====================
    let commentsData = [];
    let collectedIds = new Set();
    let isAutoScrolling = false;

    // ==================== 工具函数 ====================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const getNoteId = () => {
        const m = location.pathname.match(/\/explore\/([a-zA-Z0-9]+)/) ||
                  location.pathname.match(/\/discovery\/item\/([a-zA-Z0-9]+)/) ||
                  location.pathname.match(/\/user\/profile\/[^/]+\/([a-zA-Z0-9]+)/);
        return m ? m[1] : '';
    };
    const isNotePage = () => !!getNoteId();

    const formatTime = ts => {
        if (!ts) return '';
        const d = new Date(Number(ts));
        if (isNaN(d.getTime())) return ts;
        const pad = n => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const escapeCSV = str => {
        if (str == null) return '';
        let s = String(str).replace(/"/g, '""');
        if (s.includes(',') || s.includes('\n') || s.includes('"')) s = `"${s}"`;
        return s;
    };

    // ==================== 核心：处理评论数据 ====================
    function processComment(c, isSub = false, parentId = '', targetUser = null) {
        if (!c || !c.id) return;
        if (collectedIds.has(c.id)) return;
        collectedIds.add(c.id);

        const user = c.user_info || {};
        const note_id = c.note_id || getNoteId();
        const userId = user.user_id || '';
        const xsec = user.xsec_token || '';

        let homeLink = '';
        if (userId) {
            homeLink = `https://www.xiaohongshu.com/user/profile/${userId}`;
            if (xsec) homeLink += `?xsec_token=${xsec}&xsec_source=pc_comment`;
        }

        let replyToId = '', replyToName = '';
        if (targetUser) {
            replyToId = targetUser.user_id || '';
            replyToName = targetUser.nickname || '';
        } else if (c.target_comment && c.target_comment.user_info) {
            replyToId = c.target_comment.user_info.user_id || '';
            replyToName = c.target_comment.user_info.nickname || '';
        }

        commentsData.push({
            note_id, comment_id: c.id, user_id: userId, nickname: user.nickname || '',
            user_home: homeLink, avatar: user.image || '',
            content: (c.content || '').replace(/\s+/g, ' ').trim(),
            create_time: formatTime(c.create_time), ip_location: c.ip_location || '',
            like_count: c.like_count || 0, is_sub: isSub ? '是' : '否',
            parent_id: parentId, reply_to_id: replyToId, reply_to_name: replyToName,
            xsec_token: xsec
        });

        updateUI();

        if (c.sub_comments && Array.isArray(c.sub_comments)) {
            c.sub_comments.forEach(sub => processComment(sub, true, c.id, user));
        }
    }

    function processCommentsArray(arr) {
        if (!Array.isArray(arr)) return;
        arr.forEach(c => processComment(c, false, ''));
    }

    // ==================== 核心：劫持网络请求 ====================
    if (window.fetch) {
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
            try {
                const url = args[0] || '';
                const urlStr = typeof url === 'string' ? url : (url.url || '');
                if (urlStr && (urlStr.includes('/comment/page') || urlStr.includes('/comment/sub_page'))) {
                    log('拦截到评论API:', urlStr.slice(0, 80));
                    const resp = await origFetch.apply(this, args);
                    const clone = resp.clone();
                    clone.json().then(data => {
                        if (data?.data?.comments) {
                            log('解析到评论数据:', data.data.comments.length, '条');
                            processCommentsArray(data.data.comments);
                        }
                    }).catch(e => log('fetch解析失败', e));
                    return resp;
                }
            } catch(e) {}
            return origFetch.apply(this, args);
        };
        log('fetch 劫持完成');
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', function() {
            try {
                const url = this._url || '';
                if (url.includes('/comment/page') || url.includes('/comment/sub_page')) {
                    log('XHR 拦截到评论API');
                    const data = JSON.parse(this.responseText);
                    if (data?.data?.comments) processCommentsArray(data.data.comments);
                }
            } catch (e) {}
        });
        return origSend.apply(this, args);
    };
    log('XHR 劫持完成');

    // ==================== 创建浮动面板 ====================
    function createPanel() {
        if (!isNotePage()) {
            log('当前不是笔记页面，跳过创建面板');
            return;
        }
        if (document.getElementById('xhs-comment-collector')) {
            log('面板已存在，跳过');
            return;
        }
        if (!document.body) {
            log('document.body 未就绪，延迟创建');
            setTimeout(createPanel, 500);
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'xhs-comment-collector';
        panel.innerHTML = `
            <div style="font-weight:bold;margin-bottom:8px;font-size:14px;color:#333;cursor:move;">🍠 评论采集助手</div>
            <div id="xhs-status" style="margin-bottom:10px;color:#666;font-size:12px;">已采集：0 条</div>
            <button id="xhs-btn-auto" style="display:block;width:100%;margin-bottom:6px;padding:8px 0;background:#ff2442;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">自动展开全部评论</button>
            <button id="xhs-btn-export" style="display:block;width:100%;margin-bottom:6px;padding:8px 0;background:#056b00;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">导出 CSV</button>
            <button id="xhs-btn-clear" style="display:block;width:100%;padding:8px 0;background:#999;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">清空数据</button>
            <div style="margin-top:8px;font-size:10px;color:#999;line-height:1.4;">
                提示：先点击"自动展开"加载所有评论，再点"导出"<br>
                当前笔记ID: <span id="xhs-note-id" style="color:#666;">${getNoteId() || '未识别'}</span>
            </div>
        `;
        Object.assign(panel.style, {
            position: 'fixed', bottom: '20px', right: '20px', width: '180px',
            background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px',
            padding: '14px', zIndex: '2147483647', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            fontFamily: 'system-ui,-apple-system,sans-serif'
        });

        // 拖拽支持
        let isDragging = false, startX, startY, startLeft, startTop;
        const title = panel.querySelector('div:first-child');
        title.addEventListener('mousedown', e => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left; startTop = rect.top;
            panel.style.transition = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            panel.style.left = (startLeft + e.clientX - startX) + 'px';
            panel.style.top = (startTop + e.clientY - startY) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });
        document.addEventListener('mouseup', () => { isDragging = false; panel.style.transition = 'all 0.3s'; });

        document.body.appendChild(panel);
        log('✅ 面板已创建');

        document.getElementById('xhs-btn-auto').addEventListener('click', autoScroll);
        document.getElementById('xhs-btn-export').addEventListener('click', exportCSV);
        document.getElementById('xhs-btn-clear').addEventListener('click', () => {
            if (confirm('确定清空所有已采集数据？')) {
                commentsData = []; collectedIds.clear(); updateUI();
            }
        });
    }

    function updateUI() {
        const el = document.getElementById('xhs-status');
        if (el) el.textContent = `已采集：${commentsData.length} 条（去重）`;
    }

    // ==================== 自动滚动加载 ====================
    async function autoScroll() {
        if (isAutoScrolling) return;
        isAutoScrolling = true;
        const btn = document.getElementById('xhs-btn-auto');
        btn.textContent = '展开中...'; btn.style.background = '#999';

        const container = document.querySelector('.note-scroller') ||
                          document.querySelector('.interaction-container') ||
                          document.querySelector('.main-container') ||
                          document.querySelector('main') ||
                          window;

        let lastCount = 0, stallCount = 0;
        while (stallCount < 8) {
            if (container === window) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            } else {
                container.scrollTop = container.scrollHeight;
            }

            document.querySelectorAll('.expand-btn, .more-reply, .show-more, .sub-comment-more, .reply-expand, [class*="expand"], [class*="more"]').forEach(b => {
                try { b.click(); } catch(e) {}
            });

            await sleep(2500 + Math.random() * 2000);

            if (commentsData.length > lastCount) {
                lastCount = commentsData.length;
                stallCount = 0;
                log('滚动中，已采集:', lastCount);
            } else {
                stallCount++;
            }
        }

        isAutoScrolling = false;
        btn.textContent = '自动展开全部评论'; btn.style.background = '#ff2442';
        log('自动展开完成，共采集:', commentsData.length);
        alert(`✅ 加载完成！共采集 ${commentsData.length} 条评论（含二级评论）`);
    }

    // ==================== 导出 CSV ====================
    function exportCSV() {
        if (commentsData.length === 0) {
            alert('暂无数据，请先加载评论');
            return;
        }
        const headers = ['笔记ID','评论ID','用户ID','用户昵称','用户主页','头像链接','评论内容','评论时间','IP属地','点赞数','是否二级评论','父评论ID','回复对象ID','回复对象昵称','xsec_token'];
        const rows = commentsData.map(d => [d.note_id, d.comment_id, d.user_id, d.nickname, d.user_home, d.avatar, d.content, d.create_time, d.ip_location, d.like_count, d.is_sub, d.parent_id, d.reply_to_id, d.reply_to_name, d.xsec_token]);
        let csv = '\uFEFF' + headers.map(escapeCSV).join(',') + '\n';
        rows.forEach(row => { csv += row.map(escapeCSV).join(',') + '\n'; });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const noteTitle = document.querySelector('.title, .note-title, h1')?.textContent?.trim()?.slice(0, 30) || getNoteId();
        const filename = `小红书评论_${noteTitle}_${new Date().toLocaleDateString()}.csv`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = filename;
        link.style.display = 'none'; document.body.appendChild(link); link.click();
        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(link.href); }, 100);
        log('CSV 已导出:', filename);
    }

    // ==================== 初始化逻辑 ====================
    function init() {
        log('init() 被调用，路径:', location.pathname);
        if (!isNotePage()) {
            log('非笔记页，跳过');
            return;
        }
        setTimeout(createPanel, 1500);
    }

    // 首次执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }

    // SPA 路由监听：小红书点击笔记卡片不会刷新整页
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            log('🔄 检测到 URL 变化:', lastUrl);
            commentsData = []; collectedIds.clear();
            const old = document.getElementById('xhs-comment-collector');
            if (old) old.remove();
            if (isNotePage()) setTimeout(init, 2000);
        }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // 兜底：每5秒检查面板是否存在
    setInterval(() => {
        if (isNotePage() && !document.getElementById('xhs-comment-collector')) {
            log('兜底检查：面板丢失，尝试重建');
            createPanel();
        }
    }, 5000);

    log('脚本初始化完成，等待页面就绪...');
})();