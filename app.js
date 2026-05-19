var PASSWORD = '09140707';
var ANNIVERSARY = new Date('2026-05-20T00:00:00');

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
    photos: [],
    bucketList: [
        { id: 1, text: '一起去看一次日出', completed: true },
        { id: 2, text: '一起去海边看星星', completed: false },
        { id: 3, text: '一起学做一道菜', completed: false },
        { id: 4, text: '一起去旅行一次', completed: false },
        { id: 5, text: '一起养一盆小植物', completed: false }
    ],
    timeline: [
        { id: 1, title: '第一次相遇', desc: '在朋友聚会上，我们第一次见面', date: '2026-03-15', time: '19:00' },
        { id: 2, title: '确定关系', desc: '向彼此表白了，我们正式在一起了', date: '2026-04-10', time: '20:30' }
    ],
    visitedProvinces: []
};

function loadData() {
    try {
        var saved = localStorage.getItem('coupleData');
        if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {}
    localStorage.setItem('coupleData', JSON.stringify(initData));
    return JSON.parse(JSON.stringify(initData));
}

function saveData(data) {
    try { localStorage.setItem('coupleData', JSON.stringify(data)); } catch (e) {}
}

var currentData = loadData();

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
        // fallback to prompt
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
    // 显示取消按钮（可能之前被 alert 模式隐藏了）
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
    btn.addEventListener('click', function () {
        if (pwd.value === PASSWORD) {
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
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-images"></i><p>还没有照片，快去上传吧 📸</p></div>';
        return;
    }
    var html = '';
    [].forEach.call(currentData.photos, function (p) {
        var uploadTime = p.uploadTime ? '<div class="photo-meta-item"><i class="fas fa-cloud-upload-alt"></i> 上传于 ' + formatDateTime(p.uploadTime) + '</div>' : '';
        var photoDate = p.photoDate
            ? '<div class="photo-meta-item photo-date-item" onclick="editPhotoDate(' + p.id + ')"><i class="fas fa-camera"></i> 拍摄于 ' + p.photoDate + '</div>'
            : '<div class="photo-meta-item photo-date-item photo-date-empty" onclick="editPhotoDate(' + p.id + ')"><i class="fas fa-camera"></i> 点击添加拍摄日期</div>';
        var descHtml = p.desc
            ? '<p class="photo-desc-text" onclick="editPhotoDesc(' + p.id + ')">' + p.desc + '</p>'
            : '<p class="photo-desc-text photo-desc-empty" onclick="editPhotoDesc(' + p.id + ')">点击添加配文...</p>';

        html += '<div class="photo-card">' +
            '<button class="photo-delete-btn" onclick="deletePhoto(' + p.id + ')" title="删除"><i class="fas fa-trash"></i></button>' +
            '<img src="' + p.url + '" alt="" class="photo-image" loading="lazy">' +
            '<div class="photo-info">' +
                descHtml +
                '<div class="photo-meta">' + uploadTime + photoDate + '</div>' +
            '</div>' +
        '</div>';
    });
    grid.innerHTML = html;
}

function deletePhoto(id) {
    showConfirm('确定删除这张照片吗？', function (ok) {
        if (ok) {
            currentData.photos = currentData.photos.filter(function (p) { return p.id !== id; });
            saveData(currentData);
            renderGallery();
        }
    });
}

function editPhotoDesc(id) {
    var photo = currentData.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    showDialog('编辑配文', [
        { name: 'desc', type: 'textarea', placeholder: '为这张照片配一段文字...', value: photo.desc || '' }
    ], function (r) {
        photo.desc = (r.desc || '').trim();
        saveData(currentData);
        renderGallery();
    });
}

function editPhotoDate(id) {
    var photo = currentData.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    showDialog('拍摄日期', [
        { name: 'date', type: 'date', placeholder: '选择拍摄日期', value: photo.photoDate || todayStr() }
    ], function (r) {
        photo.photoDate = r.date || '';
        saveData(currentData);
        renderGallery();
    });
}

function setupPhotoUpload() {
    // upload button onclick is set in HTML
    var fileInput = document.getElementById('photo-upload');
    if (!fileInput) return;
    fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            var url = ev.target.result;
            showDialog('照片上传成功 💕', [
                { name: 'desc', type: 'textarea', placeholder: '为这张照片配一段文字...' },
                { name: 'photoDate', type: 'date', placeholder: '拍摄日期', value: todayStr() }
            ], function (r) {
                currentData.photos.unshift({
                    id: Date.now(),
                    url: url,
                    desc: (r.desc || '').trim(),
                    uploadTime: new Date().toISOString(),
                    photoDate: r.photoDate || ''
                });
                saveData(currentData);
                renderGallery();
            });
        };
        reader.readAsDataURL(file);
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
        list.innerHTML = '<div class="empty-state"><i class="fas fa-list-check"></i><p>还没有愿望，快去添加吧 ✨</p></div>';
        return;
    }
    var html = '';
    [].forEach.call(currentData.bucketList, function (item) {
        html += '<li class="bucket-item">' +
            '<div class="bucket-checkbox ' + (item.completed ? 'checked' : '') + '" onclick="toggleBucket(' + item.id + ')"></div>' +
            '<span class="bucket-text ' + (item.completed ? 'completed' : '') + '">' + item.text + '</span>' +
            '<div class="bucket-actions">' +
                '<button class="bucket-action-btn bucket-edit-btn" onclick="editBucket(' + item.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="bucket-action-btn bucket-delete-btn" onclick="deleteBucket(' + item.id + ')"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</li>';
    });
    list.innerHTML = html;
}

function toggleBucket(id) {
    var item = currentData.bucketList.find(function (i) { return i.id === id; });
    if (item) { item.completed = !item.completed; saveData(currentData); renderBucketList(); }
}

function editBucket(id) {
    var item = currentData.bucketList.find(function (i) { return i.id === id; });
    if (!item) return;
    showDialog('编辑愿望', [
        { name: 'text', placeholder: '愿望内容', value: item.text }
    ], function (r) {
        if (r.text && r.text.trim()) {
            item.text = r.text.trim();
            saveData(currentData);
            renderBucketList();
        }
    });
}

function deleteBucket(id) {
    showConfirm('确定删除这个愿望吗？', function (ok) {
        if (ok) {
            currentData.bucketList = currentData.bucketList.filter(function (i) { return i.id !== id; });
            saveData(currentData);
            renderBucketList();
        }
    });
}

function addBucket() {
    showDialog('添加新愿望', [
        { name: 'text', placeholder: '输入你的愿望...' }
    ], function (r) {
        if (r.text && r.text.trim()) {
            currentData.bucketList.push({ id: Date.now(), text: r.text.trim(), completed: false });
            saveData(currentData);
            renderBucketList();
        }
    });
}

/* ========== 时间轴 ========== */
function renderTimeline() {
    var container = document.getElementById('timeline-container');
    if (!container) return;
    if (currentData.timeline.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>还没有记录，快去添加吧 💕</p></div>';
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
                '<div class="timeline-title">' + item.title + '</div>' +
                '<div class="timeline-desc">' + (item.desc || '') + '</div>' +
                '<div class="timeline-actions">' +
                    '<button class="timeline-action-btn timeline-edit-btn" onclick="editTimelineEvent(' + item.id + ')"><i class="fas fa-edit"></i> 编辑</button>' +
                    '<button class="timeline-action-btn timeline-delete-btn" onclick="deleteTimelineEvent(' + item.id + ')"><i class="fas fa-trash"></i> 删除</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;
}

function addTimelineEvent() {
    var today = todayStr();
    showDialog('添加恋爱事件', [
        { name: 'title', placeholder: '事件标题' },
        { name: 'desc', type: 'textarea', placeholder: '事件描述' },
        { name: 'date', type: 'date', value: today },
        { name: 'time', type: 'time', value: '12:00' }
    ], function (r) {
        if (!r.title || !r.title.trim()) return;
        currentData.timeline.push({
            id: Date.now(),
            title: r.title.trim(),
            desc: (r.desc || '').trim() || '暂无描述',
            date: r.date || today,
            time: r.time || '12:00'
        });
        saveData(currentData);
        renderTimeline();
    });
}

function editTimelineEvent(id) {
    var item = currentData.timeline.find(function (i) { return i.id === id; });
    if (!item) return;
    showDialog('编辑恋爱事件', [
        { name: 'title', placeholder: '事件标题', value: item.title },
        { name: 'desc', type: 'textarea', placeholder: '事件描述', value: item.desc || '' },
        { name: 'date', type: 'date', value: item.date },
        { name: 'time', type: 'time', value: item.time || '12:00' }
    ], function (r) {
        if (!r.title || !r.title.trim()) return;
        item.title = r.title.trim();
        item.desc = (r.desc || '').trim() || '暂无描述';
        item.date = r.date || item.date;
        item.time = r.time || '12:00';
        saveData(currentData);
        renderTimeline();
    });
}

function deleteTimelineEvent(id) {
    showConfirm('确定删除这个事件吗？', function (ok) {
        if (ok) {
            currentData.timeline = currentData.timeline.filter(function (i) { return i.id !== id; });
            saveData(currentData);
            renderTimeline();
        }
    });
}

/* ========== 足迹地图 ========== */
function renderMap() {
    var el;
    el = document.getElementById('map-count');
    if (el) el.textContent = currentData.visitedProvinces.length;

    // 更新地图格子
    var cells = document.querySelectorAll('.grid-cell');
    [].forEach.call(cells, function (cell) {
        if (cell.classList.contains('empty')) return;
        var provinces = (cell.dataset.provinces || '').split(',').map(function (s) { return s.trim(); });
        var hasVisited = provinces.some(function (p) {
            return currentData.visitedProvinces.some(function (v) { return v.name === p; });
        });
        cell.classList.toggle('visited', hasVisited);
    });

    // 省份标签
    var pg = document.getElementById('province-grid');
    if (pg) {
        var pgHtml = '';
        [].forEach.call(PROVINCES, function (p) {
            var v = currentData.visitedProvinces.some(function (x) { return x.name === p.name; });
            pgHtml += '<div class="province-tag ' + (v ? 'visited' : '') + '" onclick="markProvince(\'' + p.name + '\')">' + p.name + '</div>';
        });
        pg.innerHTML = pgHtml;
    }

    // 已访问列表
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
                '<button class="delete-province-btn" onclick="removeProvince(\'' + item.name + '\')"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</li>';
    });
    vl.innerHTML = vlHtml;
}

function markProvince(name) {
    var existing = currentData.visitedProvinces.find(function (p) { return p.name === name; });
    showDialog(existing ? '编辑「' + name + '」' : '点亮「' + name + '」', [
        { name: 'date', type: 'date', value: existing ? existing.date : todayStr() }
    ], function (r) {
        if (!r.date) return;
        if (existing) { existing.date = r.date; }
        else { currentData.visitedProvinces.push({ name: name, date: r.date }); }
        saveData(currentData);
        renderMap();
    });
}

function removeProvince(name) {
    showConfirm('确定删除「' + name + '」的足迹吗？', function (ok) {
        if (ok) {
            currentData.visitedProvinces = currentData.visitedProvinces.filter(function (p) { return p.name !== name; });
            saveData(currentData);
            renderMap();
        }
    });
}

/* ========== 弹窗事件绑定 ========== */
function setupDialogs() {
    // 自定义弹窗
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

    // 确认弹窗
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

    // 键盘事件
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (customDlg && !customDlg.classList.contains('hidden')) hideDialog();
            if (cfmDlg && !cfmDlg.classList.contains('hidden')) hideConfirm(false);
        }
    });
}

/* ========== 初始化 ========== */
function initApp() {
    updateGreeting();
    updateTimer();
    setInterval(updateTimer, 1000);

    setupDialogs();
    initTabs();
    renderGallery();
    setupPhotoUpload();
    renderBucketList();
    renderTimeline();
    renderMap();

    // 备用：JS 绑定（HTML onclick 已作为主方案）
    try {
        var b1 = document.getElementById('add-bucket-btn');
        var b2 = document.getElementById('add-event-btn');
        if (b1) b1.addEventListener('click', addBucket);
        if (b2) b2.addEventListener('click', addTimelineEvent);
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', function () { auth(); });
