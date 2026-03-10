/* ============================================
   Analytics — Performance dashboard
   ============================================ */

const Analytics = {
    charts: {},

    render() {
        this.destroyCharts();
        const main = document.getElementById('main-content');
        const attempts = Storage.getAttempts();
        const uniqueQ = Storage.getUniqueQuestionsAnswered();
        const globalAcc = Storage.getGlobalAccuracy();
        const days = Storage.getDaysStudying();
        const totalExams = Storage.getExams().length;

        main.innerHTML = `
            <h1 class="section-title">📊 Desempenho</h1>

            ${attempts.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>Nenhum dado ainda</h3>
                    <p>Resolva questões no modo Estudo ou faça um Simulado para ver seu desempenho aqui.</p>
                    <button class="btn btn-primary mt-16" onclick="location.hash='#/estudo'">Começar a Estudar</button>
                </div>
            ` : `
                <div class="grid grid-4 mb-24">
                    <div class="stat-card">
                        <div class="stat-value text-primary">${uniqueQ}</div>
                        <div class="stat-label">Questões Resolvidas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color:${globalAcc >= 70 ? 'var(--success)' : globalAcc >= 50 ? 'var(--secondary)' : 'var(--danger)'}">${globalAcc}%</div>
                        <div class="stat-label">Acerto Global</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${totalExams}</div>
                        <div class="stat-label">Simulados Feitos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${days}</div>
                        <div class="stat-label">Dias Estudando</div>
                    </div>
                </div>

                <div class="grid grid-2 mb-24">
                    <div class="card">
                        <h3>Acerto por Área</h3>
                        <div class="chart-container">
                            <canvas id="chart-area"></canvas>
                        </div>
                    </div>
                    <div class="card">
                        <h3>Radar de Desempenho</h3>
                        <div class="chart-container">
                            <canvas id="chart-radar"></canvas>
                        </div>
                    </div>
                </div>

                <div class="card mb-24">
                    <h3>Evolução nos Simulados</h3>
                    <div class="chart-container">
                        <canvas id="chart-evolution"></canvas>
                    </div>
                </div>

                <div class="card mb-24">
                    <h3>Detalhamento por Tema</h3>
                    ${this.renderTopicTable()}
                </div>

                <div class="card mb-24">
                    <h3>🎯 Recomendações de Estudo</h3>
                    ${this.renderRecommendations()}
                </div>

                <div class="text-center mt-24">
                    <button class="btn btn-sm btn-danger" onclick="Storage.clearProgress()">🗑️ Limpar Progresso</button>
                </div>
            `}
        `;

        if (attempts.length > 0) {
            this.renderCharts();
        }
    },

    destroyCharts() {
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};
    },

    renderCharts() {
        this.renderAreaChart();
        this.renderRadarChart();
        this.renderEvolutionChart();
    },

    renderAreaChart() {
        const areaAcc = Storage.getAccuracyByArea();
        const areas = DataStore.getAllAreas();
        const labels = [];
        const data = [];
        const colors = [];

        areas.forEach(a => {
            labels.push(a.label);
            const acc = areaAcc[a.key];
            data.push(acc ? Math.round((acc.correct / acc.total) * 100) : 0);
            colors.push(a.color);
        });

        const ctx = document.getElementById('chart-area');
        if (!ctx) return;

        this.charts.area = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '% Acerto',
                    data,
                    backgroundColor: colors.map(c => c + '33'),
                    borderColor: colors,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
                }
            }
        });
    },

    renderRadarChart() {
        const topicAcc = Storage.getAccuracyByTopic();
        const areas = DataStore.getAllAreas();
        const labels = [];
        const data = [];

        areas.forEach(a => {
            const topics = DataStore.getTopicsForArea(a.key);
            topics.forEach(t => {
                const key = `${a.key}/${t.key}`;
                const acc = topicAcc[key];
                if (acc && acc.total >= 1) {
                    labels.push(t.label.substring(0, 20));
                    data.push(Math.round((acc.correct / acc.total) * 100));
                }
            });
        });

        if (labels.length < 3) return;

        const ctx = document.getElementById('chart-radar');
        if (!ctx) return;

        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: '% Acerto',
                    data,
                    backgroundColor: 'rgba(76,175,80,0.2)',
                    borderColor: '#4CAF50',
                    pointBackgroundColor: '#4CAF50',
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: { beginAtZero: true, max: 100, ticks: { stepSize: 25 } }
                },
                plugins: { legend: { display: false } }
            }
        });
    },

    renderEvolutionChart() {
        const exams = Storage.getExams();
        if (exams.length < 1) return;

        const labels = exams.map((e, i) => `Sim. ${i + 1}`);
        const data = exams.map(e => Math.round((e.score / e.total) * 100));

        const ctx = document.getElementById('chart-evolution');
        if (!ctx) return;

        this.charts.evolution = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '% Acerto',
                    data,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33,150,243,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#2196F3'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
                }
            }
        });
    },

    renderTopicTable() {
        const topicAcc = Storage.getAccuracyByTopic();
        const areas = DataStore.getAllAreas();
        let rows = '';

        areas.forEach(a => {
            const topics = DataStore.getTopicsForArea(a.key);
            topics.forEach(t => {
                const key = `${a.key}/${t.key}`;
                const acc = topicAcc[key];
                if (!acc) return;
                const pct = Math.round((acc.correct / acc.total) * 100);
                const color = pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--secondary)' : 'var(--danger)';
                rows += `
                    <tr>
                        <td><span class="badge ${DataStore.getAreaBadgeClass(a.key)}">${a.label}</span></td>
                        <td>${t.label}</td>
                        <td>${acc.correct}/${acc.total}</td>
                        <td style="font-weight:700;color:${color}">${pct}%</td>
                        <td>
                            <div class="progress-bar" style="width:100px">
                                <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
                            </div>
                        </td>
                    </tr>
                `;
            });
        });

        if (!rows) return '<p class="text-muted">Resolva mais questões para ver detalhamento.</p>';

        return `
            <table class="data-table">
                <thead>
                    <tr><th>Área</th><th>Tema</th><th>Acertos</th><th>%</th><th>Progresso</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    renderRecommendations() {
        const weak = Storage.getWeakTopics(5);
        if (weak.length === 0) {
            return '<p class="text-muted">Resolva mais questões para receber recomendações personalizadas.</p>';
        }

        return `
            <ul style="list-style:none;padding:0">
                ${weak.map(t => {
                    const pct = Math.round(t.accuracy * 100);
                    const label = DataStore.getTopicLabel(t.area, t.topic);
                    const areaLabel = DataStore.getAreaLabel(t.area);
                    return `
                        <li class="priority-item">
                            <span class="badge badge-danger">${pct}%</span>
                            <div class="priority-info">
                                <strong>${label}</strong>
                                <div class="text-muted" style="font-size:0.85rem">${areaLabel} • ${t.correct}/${t.total} acertos</div>
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="location.hash='#/estudo';setTimeout(()=>Study.startSession('${t.area}','${t.topic}'),100)">
                                Praticar
                            </button>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    }
};
