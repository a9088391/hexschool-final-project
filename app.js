
/**
 * 應用程式邏輯 App
 */
const app = {
    data: [],
    STORAGE_KEY: 'bp_records_v1',
    chartInstance: null,

    init() {
        this.loadData();
        this.updateReminder();
        this.renderList();
        // 設定日期預設值
        this.setFormDefaultTime();
    },

    // --- 資料處理區 ---

    loadData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.data = JSON.parse(stored);
            // 確保按照時間戳記排序 (新的在前)
            this.data.sort((a, b) => b.timestamp - a.timestamp);
        }
    },

    saveData() {
        // 儲存前先按時間排序（新的在前）
        this.data.sort((a, b) => b.timestamp - a.timestamp);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        this.updateReminder();
        this.renderList();
        this.renderChart(); // 更新圖表
    },

    // --- 介面渲染區 ---

    // 更新首頁頂部的提醒卡片
    updateReminder() {
        const todayStr = new Date().toISOString().split('T')[0];
        const hasRecordToday = this.data.some(r => r.date === todayStr);
        const el = document.getElementById('reminder-card');

        if (hasRecordToday) {
            el.style.background = 'linear-gradient(135deg, #81C784 0%, #A5D6A7 100%)'; // 綠色系
            el.innerHTML = `
                <div class="reminder-title">太棒了！</div>
                <div class="reminder-text">今天已經完成測量，繼續保持健康習慣喔！❤️</div>
            `;
        } else {
            el.style.background = 'linear-gradient(135deg, #FF8A80 0%, #FFCCBC 100%)'; // 紅色系
            el.innerHTML = `
                <div class="reminder-title">早安！</div>
                <div class="reminder-text">今天還沒有量血壓喔，現在花一分鐘記錄一下吧。</div>
            `;
        }
    },

    // 取得血壓狀態顏色與文字
    getStatus(sys, dia) {
        // 簡易判斷標準 (可根據需求調整)
        // 正常: <120 / <80
        // 偏高: 120-139 / 80-89
        // 高血壓: >=140 / >=90

        if (sys >= 140 || dia >= 90) return { class: 'status-alert', text: '過高' };
        if (sys >= 130 || dia >= 80) return { class: 'status-high', text: '偏高' };
        if (sys >= 120) return { class: 'status-elevated', text: '正常偏高' };
        return { class: 'status-normal', text: '正常' };
    },

    renderList() {
        const listEl = document.getElementById('record-list');
        const daysLimit = parseInt(document.getElementById('filter-range').value);

        // 過濾日期
        const now = new Date();
        const filteredData = this.data.filter(item => {
            if (daysLimit === 999) return true;
            const itemDate = new Date(item.date);
            const diffTime = Math.abs(now - itemDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= daysLimit;
        });

        if (filteredData.length === 0) {
            listEl.innerHTML = '<div class="empty-state">目前還沒有紀錄喔<br>點擊右下角「+」開始記錄</div>';
            return;
        }

        listEl.innerHTML = filteredData.map(item => {
            const status = this.getStatus(item.systolic, item.diastolic);
            const periodText = item.period === 'morning' ? '☀️ 早上' : (item.period === 'noon' ? '🌤️ 中午' : (item.period === 'evening' ? '🌙 晚上' : '🕒 其他'));

            return `
                <div class="record-card ${status.class}" onclick="app.editRecord('${item.id}')">
                    <div class="card-header">
                        <span>${item.date} ${item.time}</span>
                        <span>${periodText}</span>
                    </div>
                    <div class="card-body">
                        <div class="bp-values">
                            <span class="bp-big">${item.systolic}</span>
                            <span class="bp-unit">/ ${item.diastolic} mmHg</span>
                        </div>
                        <div class="pulse-value">
                            ❤️ ${item.pulse}
                            <span class="card-tag">${status.text}</span>
                        </div>
                    </div>
                    ${item.note ? `<div class="card-note">📝 ${item.note}</div>` : ''}
                </div>
            `;
        }).join('');
    },

    // 使用 Chart.js 繪製圖表
    renderChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');

        // 取最近 7 筆數據，並反轉順序讓舊的在左邊
        const chartData = this.data.slice(0, 7).reverse();

        const labels = chartData.map(d => d.date.slice(5)); // 只取 MM-DD
        const sysData = chartData.map(d => d.systolic);
        const diaData = chartData.map(d => d.diastolic);

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '收縮壓',
                        data: sysData,
                        borderColor: '#FF8A80',
                        backgroundColor: 'rgba(255, 138, 128, 0.2)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: '舒張壓',
                        data: diaData,
                        borderColor: '#81C784',
                        backgroundColor: 'rgba(129, 199, 132, 0.2)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        suggestedMin: 60,
                        suggestedMax: 160
                    }
                }
            }
        });
    },

    // --- 表單操作區 ---

    setFormDefaultTime() {
        const now = new Date();
        // 格式化為 YYYY-MM-DD
        const dateStr = now.toISOString().split('T')[0];
        // 格式化為 HH:MM (注意時區問題，這裡簡單處理)
        const timeStr = now.toTimeString().slice(0, 5);

        document.getElementById('date').value = dateStr;
        document.getElementById('time').value = timeStr;

        // 自動判斷時段
        const hour = now.getHours();
        const periodSelect = document.getElementById('period');
        if (hour >= 5 && hour < 11) periodSelect.value = 'morning';
        else if (hour >= 11 && hour < 14) periodSelect.value = 'noon';
        else if (hour >= 18 && hour < 23) periodSelect.value = 'evening';
        else periodSelect.value = 'other';
    },

    openForm(isEdit = false) {
        const modal = document.getElementById('modal-form');
        modal.classList.add('open');

        if (!isEdit) {
            document.getElementById('form-title').textContent = "新增紀錄";
            document.getElementById('bp-form').reset();
            document.getElementById('record-id').value = "";
            document.getElementById('btn-delete').style.display = "none";
            this.setFormDefaultTime();
        }
    },

    closeForm() {
        document.getElementById('modal-form').classList.remove('open');
    },

    saveRecord(e) {
        e.preventDefault();

        const id = document.getElementById('record-id').value;
        const sys = parseInt(document.getElementById('sys').value);
        const dia = parseInt(document.getElementById('dia').value);
        const pulse = parseInt(document.getElementById('pulse').value);
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const period = document.getElementById('period').value;
        const note = document.getElementById('note').value;

        const record = {
            id: id || Date.now().toString(), // 有 ID 則用舊的，無則產生新的
            timestamp: new Date(`${date}T${time}`).getTime(),
            systolic: sys,
            diastolic: dia,
            pulse: pulse,
            date: date,
            time: time,
            period: period,
            note: note
        };

        if (id) {
            // 編輯模式：找到並取代
            const index = this.data.findIndex(r => r.id === id);
            if (index !== -1) this.data[index] = record;
        } else {
            // 新增模式
            this.data.push(record);
        }

        this.saveData();
        this.closeForm();
    },

    editRecord(id) {
        const record = this.data.find(r => r.id === id);
        if (!record) return;

        document.getElementById('form-title').textContent = "編輯紀錄";
        document.getElementById('record-id').value = record.id;
        document.getElementById('sys').value = record.systolic;
        document.getElementById('dia').value = record.diastolic;
        document.getElementById('pulse').value = record.pulse;
        document.getElementById('date').value = record.date;
        document.getElementById('time').value = record.time;
        document.getElementById('period').value = record.period;
        document.getElementById('note').value = record.note || '';

        document.getElementById('btn-delete').style.display = "block";

        this.openForm(true);
    },

    deleteRecord() {
        if (!confirm('確定要刪除這筆紀錄嗎？')) return;

        const id = document.getElementById('record-id').value;
        this.data = this.data.filter(r => r.id !== id);
        this.saveData();
        this.closeForm();
    },

    // --- 雜項功能 ---

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        if (tabName === 'list') {
            document.getElementById('tab-list').classList.remove('hidden');
            document.getElementById('tab-chart').classList.add('hidden');
        } else {
            document.getElementById('tab-list').classList.add('hidden');
            document.getElementById('tab-chart').classList.remove('hidden');
            this.renderChart();
        }
    },

    exportData() {
        // 簡單的 CSV 格式匯出到剪貼簿
        let csvContent = "日期,時間,收縮壓,舒張壓,心跳,時段,備註\n";
        this.data.forEach(row => {
            csvContent += `${row.date},${row.time},${row.systolic},${row.diastolic},${row.pulse},${row.period},${row.note}\n`;
        });

        // 複製到剪貼簿
        const textarea = document.createElement("textarea");
        textarea.value = csvContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);

        // 顯示提示
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
};

// 啟動 App
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});