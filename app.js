// ==========================================
// 记账本 APP - 核心逻辑
// ==========================================

(function () {
    'use strict';

    // ===== 常量 =====
    const STORAGE_KEY = 'jz_transactions';

    const CATEGORIES = {
        expense: [
            { id: 'food',      name: '餐饮', icon: '🍔' },
            { id: 'transport',  name: '交通', icon: '🚗' },
            { id: 'shopping',   name: '购物', icon: '🛍️' },
            { id: 'fun',        name: '娱乐', icon: '🎮' },
            { id: 'medical',    name: '医疗', icon: '💊' },
            { id: 'education',  name: '教育', icon: '📚' },
            { id: 'housing',    name: '住房', icon: '🏠' },
            { id: 'utility',    name: '水电', icon: '⚡' },
            { id: 'clothes',    name: '服饰', icon: '👔' },
            { id: 'other_exp',  name: '其他', icon: '📝' },
        ],
        income: [
            { id: 'salary',    name: '工资', icon: '💰' },
            { id: 'bonus',     name: '奖金', icon: '🎁' },
            { id: 'invest',    name: '投资', icon: '📈' },
            { id: 'parttime',  name: '兼职', icon: '💼' },
            { id: 'other_inc', name: '其他', icon: '💵' },
        ]
    };

    const CHART_COLORS = [
        '#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981',
        '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6', '#6366F1'
    ];

    // ===== 状态 =====
    let transactions = [];
    let selectedMonth = getCurrentMonth();
    let currentType = 'expense';
    let selectedCategory = null;
    let deleteTargetId = null;
    let deferredPrompt = null;

    // ===== 工具函数 =====
    function getCurrentMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatMonthLabel(month) {
        const [y, m] = month.split('-');
        return `${y}年${parseInt(m)}月`;
    }

    function formatDateStr(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.getTime() === today.getTime()) return '今天';
        if (d.getTime() === yesterday.getTime()) return '昨天';

        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
    }

    function formatMoney(n) {
        return Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    function getMonthFromDate(dateStr) {
        return dateStr.substring(0, 7);
    }

    function addMonths(month, offset) {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 1 + offset, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // ===== 数据持久化 =====
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            transactions = raw ? JSON.parse(raw) : [];
        } catch {
            transactions = [];
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        } catch (e) {
            console.error('保存失败', e);
        }
    }

    // ===== DOM 元素 =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ===== 渲染月份 =====
    function renderMonth() {
        $('#monthLabel').textContent = formatMonthLabel(selectedMonth);
    }

    // ===== 渲染统计 =====
    function renderStats() {
        const monthly = transactions.filter(t => getMonthFromDate(t.date) === selectedMonth);
        const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const balance = income - expense;

        $('#totalIncome').textContent = formatMoney(income);
        $('#totalExpense').textContent = formatMoney(expense);
        $('#totalBalance').textContent = (balance >= 0 ? '' : '-') + formatMoney(balance);
        $('#totalBalance').style.color = balance >= 0 ? 'var(--primary)' : 'var(--expense)';
    }

    // ===== 渲染列表 =====
    function renderList() {
        const monthly = transactions.filter(t => getMonthFromDate(t.date) === selectedMonth)
            .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);

        const container = $('#transactionList');

        if (monthly.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-text">暂无记录</div>
                    <div class="empty-hint">点击右上角"记一笔"开始记账</div>
                </div>`;
            return;
        }

        // 按日期分组
        const groups = {};
        monthly.forEach(t => {
            if (!groups[t.date]) groups[t.date] = [];
            groups[t.date].push(t);
        });

        let html = '';
        Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const items = groups[date];
            const dayIncome = items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const dayExpense = items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

            let summary = '';
            if (dayIncome > 0) summary += `<span style="color:var(--income)">+${formatMoney(dayIncome)}</span>`;
            if (dayIncome > 0 && dayExpense > 0) summary += ' / ';
            if (dayExpense > 0) summary += `<span style="color:var(--expense)">-${formatMoney(dayExpense)}</span>`;

            html += `<div class="date-group">
                <div class="date-header">
                    <span>${formatDateStr(date)}</span>
                    <span class="date-summary">${summary}</span>
                </div>`;

            items.forEach((t, i) => {
                const catInfo = getCategoryInfo(t.type, t.category);
                html += `<div class="tx-item" style="animation-delay:${i * 0.05}s" data-id="${t.id}">
                    <div class="tx-left">
                        <div class="tx-icon ${t.type}">${catInfo.icon}</div>
                        <div class="tx-info">
                            <div class="tx-category">${catInfo.name}</div>
                            ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ''}
                        </div>
                    </div>
                    <div class="tx-right">
                        <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}</span>
                        <button class="tx-delete" data-id="${t.id}" aria-label="删除">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </div>`;
            });

            html += '</div>';
        });

        container.innerHTML = html;

        // 绑定删除事件
        container.querySelectorAll('.tx-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTargetId = btn.dataset.id;
                showModal('deleteModal');
            });
        });
    }

    function getCategoryInfo(type, categoryId) {
        const list = CATEGORIES[type] || CATEGORIES.expense;
        return list.find(c => c.id === categoryId) || { id: categoryId, name: categoryId, icon: '📝' };
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== 渲染统计图表 =====
    function renderChart() {
        const monthly = transactions.filter(t => getMonthFromDate(t.date) === selectedMonth);
        const container = $('#chartSection');

        const expenseItems = monthly.filter(t => t.type === 'expense');
        const incomeItems = monthly.filter(t => t.type === 'income');

        const totalExpense = expenseItems.reduce((s, t) => s + t.amount, 0);
        const totalIncome = incomeItems.reduce((s, t) => s + t.amount, 0);

        if (expenseItems.length === 0 && incomeItems.length === 0) {
            container.innerHTML = '<div class="chart-empty">暂无数据，记账后即可查看统计</div>';
            return;
        }

        let html = '';

        // 支出分类统计
        if (expenseItems.length > 0) {
            html += buildChartBlock('支出分类', 'expense', expenseItems, totalExpense);
        }

        // 收入分类统计
        if (incomeItems.length > 0) {
            html += buildChartBlock('收入分类', 'income', incomeItems, totalIncome);
        }

        // 环形图
        if (expenseItems.length > 0) {
            html += buildDonutBlock('支出占比', expenseItems, totalExpense);
        }

        container.innerHTML = html;
    }

    function buildChartBlock(title, type, items, total) {
        // 按分类汇总
        const catMap = {};
        items.forEach(t => {
            if (!catMap[t.category]) catMap[t.category] = 0;
            catMap[t.category] += t.amount;
        });

        const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

        let bars = '';
        sorted.forEach(([catId, amount], i) => {
            const cat = getCategoryInfo(type, catId);
            const pct = total > 0 ? (amount / total * 100) : 0;
            bars += `<div class="bar-row">
                <span class="bar-icon">${cat.icon}</span>
                <div class="bar-info">
                    <div class="bar-top">
                        <span class="bar-name">${cat.name}</span>
                        <span class="bar-amount ${type}">${type === 'income' ? '+' : '-'}${formatMoney(amount)}</span>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill ${type}" style="width:${Math.max(pct, 2)}%;background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
                    </div>
                </div>
                <span class="bar-percent">${pct.toFixed(1)}%</span>
            </div>`;
        });

        return `<div class="chart-block">
            <div class="chart-title"><span class="chart-dot ${type}"></span>${title}</div>
            <div class="bar-chart">${bars}</div>
        </div>`;
    }

    function buildDonutBlock(title, items, total) {
        const catMap = {};
        items.forEach(t => {
            if (!catMap[t.category]) catMap[t.category] = 0;
            catMap[t.category] += t.amount;
        });

        const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5);
        const otherAmount = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
        if (otherAmount > 0) top5.push(['other_exp', otherAmount]);

        // 绘制环形图
        const size = 140;
        const cx = size / 2;
        const cy = size / 2;
        const r = 55;
        const strokeWidth = 20;

        let paths = '';
        let startAngle = -Math.PI / 2;

        const allItems = top5.map(([catId, amount], i) => {
            const cat = catId === 'other_exp' ? { name: '其他', icon: '📊' } : getCategoryInfo('expense', catId);
            const pct = total > 0 ? amount / total : 0;
            const color = CHART_COLORS[i % CHART_COLORS.length];
            const endAngle = startAngle + pct * Math.PI * 2;

            if (pct > 0.005) {
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const large = pct > 0.5 ? 1 : 0;
                paths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
            }

            startAngle = endAngle;
            return { name: cat.name, color, pct: (pct * 100).toFixed(1), amount };
        });

        let legend = '';
        allItems.forEach(item => {
            legend += `<div class="legend-item">
                <span class="legend-color" style="background:${item.color}"></span>
                <span class="legend-name">${item.name}</span>
                <span class="legend-val">${item.pct}%</span>
            </div>`;
        });

        return `<div class="chart-block">
            <div class="chart-title"><span class="chart-dot expense"></span>${title}</div>
            <div class="donut-wrap">
                <div class="donut-canvas">
                    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F3F4F6" stroke-width="${strokeWidth}"/>
                        ${paths}
                        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#111827" font-size="14" font-weight="700">¥${formatMoney(total)}</text>
                        <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="#9CA3AF" font-size="10">总支出</text>
                    </svg>
                </div>
                <div class="donut-legend">${legend}</div>
            </div>
        </div>`;
    }

    // ===== 弹窗控制 =====
    function showModal(id) {
        document.getElementById(id).classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function hideModal(id) {
        document.getElementById(id).classList.remove('show');
        document.body.style.overflow = '';
    }

    // ===== 分类网格渲染 =====
    function renderCategoryGrid() {
        const list = CATEGORIES[currentType];
        const grid = $('#categoryGrid');
        const selectedClass = currentType === 'expense' ? 'expense-selected' : 'income-selected';

        grid.innerHTML = list.map(cat => `
            <button type="button" class="cat-btn ${selectedCategory === cat.id ? 'selected ' + selectedClass : ''}" data-id="${cat.id}">
                <span class="cat-emoji">${cat.icon}</span>
                <span class="cat-name">${cat.name}</span>
            </button>
        `).join('');

        grid.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedCategory = btn.dataset.id;
                renderCategoryGrid();
            });
        });
    }

    // ===== 更新表单样式 =====
    function updateFormStyle() {
        const btns = $$('.type-btn');
        btns.forEach(b => {
            b.classList.remove('active', 'expense-active', 'income-active');
            if (b.dataset.type === currentType) {
                b.classList.add('active', currentType === 'expense' ? 'expense-active' : 'income-active');
            }
        });

        const submitBtn = $('#btnSubmit');
        submitBtn.classList.remove('expense-mode', 'income-mode');
        submitBtn.classList.add(currentType === 'expense' ? 'expense-mode' : 'income-mode');
    }

    // ===== Toast =====
    function showToast(msg) {
        const toast = $('#toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
    }

    // ===== 全部渲染 =====
    function render() {
        renderMonth();
        renderStats();
        renderList();
        renderChart();
    }

    // ===== 事件绑定 =====
    function init() {
        loadData();
        render();

        // 月份切换
        $('#prevMonth').addEventListener('click', () => {
            selectedMonth = addMonths(selectedMonth, -1);
            render();
        });

        $('#nextMonth').addEventListener('click', () => {
            selectedMonth = addMonths(selectedMonth, 1);
            render();
        });

        // 打开添加弹窗
        $('#btnAdd').addEventListener('click', () => {
            currentType = 'expense';
            selectedCategory = null;
            $('#inputAmount').value = '';
            $('#inputNote').value = '';
            $('#inputDate').value = new Date().toISOString().split('T')[0];
            updateFormStyle();
            renderCategoryGrid();
            showModal('addModal');
        });

        // 关闭弹窗
        $('#modalClose').addEventListener('click', () => hideModal('addModal'));
        $('#addModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hideModal('addModal');
        });

        // 收入/支出切换
        $$('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentType = btn.dataset.type;
                selectedCategory = null;
                updateFormStyle();
                renderCategoryGrid();
            });
        });

        // 提交表单
        $('#addForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat($('#inputAmount').value);
            const note = $('#inputNote').value.trim();
            const date = $('#inputDate').value;

            if (!amount || amount <= 0) { showToast('请输入有效金额'); return; }
            if (!selectedCategory) { showToast('请选择分类'); return; }
            if (!date) { showToast('请选择日期'); return; }

            transactions.push({
                id: generateId(),
                type: currentType,
                amount: Math.round(amount * 100) / 100,
                category: selectedCategory,
                note,
                date,
                createdAt: Date.now()
            });

            saveData();
            hideModal('addModal');
            render();
            showToast(currentType === 'income' ? '💰 收入已记录' : '💸 支出已记录');
        });

        // 删除确认
        $('#confirmDelete').addEventListener('click', () => {
            if (deleteTargetId) {
                transactions = transactions.filter(t => t.id !== deleteTargetId);
                saveData();
                render();
                showToast('已删除');
            }
            hideModal('deleteModal');
            deleteTargetId = null;
        });

        $('#cancelDelete').addEventListener('click', () => {
            hideModal('deleteModal');
            deleteTargetId = null;
        });

        $('#deleteModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                hideModal('deleteModal');
                deleteTargetId = null;
            }
        });

        // Tab 切换
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const tab = btn.dataset.tab;
                $$('.tab-content').forEach(c => c.classList.remove('active'));
                $(`#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');

                if (tab === 'chart') renderChart();
            });
        });

        // PWA 安装
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallBanner();
        });
    }

    // ===== PWA 安装横幅 =====
    function showInstallBanner() {
        if (!deferredPrompt) return;
        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner show';
        banner.innerHTML = `
            <div class="pwa-install-text">
                <div class="pwa-install-title">安装记账本</div>
                <div class="pwa-install-desc">添加到主屏幕，像APP一样使用</div>
            </div>
            <button class="pwa-install-btn" id="pwaInstallBtn">安装</button>
            <button class="pwa-install-close" id="pwaInstallClose">✕</button>
        `;
        document.body.appendChild(banner);

        $('#pwaInstallBtn').addEventListener('click', async () => {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') showToast('安装成功！');
            deferredPrompt = null;
            banner.remove();
        });

        $('#pwaInstallClose').addEventListener('click', () => banner.remove());
    }

    // ===== 启动 =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
})();
