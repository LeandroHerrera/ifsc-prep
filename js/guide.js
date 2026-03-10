/* ============================================
   Guide — Prioritized Study Guide
   ============================================ */

const Guide = {
    render() {
        const main = document.getElementById('main-content');
        const { frequency, examIds } = DataStore.getTopicFrequencyByExam();
        const topicAcc = Storage.getAccuracyByTopic();
        const studied = Storage.getStudiedTopics();
        const hasData = Storage.getAttempts().length > 0;

        const priorities = this.calculatePriorities(frequency, examIds, topicAcc);

        main.innerHTML = `
            <h1 class="section-title">🎯 Guia de Estudos</h1>
            <p class="text-muted mb-16">Temas priorizados por probabilidade de cair × sua necessidade de estudo.</p>

            <div class="grid grid-3 mb-24">
                <div class="stat-card">
                    <div class="stat-value text-primary">${priorities.length}</div>
                    <div class="stat-label">Temas Mapeados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-success">${studied.length}</div>
                    <div class="stat-label">Temas Estudados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color:var(--danger)">${priorities.filter(p => p.priority === 'alta').length}</div>
                    <div class="stat-label">Prioridade Alta</div>
                </div>
            </div>

            ${!hasData ? `
                <div class="card mb-24" style="border-left:4px solid var(--secondary)">
                    <p><strong>💡 Dica:</strong> Resolva questões no Modo Estudo ou faça um Simulado para que o guia considere seu desempenho pessoal na priorização.</p>
                </div>
            ` : ''}

            <div class="card mb-24">
                <div class="card-header">
                    <h3>📋 Lista de Prioridades</h3>
                    <div>
                        <button class="btn btn-sm filter-chip active" onclick="Guide.filterPriority('all', this)">Todos</button>
                        <button class="btn btn-sm filter-chip" onclick="Guide.filterPriority('alta', this)">🔴 Alta</button>
                        <button class="btn btn-sm filter-chip" onclick="Guide.filterPriority('media', this)">🟡 Média</button>
                        <button class="btn btn-sm filter-chip" onclick="Guide.filterPriority('baixa', this)">🟢 Baixa</button>
                    </div>
                </div>
                <div id="priority-list">
                    ${this.renderPriorityList(priorities, studied)}
                </div>
            </div>

            <div class="card mb-24">
                <h3 class="mb-16">📚 Conteúdo Programático (Edital)</h3>
                <p class="text-muted mb-16">Baseado no Anexo V do Edital 01/2025-2 — Conteúdo Programático do Ensino Fundamental.</p>
                ${this.renderSyllabus()}
            </div>

            <div class="card mb-24">
                <h3 class="mb-16">🏫 Informações do Campus Florianópolis-Centro</h3>
                ${this.renderCampusInfo()}
            </div>
        `;
    },

    calculatePriorities(frequency, examIds, topicAcc) {
        const areas = DataStore.getAllAreas();
        const priorities = [];

        areas.forEach(area => {
            const topics = DataStore.getTopicsForArea(area.key);
            topics.forEach(topic => {
                const freqKey = `${area.key}/${topic.key}`;
                const freqData = frequency[freqKey];
                const accData = topicAcc[freqKey];

                // Historical frequency score (0-1)
                const totalAppearances = freqData
                    ? Object.values(freqData.exams).reduce((s, v) => s + v, 0)
                    : 0;
                const maxPossible = examIds.length * 3; // max ~3 questions per topic per exam
                const freqScore = Math.min(1, totalAppearances / maxPossible);

                // Exam coverage (appeared in how many exams)
                const examCoverage = freqData
                    ? Object.keys(freqData.exams).length / examIds.length
                    : 0;

                // Student accuracy (0-1, default 0.5 if no data)
                let accuracy = 0.5;
                if (accData && accData.total >= 1) {
                    accuracy = accData.correct / accData.total;
                }

                // Priority score: higher = more important to study
                // freq_historica * (1 - acerto_aluno) + bonus for exam coverage
                const score = (freqScore * 0.6 + examCoverage * 0.4) * (1 - accuracy * 0.8);

                let priority;
                if (score >= 0.3) priority = 'alta';
                else if (score >= 0.15) priority = 'media';
                else priority = 'baixa';

                priorities.push({
                    area: area.key,
                    areaLabel: area.label,
                    areaIcon: area.icon,
                    topic: topic.key,
                    topicLabel: topic.label,
                    totalAppearances,
                    examCoverage: Math.round(examCoverage * 100),
                    accuracy: accData ? Math.round(accuracy * 100) : null,
                    questionsAnswered: accData ? accData.total : 0,
                    score,
                    priority,
                    questionCount: topic.count
                });
            });
        });

        priorities.sort((a, b) => b.score - a.score);
        return priorities;
    },

    renderPriorityList(priorities, studied) {
        if (priorities.length === 0) {
            return '<p class="text-muted">Nenhum tema encontrado.</p>';
        }

        return priorities.map((item, i) => {
            const isStudied = studied.includes(`${item.area}/${item.topic}`);
            const priorityBadge = item.priority === 'alta'
                ? 'badge-danger' : item.priority === 'media'
                ? 'badge-warning' : 'badge-success';
            const priorityLabel = item.priority === 'alta'
                ? '🔴 Alta' : item.priority === 'media'
                ? '🟡 Média' : '🟢 Baixa';

            return `
                <div class="priority-item ${isStudied ? 'studied' : ''}" data-priority="${item.priority}">
                    <div class="checklist-item" style="flex:1">
                        <input type="checkbox" ${isStudied ? 'checked' : ''}
                               onchange="Guide.toggleStudied('${item.area}', '${item.topic}')"
                               id="check-${item.area}-${item.topic}">
                        <label for="check-${item.area}-${item.topic}" style="flex:1">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                <span class="badge ${priorityBadge}" style="font-size:0.65rem">${priorityLabel}</span>
                                <span class="badge ${DataStore.getAreaBadgeClass(item.area)}" style="font-size:0.65rem">${item.areaIcon} ${item.areaLabel}</span>
                                <strong>${item.topicLabel}</strong>
                            </div>
                            <div class="text-muted" style="font-size:0.8rem;margin-top:4px">
                                ${item.totalAppearances} aparições em ${item.examCoverage}% das provas
                                • ${item.questionCount} questões no banco
                                ${item.accuracy !== null
                                    ? ` • Seu acerto: <strong style="color:${item.accuracy >= 70 ? 'var(--success)' : item.accuracy >= 50 ? 'var(--secondary)' : 'var(--danger)'}">${item.accuracy}%</strong> (${item.questionsAnswered}q)`
                                    : ' • <em>Sem dados ainda</em>'}
                            </div>
                        </label>
                    </div>
                    <button class="btn btn-sm btn-primary"
                            onclick="location.hash='#/estudo';setTimeout(()=>Study.startSession('${item.area}','${item.topic}'),100)">
                        Praticar
                    </button>
                </div>
            `;
        }).join('');
    },

    filterPriority(level, btn) {
        // Update active button
        document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');

        // Filter items
        document.querySelectorAll('.priority-item').forEach(el => {
            if (level === 'all' || el.dataset.priority === level) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
    },

    toggleStudied(area, topic) {
        Storage.toggleStudiedTopic(area, topic);
    },

    renderSyllabus() {
        const syllabus = DataStore.syllabus;
        if (!syllabus || !syllabus.areas) return '<p class="text-muted">Conteúdo programático não disponível.</p>';

        return syllabus.areas.map(area => `
            <details class="mb-8" style="border:1px solid var(--border);border-radius:8px;padding:12px">
                <summary style="cursor:pointer;font-weight:700">
                    ${area.label}
                </summary>
                <ul style="margin-top:8px;padding-left:20px">
                    ${area.content.map(item => `<li style="margin-bottom:4px">${item}</li>`).join('')}
                </ul>
            </details>
        `).join('');
    },

    renderCampusInfo() {
        const syllabus = DataStore.syllabus;
        const campus = syllabus?.campus_info;
        if (!campus) {
            return `
                <div style="padding:12px">
                    <p><strong>Campus Florianópolis-Centro</strong></p>
                    <p class="text-muted">Cursos Técnicos Integrados disponíveis:</p>
                    <ul style="padding-left:20px;margin-top:8px">
                        <li>Técnico em Edificações — 32 vagas</li>
                        <li>Técnico em Eletrônica — 25 vagas</li>
                        <li>Técnico em Eletrotécnica — 36 + 18 vagas</li>
                        <li>Técnico em Mecatrônica — 30 vagas</li>
                        <li>Técnico em Química — 32 vagas</li>
                        <li>Técnico em Saneamento — 32 vagas</li>
                    </ul>
                    <p class="text-muted mt-16" style="font-size:0.85rem">
                        A prova é a mesma para todos os campi — o que muda é a nota de corte por campus/curso.
                    </p>
                </div>
            `;
        }

        return `
            <div style="padding:12px">
                <p><strong>${campus.name}</strong></p>
                <p class="text-muted mb-8">Cursos Técnicos Integrados disponíveis:</p>
                <ul style="padding-left:20px">
                    ${campus.courses.map(c => `
                        <li style="margin-bottom:4px">
                            <strong>${c.name}</strong> — ${c.vagas} vagas
                        </li>
                    `).join('')}
                </ul>
                <p class="text-muted mt-16" style="font-size:0.85rem">
                    A prova é a mesma para todos os campi — o que muda é a nota de corte por campus/curso.
                </p>
            </div>
        `;
    }
};
