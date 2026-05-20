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
    try {
        var res = await fetch(SB_URL + '/' + table + qs, { method: 'GET', headers: sbHeaders() });
        if (!res.ok) { var e = await res.text(); console.error('GET ' + table + ': ' + e); return []; }
        return res.json();
    } catch (err) { console.error('GET ' + table + ': ' + err.message); return []; }
}

async function sbInsert(table, data) {
    try {
        var res = await fetch(SB_URL + '/' + table, {
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
        var res = await fetch(SB_URL + '/' + table + '?' + qs, {
            method: 'PATCH',
            headers: Object.assign({ 'Prefer': 'return=representation' }, sbHeaders()),
            body: JSON.stringify(data)
        });
        if (!res.ok) { var e = await res.text(); console.error('UPDATE ' + table + ': ' + e); return false; }
        return true;
    } catch (err) { console.error('UPDATE ' + table + ': ' + err.message); return false; }
}

async function sbDelete(table, filterCol, filterVal) {
    try {
        var qs = encodeURIComponent(filterCol) + '=eq.' + encodeURIComponent(filterVal);
        var res = await fetch(SB_URL + '/' + table + '?' + qs, {
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

var initData = {
    bucketList: [
        { text: '一起去看一次日出', completed: true },
        { text: '一起去海边看星星', completed: false },
        { text: '一起学做一道菜', completed: false },
        { text: '一起去旅行一次', completed: false },
        { text: '一起养一盆小植物', completed: false }
    ],
    timeline: [
        { title: '第一次相遇', description: '在朋友聚会上，我们第一次见面', date: '2026-03-15', time: '19:00' },
        { title: '确定关系', description: '向彼此表白了，我们正式在一起了', date: '2026-04-10', time: '20:30' }
    ]
};

var currentData = {
    photos: [],
    bucketList: [],
    timeline: [],
    visitedProvinces: []
};

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
    try {
        var photosData = await sbGet('photos', 'select=*&order=id.desc');
        currentData.photos = (photosData || []).map(mapPhoto);
    } catch (e) { console.error('加载照片失败:', e); }

    try {
        var bucketData = await sbGet('bucket_list', 'select=*&order=id.asc');
        currentData.bucketList = (bucketData || []).map(mapBucket);
    } catch (e) { console.error('加载愿望清单失败:', e); }

    try {
        var timelineData = await sbGet('timeline', 'select=*&order=date.desc');
        currentData.timeline = (timelineData || []).map(mapTimeline);
    } catch (e) { console.error('加载时间轴失败:', e); }

    try {
        var provincesData = await sbGet('visited_provinces', 'select=*&order=id.asc');
        currentData.visitedProvinces = (provincesData || []).map(mapProvince);
    } catch (e) { console.error('加载足迹失败:', e); }
}

// 首次使用填充默认数据
async function seedIfEmpty() {
    try {
        if (currentData.bucketList.length === 0 && initData.bucketList.length > 0) {
            var items = initData.bucketList.map(function (b) {
                return { text: b.text, completed: b.completed };
            });
            var res = await sbInsert('bucket_list', items);
            if (res) { currentData.bucketList = res.map(mapBucket); }
        }
    } catch (e) {}

    try {
        if (currentData.timeline.length === 0 && initData.timeline.length > 0) {
            var items = initData.timeline.map(function (t) {
                return { title: t.title, description: t.description, date: t.date, time: t.time };
            });
            var res = await sbInsert('timeline', items);
            if (res) { currentData.timeline = res.map(mapTimeline); }
        }
    } catch (e) {}
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
                    var supportsWebP = testData.indexOf('image/webp') === 0;
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
        var res = await fetch(STORAGE_URL + filename, {
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
        await fetch(STORAGE_URL + path, {
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
    return new Date().toISOString().split('T')[0];
}

/* ========== 标签页 ========== */
function initTabs() {
    var tabs = document.querySelectorAll('.tab-btn');
    var panels = document.querySelectorAll('.tab-panel');
    [].forEach.call(tabs, function (tab) {
        tab.addEventListener('click', function () {
            var t = tab.dataset.tab;
            [].forEach.call(tabs, function (x) { x.classList.remove('active'); });
            [].forEach.call(panels, function (x) { x.classList.add('hidden'); });
            tab.classList.add('active');
            var panel = document.getElementById(t);
            if (panel) panel.classList.remove('hidden');
        });
    });
}

/* ========== 时光相册 ========== */
function renderGallery() {
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;
    if (currentData.photos.length === 0) {
        grid.innerHTML = '<div class="empty-state">🖼️<p>还没有照片，快去上传吧 📸</p></div>';
        return;
    }
    var html = '';
    [].forEach.call(currentData.photos, function (p) {
        var uploadTime = p.uploadTime ? '<div class="photo-meta-item">☁️ 上传于 ' + formatDateTime(p.uploadTime) + '</div>' : '';
        var photoDate = p.photoDate
            ? '<div class="photo-meta-item photo-date-item" onclick="editPhotoDate(' + p.id + ')">📷 拍摄于 ' + p.photoDate + '</div>'
            : '<div class="photo-meta-item photo-date-item photo-date-empty" onclick="editPhotoDate(' + p.id + ')">📷 点击添加拍摄日期</div>';
        var descHtml = p.desc
            ? '<p class="photo-desc-text" onclick="editPhotoDesc(' + p.id + ')">' + p.desc.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>'
            : '<p class="photo-desc-text photo-desc-empty" onclick="editPhotoDesc(' + p.id + ')">点击添加配文...</p>';

        html += '<div class="photo-card">' +
            '<button class="photo-delete-btn" onclick="deletePhoto(' + p.id + ')" title="删除">🗑️</button>' +
            '<img src="' + p.url + '" alt="" class="photo-image" loading="lazy" decoding="async">' +
            '<div class="photo-info">' +
                descHtml +
                '<div class="photo-meta">' + uploadTime + photoDate + '</div>' +
            '</div>' +
        '</div>';
    });
    grid.innerHTML = html;
}

async function deletePhoto(id) {
    showConfirm('确定删除这张照片吗？', async function (ok) {
        if (ok) {
            var photo = currentData.photos.find(function (p) { return p.id === id; });
            if (photo) await deletePhotoFromStorage(photo.url);
            await sbDelete('photos', 'id', id);
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
        await sbUpdate('photos', 'id', id, { description: desc });
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
        await sbUpdate('photos', 'id', id, { photo_date: date });
        photo.photoDate = date;
        renderGallery();
    });
}

function setupPhotoUpload() {
    var fileInput = document.getElementById('photo-upload');
    if (!fileInput) return;
    fileInput.addEventListener('change', async function (e) {
        var file = e.target.files[0];
        if (!file) return;
        console.log('[上传] 开始处理图片:', file.name, '大小:', (file.size / 1024).toFixed(1) + 'KB');
        var blob = await compressImage(file);
        if (!blob) { console.error('[上传] 图片压缩失败'); showAlert('图片处理失败，请重试'); return; }
        console.log('[上传] 压缩完成, Blob大小:', (blob.size / 1024).toFixed(1) + 'KB');
        console.log('[上传] 正在上传到Supabase Storage...');
        var publicUrl = await uploadPhotoToStorage(blob);
        if (!publicUrl) { console.error('[上传] Storage上传失败'); showAlert('图片上传失败，请检查网络后重试'); return; }
        console.log('[上传] Storage上传成功, URL:', publicUrl);
        showDialog('为照片添加信息', [
            { name: 'desc', type: 'textarea', placeholder: '为这张照片配一段文字...' },
            { name: 'photoDate', type: 'date', placeholder: '拍摄日期', value: todayStr() }
        ], async function (r) {
            console.log('[上传] 正在写入数据库...');
            var res = await sbInsert('photos', {
                url: publicUrl,
                description: (r.desc || '').trim(),
                upload_time: new Date().toISOString(),
                photo_date: r.photoDate || ''
            });
            console.log('[上传] 数据库写入结果:', res);
            if (res && res.length > 0) {
                currentData.photos.unshift(mapPhoto(res[0]));
                console.log('[上传] ✅ 照片已成功保存到数据库!');
            } else {
                console.error('[上传] ❌ 数据库写入失败! res为:', res);
            }
            renderGallery();
        });
        e.target.value = '';
    });
}

/* ========== 愿望清单 ========== */
function renderBucketList() {
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
            '<div class="bucket-checkbox ' + (item.completed ? 'checked' : '') + '" onclick="toggleBucket(' + item.id + ')"></div>' +
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
    await sbUpdate('bucket_list', 'id', id, { completed: newVal });
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
        await sbUpdate('bucket_list', 'id', id, { text: text });
        item.text = text;
        renderBucketList();
    });
}

async function deleteBucket(id) {
    showConfirm('确定删除这个愿望吗？', async function (ok) {
        if (ok) {
            await sbDelete('bucket_list', 'id', id);
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
        }
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
                '<div class="timeline-date">' + formatDate(item.date) + ' ' + (item.time || '') + '</div>' +
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
        }
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
        await sbUpdate('timeline', 'id', id, updates);
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
            await sbDelete('timeline', 'id', id);
            currentData.timeline = currentData.timeline.filter(function (i) { return i.id !== id; });
            renderTimeline();
        }
    });
}

/* ========== 足迹地图 ========== */
function renderMap() {
    var el;
    el = document.getElementById('map-count');
    if (el) el.textContent = currentData.visitedProvinces.length;

    var cells = document.querySelectorAll('.grid-cell');
    [].forEach.call(cells, function (cell) {
        if (cell.classList.contains('empty')) return;
        var provinces = (cell.dataset.provinces || '').split(',').map(function (s) { return s.trim(); });
        var hasVisited = provinces.some(function (p) {
            return currentData.visitedProvinces.some(function (v) { return v.name === p; });
        });
        cell.classList.toggle('visited', hasVisited);
    });

    var pg = document.getElementById('province-grid');
    if (pg) {
        var pgHtml = '';
        [].forEach.call(PROVINCES, function (p) {
            var v = currentData.visitedProvinces.some(function (x) { return x.name === p.name; });
            pgHtml += '<div class="province-tag ' + (v ? 'visited' : '') + '" onclick="markProvince(\'' + p.name + '\')">' + p.name + '</div>';
        });
        pg.innerHTML = pgHtml;
    }

    var vl = document.getElementById('visited-provinces');
    if (!vl) return;
    if (currentData.visitedProvinces.length === 0) {
        vl.innerHTML = '<li style="text-align:center;padding:20px;color:#A09086;">点击下方省份标签点亮地图 🗺️</li>';
        return;
    }
    var sorted = currentData.visitedProvinces.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var vlHtml = '';
    [].forEach.call(sorted, function (item) {
        vlHtml += '<li class="visited-item">' +
            '<span class="visited-name">' + item.name + '</span>' +
            '<div class="visited-item-right">' +
                '<span class="visited-date">' + formatDate(item.date) + '</span>' +
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
            await sbUpdate('visited_provinces', 'name', name, { date: r.date });
            existing.date = r.date;
        } else {
            var res = await sbInsert('visited_provinces', { name: name, date: r.date });
            if (res && res.length > 0) {
                currentData.visitedProvinces.push(mapProvince(res[0]));
            }
        }
        renderMap();
    });
}

async function removeProvince(name) {
    showConfirm('确定删除「' + name + '」的足迹吗？', async function (ok) {
        if (ok) {
            await sbDelete('visited_provinces', 'name', name);
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
async function initApp() {
    updateGreeting();
    updateTimer();
    setInterval(updateTimer, 1000);
    setupDialogs();
    initTabs();
    setupPhotoUpload();

    await loadData();
    await seedIfEmpty();

    renderGallery();
    renderBucketList();
    renderTimeline();
    renderMap();
}

document.addEventListener('DOMContentLoaded', function () { auth(); });
