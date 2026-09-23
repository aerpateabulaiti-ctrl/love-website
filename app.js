var PASSWORD_HASH = '60571ebc41f8568fe4cab5c90c8ef8992d278e9abaadb8743a6a509d88f94d03';

async function sha256(str) {
    var buf = new TextEncoder().encode(str);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    var arr = Array.from(new Uint8Array(hash));
    return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}
var ANNIVERSARY = new Date('2026-05-20T00:00:00');

var SB_URL = 'https://okpcwsianqkouitdwhvx.supabase.co/rest/v1';
var SB_KEY = 'sb_publishable_vbFikpq9UwVas__oLTWWaQ_Qx4I3Nsz';

// Keep mobile requests on the site's own domain. Stored photo URLs remain unchanged.
function sameOriginRequestUrl(url) {
    // GitHub Pages is static-only; keep its existing direct connection behavior.
    if (typeof location !== 'undefined' && (location.hostname.endsWith('.github.io') || location.protocol === 'file:')) return url;
    var base = 'https://okpcwsianqkouitdwhvx.supabase.co';
    if (url.indexOf(base + '/rest/v1/') === 0) return '/api/db/' + url.slice((base + '/rest/v1/').length);
    if (url.indexOf(base + '/storage/v1/object/public/photos/') === 0) return '/media/photos/' + url.slice((base + '/storage/v1/object/public/photos/').length);
    if (url.indexOf(base + '/storage/v1/object/photos/') === 0) return '/api/storage/' + url.slice((base + '/storage/v1/object/photos/').length);
    return url;
}
function siteFetch(url, options) { return fetch(sameOriginRequestUrl(url), options); }
function photoDeliveryUrl(url) { return sameOriginRequestUrl(url); }

function sbHeaders() {
    return {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json'
    };
}

async function sbGet(table, query) {
    var qs = '';
    if (typeof query === 'string') {
        qs = '?' + query;
    } else if (query) {
        qs = '?' + Object.keys(query).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
        }).join('&');
    }
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    try {
        var res = await siteFetch(SB_URL + '/' + table + qs, {
            method: 'GET', headers: sbHeaders(), signal: controller.signal
        });
        if (!res.ok) { throw new Error('GET ' + table + ': HTTP ' + res.status); }
        var rows = await res.json();
        if (!Array.isArray(rows)) { throw new Error('GET ' + table + ': invalid response'); }
        return rows;
    } finally { clearTimeout(timeout); }
}

async function sbInsert(table, data) {
    try {
        var res = await siteFetch(SB_URL + '/' + table, {
            method: 'POST',
            headers: Object.assign({ 'Prefer': 'return=representation' }, sbHeaders()),
            body: JSON.stringify(data)
        });
        if (!res.ok) { var e = await res.text(); console.error('INSERT ' + table + ': ' + e); return null; }
        return res.json();
    } catch (err) { console.error('INSERT ' + table + ': ' + err.message); return null; }
}

async function sbUpdate(table, filterCol, filterVal, data) {
    try {
        var qs = encodeURIComponent(filterCol) + '=eq.' + encodeURIComponent(filterVal);
        var res = await siteFetch(SB_URL + '/' + table + '?' + qs, {
            method: 'PATCH',
            headers: Object.assign({ 'Prefer': 'return=representation' }, sbHeaders()),
            body: JSON.stringify(data)
        });
        if (!res.ok) { var e = await res.text(); console.error('UPDATE ' + table + ': ' + e); return false; }
        var updated = await res.json();
        return Array.isArray(updated) && updated.length > 0;
    } catch (err) { console.error('UPDATE ' + table + ': ' + err.message); return false; }
}

async function sbDelete(table, filterCol, filterVal) {
    try {
        var qs = encodeURIComponent(filterCol) + '=eq.' + encodeURIComponent(filterVal);
        var res = await siteFetch(SB_URL + '/' + table + '?' + qs, {
            method: 'DELETE',
            headers: sbHeaders()
        });
        if (!res.ok) { var e = await res.text(); console.error('DELETE ' + table + ': ' + e); return false; }
        return true;
    } catch (err) { console.error('DELETE ' + table + ': ' + err.message); return false; }
}

var PROVINCES = [
    { name: '北京', region: '华北' }, { name: '天津', region: '华北' },
    { name: '河北', region: '华北' }, { name: '山西', region: '华北' },
    { name: '内蒙古', region: '华北' }, { name: '辽宁', region: '东北' },
    { name: '吉林', region: '东北' }, { name: '黑龙江', region: '东北' },
    { name: '上海', region: '华东' }, { name: '江苏', region: '华东' },
    { name: '浙江', region: '华东' }, { name: '安徽', region: '华东' },
    { name: '福建', region: '华东' }, { name: '江西', region: '华东' },
    { name: '山东', region: '华东' }, { name: '河南', region: '华中' },
    { name: '湖北', region: '华中' }, { name: '湖南', region: '华中' },
    { name: '广东', region: '华南' }, { name: '广西', region: '华南' },
    { name: '海南', region: '海南' }, { name: '重庆', region: '西南' },
    { name: '四川', region: '西南' }, { name: '贵州', region: '西南' },
    { name: '云南', region: '西南' }, { name: '西藏', region: '西藏' },
    { name: '陕西', region: '西北' }, { name: '甘肃', region: '西北' },
    { name: '青海', region: '西北' }, { name: '宁夏', region: '西北' },
    { name: '新疆', region: '西北' }, { name: '台湾', region: '台湾' },
    { name: '香港', region: '华南' }, { name: '澳门', region: '华南' }
];

var currentData = {
    photos: [],
    bucketList: [],
    timeline: [],
    visitedProvinces: []
};

var loadedTables = {};
var dataLoadInProgress = false;

// Supabase snake_case → JS camelCase
function mapPhoto(p) {
    return { id: p.id, url: p.url, desc: p.description || '', uploadTime: p.upload_time, photoDate: p.photo_date || '' };
}
function mapBucket(b) {
    return { id: b.id, text: b.text, completed: b.completed };
}
function mapTimeline(t) {
    return { id: t.id, title: t.title, desc: t.description || '', date: t.date, time: t.time || '12:00' };
}
function mapProvince(v) {
    return { id: v.id, name: v.name, date: v.date };
}

async function loadData() {
    var sources = [
        ['photos', 'photos', 'id.desc', mapPhoto],
        ['bucket_list', 'bucketList', 'id.asc', mapBucket],
        ['timeline', 'timeline', 'date.desc', mapTimeline],
        ['visited_provinces', 'visitedProvinces', 'id.asc', mapProvince]
    ];
    loadedTables = {};
    await Promise.all(sources.map(async function (source) {
        try {
            var rows = await sbGet(source[0], 'select=*&order=' + source[2]);
            currentData[source[1]] = rows.map(source[3]);
            loadedTables[source[0]] = true;
        } catch (e) {
            loadedTables[source[0]] = false;
            console.error('加载 ' + source[0] + ' 失败:', e);
        }
    }));
    return sources.every(function (source) { return loadedTables[source[0]]; });
}

function showAlert(msg) {
    var el = document.getElementById('confirm-msg');
    var dlg = document.getElementById('confirm-dialog');
    if (!el || !dlg) { alert(msg); return; }
    el.textContent = msg;
    dlg.classList.remove('hidden');
    var cancelBtn = document.getElementById('confirm-cancel');
    if (cancelBtn) cancelBtn.style.display = 'none';
    dialogCallback = function () { hideConfirm(true); };
}

var STORAGE_URL = 'https://okpcwsianqkouitdwhvx.supabase.co/storage/v1/object/photos/';
var STORAGE_PUBLIC_URL = 'https://okpcwsianqkouitdwhvx.supabase.co/storage/v1/object/public/photos/';

function compressImage(file) {
    return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onerror = function () { console.error('[压缩] FileReader读取失败'); resolve(null); };
        reader.onload = function (e) {
            var img = new Image();
            img.onerror = function () { console.error('[压缩] 图片加载失败'); resolve(null); };
            img.onload = function () {
                try {
                    var maxW = 1200;
                    var maxH = 1200;
                    var w = img.width;
                    var h = img.height;
                    if (w > maxW || h > maxH) {
                        var ratio = Math.min(maxW / w, maxH / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    // 优先使用WebP格式（体积比JPEG小30%+）
                    var mimeType = 'image/webp';
                    var testData = canvas.toDataURL('image/webp', 0.01);
                    var supportsWebP = testData.indexOf('data:image/webp') === 0;
                    if (!supportsWebP) mimeType = 'image/jpeg';
                    var quality = supportsWebP ? 0.7 : 0.7;
                    canvas.toBlob(function (blob) {
                        if (!blob || blob.size === 0) {
                            console.error('[压缩] Blob为空');
                            resolve(null);
                        } else {
                            if (blob.size > 3 * 1024 * 1024) {
                                console.warn('[压缩] Blob超过3MB, 用更低质量重新压缩');
                                canvas.toBlob(function (b2) {
                                    resolve(b2 && b2.size > 0 ? b2 : null);
                                }, mimeType, 0.45);
                            } else {
                                resolve(blob);
                            }
                        }
                    }, mimeType, quality);
                } catch (err) {
                    console.error('[压缩] Canvas处理异常:', err.message);
                    resolve(null);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function extractStoragePath(url) {
    if (!url || url.indexOf(STORAGE_PUBLIC_URL) !== 0) return null;
    return url.substring(STORAGE_PUBLIC_URL.length);
}

async function uploadPhotoToStorage(blob) {
    var isWebP = blob.type === 'image/webp';
    var ext = isWebP ? '.webp' : '.jpg';
    var mime = isWebP ? 'image/webp' : 'image/jpeg';
    var filename = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + ext;
    try {
        var res = await siteFetch(STORAGE_URL + filename, {
            method: 'POST',
            headers: {
                'apikey': SB_KEY,
                'Authorization': 'Bearer ' + SB_KEY,
                'Content-Type': mime,
                'Cache-Control': 'max-age=31536000, immutable'
            },
            body: blob
        });
        if (!res.ok) {
            var errText = await res.text();
            console.error('Storage upload failed:', errText);
            return null;
        }
        return STORAGE_PUBLIC_URL + filename;
    } catch (err) {
        console.error('Storage upload error:', err.message);
        return null;
    }
}

async function deletePhotoFromStorage(url) {
    var path = extractStoragePath(url);
    if (!path) return;
    try {
        await siteFetch(STORAGE_URL + path, {
            method: 'DELETE',
            headers: {
                'apikey': SB_KEY,
                'Authorization': 'Bearer ' + SB_KEY
            }
        });
    } catch (err) {
        console.error('Storage delete error:', err.message);
    }
}

/* ========== 自定义弹窗 ========== */
var dialogCallback = null;
var dialogFieldDefs = null;

function showDialog(title, fields, callback) {
    try {
        dialogCallback = callback;
        dialogFieldDefs = fields;
        var titleEl = document.getElementById('dialog-title');
        if (!titleEl) return;
        titleEl.textContent = title;

        var body = document.getElementById('dialog-body');
        if (!body) return;
        body.innerHTML = '';
        [].forEach.call(fields, function (f) {
            var tag = f.type === 'textarea' ? 'textarea' : 'input';
            var typeAttr = '';
            if (f.type === 'date') typeAttr = ' type="date"';
            else if (f.type === 'time') typeAttr = ' type="time"';
            else typeAttr = ' type="text"';
            var input = document.createElement(tag);
            input.className = 'dialog-field';
            input.id = 'df-' + f.name;
            input.placeholder = f.placeholder || '';
            input.setAttribute('aria-label', f.placeholder || (f.name === 'date' || f.name === 'photoDate' ? '日期' : f.name === 'time' ? '时间' : f.name));
            if (tag === 'input') input.value = f.value || '';
            else input.textContent = f.value || '';
            if (typeAttr) {
                if (typeAttr.indexOf('date') !== -1) input.type = 'date';
                else if (typeAttr.indexOf('time') !== -1) input.type = 'time';
                else input.type = 'text';
            }
            body.appendChild(input);
        });

        var dialog = document.getElementById('custom-dialog');
        if (dialog) dialog.classList.remove('hidden');

        setTimeout(function () {
            var first = body.querySelector('.dialog-field');
            if (first) first.focus();
        }, 150);
    } catch (e) {
        var vals = {};
        [].forEach.call(fields, function (f) {
            vals[f.name] = prompt(f.placeholder || f.name);
        });
        if (callback) callback(vals);
    }
}

function hideDialog() {
    var d = document.getElementById('custom-dialog');
    if (d) d.classList.add('hidden');
    dialogCallback = null;
    dialogFieldDefs = null;
}

function confirmDialog() {
    if (!dialogCallback || !dialogFieldDefs) return;
    var result = {};
    [].forEach.call(dialogFieldDefs, function (f) {
        var el = document.getElementById('df-' + f.name);
        result[f.name] = el ? el.value : '';
    });
    var cb = dialogCallback;
    hideDialog();
    cb(result);
}

function showConfirm(msg, callback) {
    var el = document.getElementById('confirm-msg');
    var dlg = document.getElementById('confirm-dialog');
    if (!el || !dlg) { if (callback) callback(confirm(msg)); return; }
    el.textContent = msg;
    dlg.classList.remove('hidden');
    var cancelBtn = document.getElementById('confirm-cancel');
    if (cancelBtn) cancelBtn.style.display = '';
    dialogCallback = callback;
}

function hideConfirm(confirmed) {
    var dlg = document.getElementById('confirm-dialog');
    if (dlg) dlg.classList.add('hidden');
    var cb = dialogCallback;
    dialogCallback = null;
    if (cb) cb(confirmed);
}

/* ========== 认证 ========== */
function auth() {
    var pwd = document.getElementById('password-input');
    var btn = document.getElementById('auth-btn');
    if (!pwd || !btn) return;
    btn.addEventListener('click', async function () {
        var hash = await sha256(pwd.value);
        if (hash === PASSWORD_HASH) {
            var as = document.getElementById('auth-screen');
            var mc = document.getElementById('main-content');
            if (as) as.classList.add('hidden');
            if (mc) mc.classList.remove('hidden');
            initApp();
        } else {
            var err = document.getElementById('auth-error');
            if (err) err.textContent = '密码不正确，请重试';
            pwd.value = '';
            pwd.focus();
            setTimeout(function () { if (err) err.textContent = ''; }, 2000);
        }
    });
    pwd.addEventListener('keyup', function (e) {
        if (e.key === 'Enter') btn.click();
    });
}

/* ========== 问候语与计时器 ========== */
function updateGreeting() {
    var h = new Date().getHours();
    var t;
    if (h < 6) t = '夜深了，早点休息哦 💤';
    else if (h < 12) t = '早上好，新的一天也要元气满满 ✨';
    else if (h < 14) t = '中午好，记得按时吃饭 🍱';
    else if (h < 18) t = '下午好，今天辛苦了 ☕';
    else t = '晚上好，今天过得开心吗？ 💖';
    var el = document.getElementById('greeting');
    if (el) el.textContent = t;
}

function updateTimer() {
    var diff = new Date() - ANNIVERSARY;
    if (diff < 0) diff = 0;
    var setText = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(val).padStart(2, '0');
    };
    setText('days', Math.floor(diff / 86400000));
    setText('hours', Math.floor((diff % 86400000) / 3600000));
    setText('minutes', Math.floor((diff % 3600000) / 60000));
    setText('seconds', Math.floor((diff % 60000) / 1000));
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function formatDateTime(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
}

function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ========== 标签页 ========== */
var activeTab = 'timemachine';
function switchTab(name) {
    if (!document.getElementById(name)) return;
    activeTab = name;
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
        var selected = tab.dataset.tab === name;
        tab.classList.toggle('active', selected);
        if (selected) tab.setAttribute('aria-current', 'page');
        else tab.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) { panel.classList.toggle('hidden', panel.id !== name); });
    if (name === 'gallery') observeGalleryImages();
    if (name === 'map') ensureMap();
    window.scrollTo({ top: 0, behavior: 'instant' });
}
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
        tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
    });
    document.querySelectorAll('[data-jump]').forEach(function (button) {
        button.addEventListener('click', function () { switchTab(button.dataset.jump); });
    });
    document.getElementById('photo-sort').addEventListener('change', renderGallery);
    setupPhotoViewer();
    setupMapControls();
}
function updateHomeCounts() {
    var counts = {
        'home-photo-count': loadedTables.photos ? currentData.photos.length : '—',
        'home-wish-count': loadedTables.bucket_list ? currentData.bucketList.filter(function (b) { return b.completed; }).length : '—',
        'home-place-count': loadedTables.visited_provinces ? currentData.visitedProvinces.length : '—'
    };
    Object.keys(counts).forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = counts[id]; });
}
function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
}

/* ========== 时光相册：列表预览图，点开才读取原图 ========== */
var galleryObserver = null;
var displayedPhotos = [];
var viewerPhotoId = null;
function photoDateKey(photo) {
    var value = String(photo.photoDate || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}
function sortedPhotos(order) {
    return currentData.photos.slice().sort(function (a, b) {
        var ad = photoDateKey(a), bd = photoDateKey(b);
        if (!ad && bd) return 1;
        if (ad && !bd) return -1;
        var dateOrder = ad.localeCompare(bd);
        return (order === 'asc' ? dateOrder : -dateOrder) || Number(b.id) - Number(a.id);
    });
}
function thumbnailUrl(url) {
    var path = extractStoragePath(url);
    return path ? STORAGE_PUBLIC_URL + 'thumbnails/v1/' + path + '.webp' : url;
}
function loadGalleryImage(img) {
    if (!img.dataset.src) return;
    var src = img.dataset.src;
    delete img.dataset.src;
    img.addEventListener('load', function () { img.classList.add('is-loaded'); });
    img.addEventListener('error', function () {
        if (img.dataset.original && !img.dataset.fallback) {
            img.dataset.fallback = 'true';
            img.src = img.dataset.original;
        } else {
            img.classList.add('image-error', 'is-loaded');
        }
    });
    img.src = src;
}
function observeGalleryImages() {
    if (activeTab !== 'gallery') return;
    if (galleryObserver) galleryObserver.disconnect();
    var images = document.querySelectorAll('.photo-image[data-src]');
    if (!('IntersectionObserver' in window)) {
        images.forEach(loadGalleryImage);
        return;
    }
    galleryObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) { loadGalleryImage(entry.target); galleryObserver.unobserve(entry.target); }
        });
    }, { rootMargin: '200px 0px' });
    images.forEach(function (img) { galleryObserver.observe(img); });
}
function renderGallery() {
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;
    if (galleryObserver) galleryObserver.disconnect();
    var sort = document.getElementById('photo-sort');
    displayedPhotos = sortedPhotos(sort ? sort.value : 'desc');
    var counter = document.getElementById('photo-count');
    if (counter) counter.textContent = loadedTables.photos ? displayedPhotos.length + ' 张被珍藏的瞬间' : '照片暂时读取失败';
    if (displayedPhotos.length === 0) {
        grid.innerHTML = '<div class="empty-state">♡<p>' + (loadedTables.photos ? '还没有照片，记录我们的第一个瞬间吧。' : '暂时无法读取照片，请点击上方重试连接。') + '</p></div>';
        updateHomeCounts();
        return;
    }
    var lastMonth = null;
    var html = '';
    displayedPhotos.forEach(function (photo, index) {
        var date = photoDateKey(photo);
        var month = date ? date.slice(0, 7) : 'undated';
        if (month !== lastMonth) {
            var title = date ? date.slice(0, 4) + ' 年 ' + Number(date.slice(5, 7)) + ' 月' : '待补拍摄日期';
            var count = displayedPhotos.filter(function (item) { var key = photoDateKey(item); return (key ? key.slice(0, 7) : 'undated') === month; }).length;
            html += '<div class="album-month"><h3>' + title + '</h3><span>' + count + ' 个瞬间</span></div>';
            lastMonth = month;
        }
        html += '<article class="photo-card" data-photo-id="' + photo.id + '">' +
            '<button class="photo-delete-btn" onclick="deletePhoto(' + photo.id + ')" aria-label="删除照片"><svg class="close-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6L18 18M18 6L6 18"/></svg></button>' +
            '<button class="photo-open" onclick="openPhoto(' + photo.id + ')" aria-label="查看照片原图">' +
            '<img data-src="' + escapeHtml(photoDeliveryUrl(thumbnailUrl(photo.url))) + '" data-original="' + escapeHtml(photoDeliveryUrl(photo.url)) + '" alt="' + escapeHtml(photo.desc || '我们的照片') + '" class="photo-image"' + (extractStoragePath(photo.url) ? ' crossorigin="anonymous"' : '') + ' decoding="async" width="640" height="800"></button>' +
            '<div class="photo-info"><p class="photo-desc-text ' + (photo.desc ? '' : 'photo-desc-empty') + '" role="button" tabindex="0" onclick="editPhotoDesc(' + photo.id + ')" onkeydown="if(event.key===\'Enter\')editPhotoDesc(' + photo.id + ')">' + escapeHtml(photo.desc || '为这一刻写点什么…') + '</p>' +
            '<div class="photo-meta"><button class="photo-date-item" onclick="editPhotoDate(' + photo.id + ')" aria-label="修改拍摄日期">' + (date ? date.replace(/-/g, ' . ') : '＋ 补充拍摄日期') + '</button><span class="photo-number">' + String(index + 1).padStart(2, '0') + '</span></div></div></article>';
    });
    grid.innerHTML = html;
    observeGalleryImages();
    updateHomeCounts();
}
function openPhoto(id) {
    var photo = currentData.photos.find(function (item) { return item.id === id; });
    if (!photo) return;
    viewerPhotoId = id;
    var viewer = document.getElementById('photo-viewer');
    var img = document.getElementById('viewer-image');
    var status = document.getElementById('viewer-status');
    status.textContent = '正在读取原图…';
    img.onload = function () { status.textContent = (displayedPhotos.findIndex(function (p) { return p.id === id; }) + 1) + ' / ' + displayedPhotos.length; };
    img.onerror = function () { status.textContent = '原图读取失败，请稍后重新打开。'; };
    img.alt = photo.desc || '我们的照片';
    img.src = photoDeliveryUrl(photo.url);
    document.getElementById('viewer-caption').textContent = (photoDateKey(photo) || '拍摄日期待补充') + (photo.desc ? ' · ' + photo.desc : '');
    if (!viewer.open) viewer.showModal();
    document.body.style.overflow = 'hidden';
}
function navigatePhoto(delta) {
    var index = displayedPhotos.findIndex(function (p) { return p.id === viewerPhotoId; });
    if (index < 0 || !displayedPhotos.length) return;
    openPhoto(displayedPhotos[(index + delta + displayedPhotos.length) % displayedPhotos.length].id);
}
function setupPhotoViewer() {
    var viewer = document.getElementById('photo-viewer');
    document.getElementById('viewer-close').addEventListener('click', function () { viewer.close(); });
    document.getElementById('viewer-prev').addEventListener('click', function () { navigatePhoto(-1); });
    document.getElementById('viewer-next').addEventListener('click', function () { navigatePhoto(1); });
    viewer.addEventListener('close', function () { document.body.style.overflow = ''; document.getElementById('viewer-image').removeAttribute('src'); });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close(); });
    viewer.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePhoto(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); navigatePhoto(1); }
    });
}

async function deletePhoto(id) {
    showConfirm('确定删除这张照片吗？', async function (ok) {
        if (ok) {
            var photo = currentData.photos.find(function (p) { return p.id === id; });
            if (!await sbDelete('photos', 'id', id)) { showAlert('删除失败，照片已保留，请稍后重试。'); return; }
            if (photo) { await deletePhotoFromStorage(photo.url); await deletePhotoFromStorage(thumbnailUrl(photo.url)); }
            currentData.photos = currentData.photos.filter(function (p) { return p.id !== id; });
            renderGallery();
        }
    });
}

async function editPhotoDesc(id) {
    var photo = currentData.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    showDialog('编辑配文', [
        { name: 'desc', type: 'textarea', placeholder: '为这张照片配一段文字...', value: photo.desc || '' }
    ], async function (r) {
        var desc = (r.desc || '').trim();
        if (!await sbUpdate('photos', 'id', id, { description: desc })) { showAlert('配文未保存，请稍后重试。'); return; }
        photo.desc = desc;
        renderGallery();
    });
}

async function editPhotoDate(id) {
    var photo = currentData.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    showDialog('拍摄日期', [
        { name: 'date', type: 'date', placeholder: '选择拍摄日期', value: photo.photoDate || todayStr() }
    ], async function (r) {
        var date = r.date || '';
        if (!await sbUpdate('photos', 'id', id, { photo_date: date || null })) { showAlert('拍摄日期未保存，请稍后重试。'); return; }
        photo.photoDate = date;
        renderGallery();
    });
}

function makeThumbnail(blob) {
    return new Promise(function (resolve) {
        var url = URL.createObjectURL(blob);
        var image = new Image();
        image.onload = function () {
            try {
                var scale = Math.min(1, 640 / Math.max(image.width, image.height));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(function (result) { URL.revokeObjectURL(url); resolve(result); }, 'image/webp', 0.72);
            } catch (e) { URL.revokeObjectURL(url); resolve(null); }
        };
        image.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        image.src = url;
    });
}
async function uploadThumbnail(blob, originalUrl) {
    var thumbnail = await makeThumbnail(blob);
    if (!thumbnail) return false;
    var path = extractStoragePath(thumbnailUrl(originalUrl));
    try {
        var result = await siteFetch(STORAGE_URL + path, {
            method: 'POST',
            headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': thumbnail.type, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
            body: thumbnail
        });
        return result.ok;
    } catch (e) { return false; }
}
var photoUploadInProgress = false;
function setupPhotoUpload() {
    var input = document.getElementById('photo-upload');
    input.addEventListener('change', function (e) {
        var file = e.target.files[0];
        input.value = '';
        if (!file || photoUploadInProgress) return;
        if (file.size > 30 * 1024 * 1024) { showAlert('请先选择一张小于 30MB 的照片。'); return; }
        showDialog('收藏一个新瞬间', [
            { name: 'desc', type: 'textarea', placeholder: '为这张照片配一段文字…' },
            { name: 'photoDate', type: 'date', placeholder: '这张照片是哪天拍的？', value: todayStr() }
        ], async function (fields) {
            if (photoUploadInProgress) return;
            photoUploadInProgress = true;
            var button = document.getElementById('upload-btn');
            var status = document.getElementById('upload-status');
            button.disabled = true;
            status.classList.remove('hidden');
            try {
                status.textContent = '正在整理照片…';
                var blob = await compressImage(file);
                if (!blob) throw new Error('无法处理这张照片，请尝试 JPG、PNG 或 WebP 格式。');
                status.textContent = '正在上传照片…';
                var url = await uploadPhotoToStorage(blob);
                if (!url) throw new Error('照片上传失败，请检查网络后重试。');
                status.textContent = '正在保存拍摄日期和配文…';
                var result = await sbInsert('photos', { url: url, description: (fields.desc || '').trim(), upload_time: new Date().toISOString(), photo_date: fields.photoDate || null });
                if (!result || !result.length) {
                    // 不删除可能已成功写入的文件；连接恢复后可继续核对记录。
                    throw new Error('照片文件已上传，但记录保存未确认。请先重试连接查看相册，避免重复上传。');
                }
                status.textContent = '正在准备相册预览…';
                var thumbnailReady = await uploadThumbnail(blob, url);
                currentData.photos.unshift(mapPhoto(result[0]));
                renderGallery();
                status.textContent = thumbnailReady ? '已收藏，照片会按拍摄日期排好。' : '照片已收藏，预览图暂未生成，将使用原图显示。';
            } catch (error) {
                status.textContent = error.message;
                showAlert(error.message);
            } finally { photoUploadInProgress = false; button.disabled = false; }
        });
    });
}

/* ========== 愿望清单 ========== */
function renderBucketList() {
    updateHomeCounts();
    var completed = currentData.bucketList.filter(function (i) { return i.completed; }).length;
    var total = currentData.bucketList.length;
    var pct = total > 0 ? (completed / total) * 100 : 0;

    var el;
    el = document.getElementById('completed-count'); if (el) el.textContent = completed;
    el = document.getElementById('total-count'); if (el) el.textContent = total;
    el = document.getElementById('progress-fill'); if (el) el.style.width = pct + '%';

    var list = document.getElementById('bucket-list');
    if (!list) return;
    if (total === 0) {
        list.innerHTML = '<div class="empty-state">📋<p>还没有愿望，快去添加吧 ✨</p></div>';
        return;
    }
    var html = '';
    [].forEach.call(currentData.bucketList, function (item) {
        html += '<li class="bucket-item">' +
            '<button class="bucket-checkbox ' + (item.completed ? 'checked' : '') + '" aria-label="切换愿望完成状态" aria-pressed="' + item.completed + '" onclick="toggleBucket(' + item.id + ')"></button>' +
            '<span class="bucket-text ' + (item.completed ? 'completed' : '') + '">' + item.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
            '<div class="bucket-actions">' +
                '<button class="bucket-action-btn bucket-edit-btn" onclick="editBucket(' + item.id + ')">✏️</button>' +
                '<button class="bucket-action-btn bucket-delete-btn" onclick="deleteBucket(' + item.id + ')">🗑️</button>' +
            '</div>' +
        '</li>';
    });
    list.innerHTML = html;
}

async function toggleBucket(id) {
    var item = currentData.bucketList.find(function (i) { return i.id === id; });
    if (!item) return;
    var newVal = !item.completed;
    if (!await sbUpdate('bucket_list', 'id', id, { completed: newVal })) { showAlert('更新失败，请稍后重试。'); return; }
    item.completed = newVal;
    renderBucketList();
}

async function editBucket(id) {
    var item = currentData.bucketList.find(function (i) { return i.id === id; });
    if (!item) return;
    showDialog('编辑愿望', [
        { name: 'text', placeholder: '愿望内容', value: item.text }
    ], async function (r) {
        if (!r.text || !r.text.trim()) return;
        var text = r.text.trim();
        if (!await sbUpdate('bucket_list', 'id', id, { text: text })) { showAlert('愿望未保存，请稍后重试。'); return; }
        item.text = text;
        renderBucketList();
    });
}

async function deleteBucket(id) {
    showConfirm('确定删除这个愿望吗？', async function (ok) {
        if (ok) {
            if (!await sbDelete('bucket_list', 'id', id)) { showAlert('删除失败，愿望已保留。'); return; }
            currentData.bucketList = currentData.bucketList.filter(function (i) { return i.id !== id; });
            renderBucketList();
        }
    });
}

async function addBucket() {
    showDialog('添加新愿望', [
        { name: 'text', placeholder: '输入你的愿望...' }
    ], async function (r) {
        if (!r.text || !r.text.trim()) return;
        var res = await sbInsert('bucket_list', { text: r.text.trim(), completed: false });
        if (res && res.length > 0) {
            currentData.bucketList.push(mapBucket(res[0]));
        } else { showAlert('愿望未保存，请稍后重试。'); return; }
        renderBucketList();
    });
}

/* ========== 时间轴 ========== */
function renderTimeline() {
    var container = document.getElementById('timeline-container');
    if (!container) return;
    if (currentData.timeline.length === 0) {
        container.innerHTML = '<div class="empty-state">⏰<p>还没有记录，快去添加吧 💕</p></div>';
        return;
    }

    var sorted = currentData.timeline.slice().sort(function (a, b) {
        return new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'));
    });

    var html = '';
    [].forEach.call(sorted, function (item) {
        html += '<div class="timeline-item">' +
            '<div class="timeline-dot"></div>' +
            '<div class="timeline-content">' +
                '<div class="timeline-date">' + escapeHtml(item.date) + ' ' + escapeHtml(item.time || '') + '</div>' +
                '<div class="timeline-title">' + item.title.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
                '<div class="timeline-desc">' + (item.desc || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
                '<div class="timeline-actions">' +
                    '<button class="timeline-action-btn timeline-edit-btn" onclick="editTimelineEvent(' + item.id + ')">✏️ 编辑</button>' +
                    '<button class="timeline-action-btn timeline-delete-btn" onclick="deleteTimelineEvent(' + item.id + ')">🗑️ 删除</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;
}

async function addTimelineEvent() {
    var today = todayStr();
    showDialog('添加恋爱事件', [
        { name: 'title', placeholder: '事件标题' },
        { name: 'desc', type: 'textarea', placeholder: '事件描述' },
        { name: 'date', type: 'date', value: today },
        { name: 'time', type: 'time', value: '12:00' }
    ], async function (r) {
        if (!r.title || !r.title.trim()) return;
        var res = await sbInsert('timeline', {
            title: r.title.trim(),
            description: (r.desc || '').trim() || '暂无描述',
            date: r.date || today,
            time: r.time || '12:00'
        });
        if (res && res.length > 0) {
            currentData.timeline.push(mapTimeline(res[0]));
        } else { showAlert('事件未保存，请稍后重试。'); return; }
        renderTimeline();
    });
}

async function editTimelineEvent(id) {
    var item = currentData.timeline.find(function (i) { return i.id === id; });
    if (!item) return;
    showDialog('编辑恋爱事件', [
        { name: 'title', placeholder: '事件标题', value: item.title },
        { name: 'desc', type: 'textarea', placeholder: '事件描述', value: item.desc || '' },
        { name: 'date', type: 'date', value: item.date },
        { name: 'time', type: 'time', value: item.time || '12:00' }
    ], async function (r) {
        if (!r.title || !r.title.trim()) return;
        var updates = {
            title: r.title.trim(),
            description: (r.desc || '').trim() || '暂无描述',
            date: r.date || item.date,
            time: r.time || '12:00'
        };
        if (!await sbUpdate('timeline', 'id', id, updates)) { showAlert('事件未保存，请稍后重试。'); return; }
        item.title = updates.title;
        item.desc = updates.description;
        item.date = updates.date;
        item.time = updates.time;
        renderTimeline();
    });
}

async function deleteTimelineEvent(id) {
    showConfirm('确定删除这个事件吗？', async function (ok) {
        if (ok) {
            if (!await sbDelete('timeline', 'id', id)) { showAlert('删除失败，事件已保留。'); return; }
            currentData.timeline = currentData.timeline.filter(function (i) { return i.id !== id; });
            renderTimeline();
        }
    });
}

/* ========== 足迹地图 ========== */
var mapReady = false;
var mapLoading = false;
var mapZoom = 1;
var mapPan = { x: 0, y: 0 };
var mapDragged = false;
function svgNode(tag, attributes) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    return node;
}
async function ensureMap() {
    if (mapReady || mapLoading) return;
    mapLoading = true;
    var container = document.getElementById('china-map');
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    try {
        var response = await fetch('assets/china-map.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Map unavailable');
        var data = await response.json();
        var svg = svgNode('svg', { viewBox: data.viewBox, 'aria-label': '点击省份记录旅行日期' });
        var layer = svgNode('g', { id: 'map-layer' });
        layer.appendChild(svgNode('rect', { x: 728, y: 380, width: 112, height: 177, rx: 6, class: 'map-inset-box' }));
        var insetTitle = svgNode('text', { x: 740, y: 549, class: 'map-inset-title' });
        insetTitle.textContent = '南海诸岛';
        layer.appendChild(insetTitle);
        data.features.forEach(function (feature) {
            var group = svgNode('g', feature.name ? { 'data-province': feature.name, role: 'button', tabindex: 0, 'aria-label': feature.name, class: 'map-location' } : {});
            if (feature.path) group.appendChild(svgNode('path', { d: feature.path, class: feature.name ? 'map-region' : 'map-border', 'data-name': feature.name }));
            if (feature.inset) group.appendChild(svgNode('path', { d: feature.inset, class: feature.name ? 'map-region' : 'map-border', 'data-name': feature.name }));
            var title = svgNode('title'); title.textContent = feature.name || '南海诸岛'; group.appendChild(title);
            layer.appendChild(group);
        });
        data.features.forEach(function (feature) {
            if (!feature.name || !feature.label) return;
            var position = feature.label.slice();
            var offsets = { '北京': [-3, -9], '天津': [20, 7], '河北': [-12, 16], '香港': [21, 0], '澳门': [-14, 12], '上海': [18, 0], '海南': [0, 6] };
            var offset = offsets[feature.name] || [0, 0];
            var label = svgNode('text', { x: position[0] + offset[0], y: position[1] + offset[1], class: 'map-label', 'data-name': feature.name });
            label.textContent = feature.name;
            layer.appendChild(label);
        });
        svg.appendChild(layer);
        container.replaceChildren(svg);
        function selected(e) {
            var region = e.target.closest('[data-province]');
            if (!region || mapDragged) return;
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            if (e.type === 'keydown') e.preventDefault();
            markProvince(region.dataset.province);
        }
        svg.addEventListener('click', selected);
        svg.addEventListener('keydown', selected);
        svg.addEventListener('pointerover', function (e) {
            var region = e.target.closest('[data-province]');
            if (!region) return;
            var name = region.dataset.province;
            var visit = currentData.visitedProvinces.find(function (p) { return p.name === name; });
            document.getElementById('map-hint').textContent = visit ? name + ' · ' + visit.date + '，我们来过' : name + ' · 点击记录我们的旅程';
        });
        var drag = null;
        svg.addEventListener('pointerdown', function (e) {
            mapDragged = false;
            if (mapZoom === 1) return;
            drag = { x: e.clientX, y: e.clientY, px: mapPan.x, py: mapPan.y };
            svg.setPointerCapture(e.pointerId);
        });
        svg.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) mapDragged = true;
            var ratio = 900 / svg.getBoundingClientRect().width;
            mapPan.x = drag.px + dx * ratio;
            mapPan.y = drag.py + dy * ratio;
            transformMap();
        });
        svg.addEventListener('pointerup', function (e) {
            if (drag && !mapDragged) {
                // Pointer capture retargets clicks; resolve the tapped province before release.
                svg.releasePointerCapture(e.pointerId);
                var target = document.elementFromPoint(e.clientX, e.clientY);
                var region = target && target.closest('[data-province]');
                if (region) { markProvince(region.dataset.province); mapDragged = true; }
            }
            drag = null;
        });
        svg.addEventListener('pointercancel', function () { drag = null; });
        mapReady = true;
        updateMapHighlights();
    } catch (error) {
        container.innerHTML = '<p class="map-loading">地图暂时未展开，<button type="button" id="map-retry">点击重试</button><br>也可以在下方按名称选择省份。</p>';
        document.getElementById('map-retry').addEventListener('click', ensureMap);
    } finally { clearTimeout(timeout); mapLoading = false; }
}
function updateMapHighlights() {
    document.querySelectorAll('#china-map [data-name]').forEach(function (element) {
        var visited = currentData.visitedProvinces.some(function (p) { return p.name === element.dataset.name; });
        element.classList.toggle('visited', visited);
    });
    document.querySelectorAll('#china-map [data-province]').forEach(function (element) {
        var visited = currentData.visitedProvinces.some(function (p) { return p.name === element.dataset.province; });
        element.setAttribute('aria-pressed', String(visited));
        element.setAttribute('aria-label', element.dataset.province + (visited ? '，已点亮，编辑日期' : '，点击点亮'));
    });
}
function transformMap() {
    var layer = document.getElementById('map-layer');
    if (!layer) return;
    var maxX = 450 * (mapZoom - 1), maxY = 290 * (mapZoom - 1);
    mapPan.x = Math.max(-maxX, Math.min(maxX, mapPan.x));
    mapPan.y = Math.max(-maxY, Math.min(maxY, mapPan.y));
    layer.setAttribute('transform', 'translate(' + (450 + mapPan.x) + ' ' + (290 + mapPan.y) + ') scale(' + mapZoom + ') translate(-450 -290)');
    layer.ownerSVGElement.style.touchAction = mapZoom > 1 ? 'none' : 'pan-y';
}
function setupMapControls() {
    document.getElementById('map-zoom-in').addEventListener('click', function () { mapZoom = Math.min(3, mapZoom + 0.5); transformMap(); });
    document.getElementById('map-zoom-out').addEventListener('click', function () { mapZoom = Math.max(1, mapZoom - 0.5); transformMap(); });
    document.getElementById('map-reset').addEventListener('click', function () { mapZoom = 1; mapPan = { x: 0, y: 0 }; transformMap(); });
}


function renderMap() {
    var el;
    el = document.getElementById('map-count');
    if (el) el.textContent = loadedTables.visited_provinces ? currentData.visitedProvinces.length : '—';

    updateMapHighlights();
    updateHomeCounts();

    var pg = document.getElementById('province-grid');
    if (pg) {
        var pgHtml = '';
        [].forEach.call(PROVINCES, function (p) {
            var v = currentData.visitedProvinces.some(function (x) { return x.name === p.name; });
            pgHtml += '<button class="province-tag ' + (v ? 'visited' : '') + '" onclick="markProvince(\'' + p.name + '\')">' + p.name + '</button>';
        });
        pg.innerHTML = pgHtml;
    }

    var vl = document.getElementById('visited-provinces');
    if (!vl) return;
    if (currentData.visitedProvinces.length === 0) {
        vl.innerHTML = '<li style="text-align:center;padding:20px;color:#A09086;">下一站，想和你一起去哪里？点击地图留下足迹。</li>';
        return;
    }
    var sorted = currentData.visitedProvinces.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var vlHtml = '';
    [].forEach.call(sorted, function (item) {
        vlHtml += '<li class="visited-item">' +
            '<span class="visited-name">' + item.name + '</span>' +
            '<div class="visited-item-right">' +
                '<span class="visited-date">' + escapeHtml(item.date || '') + '</span>' +
                '<button class="delete-province-btn" onclick="removeProvince(\'' + item.name + '\')">🗑️</button>' +
            '</div>' +
        '</li>';
    });
    vl.innerHTML = vlHtml;
}

async function markProvince(name) {
    var existing = currentData.visitedProvinces.find(function (p) { return p.name === name; });
    showDialog(existing ? '编辑「' + name + '」' : '点亮「' + name + '」', [
        { name: 'date', type: 'date', value: existing ? existing.date : todayStr() }
    ], async function (r) {
        if (!r.date) return;
        if (existing) {
            if (!await sbUpdate('visited_provinces', 'name', name, { date: r.date })) { showAlert('足迹日期未保存，请稍后重试。'); return; }
            existing.date = r.date;
        } else {
            var res = await sbInsert('visited_provinces', { name: name, date: r.date });
            if (res && res.length > 0) {
                currentData.visitedProvinces.push(mapProvince(res[0]));
            } else { showAlert('足迹未保存，请稍后重试。'); return; }
        }
        renderMap();
    });
}

async function removeProvince(name) {
    showConfirm('确定删除「' + name + '」的足迹吗？', async function (ok) {
        if (ok) {
            if (!await sbDelete('visited_provinces', 'name', name)) { showAlert('删除失败，足迹已保留。'); return; }
            currentData.visitedProvinces = currentData.visitedProvinces.filter(function (p) { return p.name !== name; });
            renderMap();
        }
    });
}

/* ========== 弹窗事件绑定 ========== */
function setupDialogs() {
    var dlgOk = document.getElementById('dialog-ok');
    var dlgCancel = document.getElementById('dialog-cancel');
    var dlgClose = document.getElementById('dialog-close');
    var customDlg = document.getElementById('custom-dialog');

    if (dlgOk) dlgOk.addEventListener('click', confirmDialog);
    if (dlgCancel) dlgCancel.addEventListener('click', hideDialog);
    if (dlgClose) dlgClose.addEventListener('click', hideDialog);
    if (customDlg) {
        customDlg.addEventListener('click', function (e) {
            if (e.target === customDlg) hideDialog();
        });
    }

    var cfmOk = document.getElementById('confirm-ok');
    var cfmCancel = document.getElementById('confirm-cancel');
    var cfmClose = document.getElementById('confirm-close');
    var cfmDlg = document.getElementById('confirm-dialog');

    if (cfmOk) cfmOk.addEventListener('click', function () { hideConfirm(true); });
    if (cfmCancel) cfmCancel.addEventListener('click', function () { hideConfirm(false); });
    if (cfmClose) cfmClose.addEventListener('click', function () { hideConfirm(false); });
    if (cfmDlg) {
        cfmDlg.addEventListener('click', function (e) {
            if (e.target === cfmDlg) hideConfirm(false);
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (customDlg && !customDlg.classList.contains('hidden')) hideDialog();
            if (cfmDlg && !cfmDlg.classList.contains('hidden')) hideConfirm(false);
        }
    });
}

/* ========== 初始化 ========== */
async function refreshData() {
    if (dataLoadInProgress) return;
    dataLoadInProgress = true;
    var status = document.getElementById('data-status');
    var message = document.getElementById('data-status-message');
    var retry = document.getElementById('data-retry');
    if (status) status.classList.remove('hidden');
    if (message) message.textContent = '正在连接，读取你们的回忆…';
    if (retry) retry.disabled = true;
    try {
        var loaded = await loadData();
        // 已有项目只读取记录，不自动写入示例数据。
        renderGallery();
        renderBucketList();
        renderTimeline();
        renderMap();
        updateHomeCounts();
        if (loaded) {
            if (status) status.classList.add('hidden');
        } else if (message) {
            message.textContent = '部分回忆暂时读取失败，可能是网络连接或服务暂时不可用。这不代表记录已删除，请点“重试连接”。';
        }
    } finally {
        dataLoadInProgress = false;
        if (retry) retry.disabled = false;
    }
}

async function initApp() {
    updateGreeting();
    updateTimer();
    setInterval(updateTimer, 1000);
    setupDialogs();
    initTabs();
    setupPhotoUpload();

    var retry = document.getElementById('data-retry');
    if (retry) retry.addEventListener('click', refreshData);
    await refreshData();
}

document.addEventListener('DOMContentLoaded', function () {
    auth();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
        navigator.serviceWorker.register('./sw.js').catch(function () { /* 预览图缓存不可用时正常联网加载。 */ });
    }
});
