/* ============================================
   Trends — Cross-exam topic analysis
   ============================================ */

const Trends = {
    render() {
        const main = document.getElementById('main-content');
        const { frequency, examIds } = DataStore.getTopicFrequencyByExam();

        main.innerHTML = `
            <h1 class="section-title">📈 Análise de Tendências</h1>
            <p class="text-muted mb-24">Veja quais temas caíram em cada prova e identifique padrões.</p>

            <div class="card mb-24">
                <h3 class="mb-16">Mapa de Calor: Tema × Prova</h3>
                <div style="overflow-x:auto">
                    ${this.renderHeatmap(frequency, examIds)}
                </div>
            </div>

            <div class="grid grid-2 mb-24">
                <div class="card">
                    <h3 class="mb-16">🔥 Temas Mais Frequentes</h3>
                    ${this.renderMostFrequent(frequency, examIds)}
                </div>
                <div class="card">
                    <h3 class="mb-16">⚡ Previsão para Próxima Prova</h3>
                    ${this.renderPrediction(frequency, examIds)}
                </div>
            </div>

            <div class="card mb-24">
                <h3 class="mb-16">📊 Distribuição por Área e Prova</h3>
                <div class="chart-container" style="max-height:400px">
                    <canvas id="chart-trends"></canvas>
                </div>
            </div>
        `;

        this.renderTrendsChart(frequency, examIds);
    },

    renderHeatmap(frequency, examIds) {
        const areas = DataStore.getAllAreas();
        let html = '<table class="heatmap-table">';
        html += '<thead><tr><th style="text-align:left">Tema</th>';
        examIds.forEach(e => { html += `<th>${e}</th>`; });
        html += '<th>Total</th></tr></thead><tbody>';

        areas.forEach(area => {
            const topics = DataStore.getTopicsForArea(area.key);
            topics.forEach(topic => {
                const key = `${area.key}/${topic.key}`;
                const data = frequency[key];
                if (!data) return;

                let total = 0;
                html += `<tr><td class="topic-name-cell">
                    <span class="badge ${DataStore.getAreaBadgeClass(area.key)}" style="font-size:0.65rem;margin-right:4px">${area.icon}</span>
                    ${topic.label}
                </td>`;

                examIds.forEach(examId => {
                    const count = data.exams[examId] || 0;
                    total += count;
                    const heatClass = count === 0 ? 'heat-0' : count === 1 ? 'heat-1' : count === 2 ? 'heat-2' : count >= 3 ? 'heat-3' : 'heat-1';
                    html += `<td><span class="heatmap-cell ${heatClass}">${count || '—'}</span></td>`;
                });

                const totalHeat = total >= 4 ? 'heat-4' : total >= 3 ? 'heat-3' : total >= 2 ? 'heat-2' : 'heat-1';
                html += `<td><strong class="heatmap-cell ${totalHeat}">${total}</strong></td></tr>`;
            });
        });

        html += '</tbody></table>';
        return html;
    },

    renderMostFrequent(frequency, examIds) {
        const items = Object.values(frequency).map(f => {
            const total = Object.values(f.exams).reduce((s, v) => s + v, 0);
            const examCount = Object.keys(f.exams).length;
            return { ...f, total, examCount };
        });

        items.sort((a, b) => b.total - a.total || b.examCount - a.examCount);

        return `
            <ol style="padding-left:20px">
                ${items.slice(0, 10).map(item => {
                    const badge = DataStore.getAreaBadgeClass(item.area);
                    const inAll = item.examCount === examIds.length;
                    return `
                        <li style="margin-bottom:8px">
                            <span class="badge ${badge}" style="font-size:0.7rem">${DataStore.getAreaLabel(item.area)}</span>
                            <strong>${item.label}</strong>
                            <span class="text-muted"> — ${item.total} questões em ${item.examCount} provas</span>
                            ${inAll ? ' <span class="badge badge-danger" style="font-size:0.65rem">TODAS AS PROVAS</span>' : ''}
                        </li>
                    `;
                }).join('')}
            </ol>
        `;
    },

    renderPrediction(frequency, examIds) {
        // Topics with high historical frequency have higher probability
        // Topics that appeared recently are slightly less likely (variety)
        const items = Object.values(frequency).map(f => {
            const total = Object.values(f.exams).reduce((s, v) => s + v, 0);
            const examCount = Object.keys(f.exams).length;
            const recentExams = examIds.slice(-2);
            const recentCount = recentExams.reduce((s, e) => s + (f.exams[e] || 0), 0);

            // Score: historical frequency + bonus for consistency - small penalty for recent appearance
            let score = (total * 0.5) + (examCount * 2) - (recentCount * 0.3);
            return { ...f, total, examCount, score };
        });

        items.sort((a, b) => b.score - a.score);

        return `
            <p class="text-muted mb-16" style="font-size:0.85rem">
                Baseado na frequência histórica e padrões de recorrência.
            </p>
            <ol style="padding-left:20px">
                ${items.slice(0, 8).map((item, i) => {
                    const badge = DataStore.getAreaBadgeClass(item.area);
                    const prob = Math.min(95, Math.round(50 + item.score * 5));
                    return `
                        <li style="margin-bottom:8px">
                            <span class="badge ${badge}" style="font-size:0.7rem">${DataStore.getAreaLabel(item.area)}</span>
                            <strong>${item.label}</strong>
                            <span class="badge ${prob >= 80 ? 'badge-danger' : prob >= 60 ? 'badge-warning' : 'badge-success'}" style="font-size:0.7rem">
                                ${prob}% chance
                            </span>
                        </li>
                    `;
                }).join('')}
            </ol>
        `;
    },

    renderTrendsChart(frequency, examIds) {
        const ctx = document.getElementById('chart-trends');
        if (!ctx) return;

        const areas = DataStore.getAllAreas();
        const datasets = areas.map(area => {
            const data = examIds.map(examId => {
                return DataStore.getQuestionsByExam(examId).filter(q => q.area === area.key).length;
            });
            return {
                label: area.label,
                data,
                backgroundColor: area.color + '55',
                borderColor: area.color,
                borderWidth: 2
            };
        });

        new Chart(ctx, {
            type: 'bar',
            data: { labels: examIds, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }
};
