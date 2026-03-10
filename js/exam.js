/* ============================================
   Exam Mode — Simulated exams with timer
   ============================================ */

const Exam = {
    questions: [],
    answers: {},
    flagged: new Set(),
    currentIndex: 0,
    timerInterval: null,
    startTime: null,
    timeLimit: 0,
    timeRemaining: 0,
    examType: '',
    finished: false,

    render() {
        this.cleanup();
        const main = document.getElementById('main-content');

        const totalQuestions = DataStore.questions.length;
        const hasEnough = totalQuestions >= 14;

        main.innerHTML = `
            <h1 class="section-title">📝 Modo Simulado</h1>
            <p class="text-muted mb-24">Simule a prova real do IFSC com cronômetro e condições idênticas.</p>

            ${!hasEnough ? `
                <div class="card mb-16" style="border-left:4px solid var(--warning)">
                    <p>⚠️ Banco com ${totalQuestions} questões. Mínimo de 14 necessário para simulados.</p>
                </div>
            ` : ''}

            <div class="grid grid-3">
                <div class="card" style="text-align:center">
                    <h3>Simulado Completo</h3>
                    <p class="text-muted mb-16">28 questões • 4 horas<br>7 por área, igual à prova real</p>
                    <button class="btn btn-primary btn-block" onclick="Exam.start('complete')" ${!hasEnough ? 'disabled' : ''}>
                        Iniciar Completo
                    </button>
                </div>
                <div class="card" style="text-align:center">
                    <h3>Simulado Rápido</h3>
                    <p class="text-muted mb-16">14 questões • 2 horas<br>3-4 por área, temas frequentes</p>
                    <button class="btn btn-secondary btn-block" onclick="Exam.start('quick')" ${!hasEnough ? 'disabled' : ''}>
                        Iniciar Rápido
                    </button>
                </div>
                <div class="card" style="text-align:center">
                    <h3>Simulado Adaptativo</h3>
                    <p class="text-muted mb-16">28 questões • 4 horas<br>Foca nos seus pontos fracos</p>
                    <button class="btn btn-accent btn-block" onclick="Exam.start('adaptive')" ${!hasEnough ? 'disabled' : ''}>
                        Iniciar Adaptativo
                    </button>
                </div>
            </div>

            ${this.renderExamHistory()}
        `;
    },

    renderExamHistory() {
        const exams = Storage.getExams();
        if (exams.length === 0) return '';

        return `
            <div class="mt-24">
                <h2>Histórico de Simulados</h2>
                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th>Nota</th>
                                <th>Tempo</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${exams.slice().reverse().map(e => {
                                const pct = Math.round((e.score / e.total) * 100);
                                const date = new Date(e.started_at).toLocaleDateString('pt-BR');
                                const typeLabel = { complete: 'Completo', quick: 'Rápido', adaptive: 'Adaptativo' }[e.type] || e.type;
                                const duration = e.finished_at ? this.formatDuration(
                                    Math.round((new Date(e.finished_at) - new Date(e.started_at)) / 1000)
                                ) : '-';
                                return `
                                    <tr>
                                        <td>${date}</td>
                                        <td>${typeLabel}</td>
                                        <td><strong>${e.score}/${e.total}</strong> (${pct}%)</td>
                                        <td>${duration}</td>
                                        <td><button class="btn btn-sm btn-primary" onclick="Exam.reviewExam('${e.id}')">Revisar</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    start(type) {
        this.examType = type;
        this.questions = DataStore.selectQuestionsForExam(type);
        this.answers = {};
        this.flagged = new Set();
        this.currentIndex = 0;
        this.finished = false;
        this.startTime = new Date();

        if (type === 'complete' || type === 'adaptive') {
            this.timeLimit = 4 * 60 * 60; // 4 hours
        } else {
            this.timeLimit = 2 * 60 * 60; // 2 hours
        }
        this.timeRemaining = this.timeLimit;

        this.startTimer();
        this.renderExamQuestion();
    },

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.finish();
            }

            // Alerts
            if (this.timeRemaining === 30 * 60) {
                this.showAlert('⏰ Faltam 30 minutos!');
            } else if (this.timeRemaining === 5 * 60) {
                this.showAlert('⚠️ Faltam 5 minutos!');
            }
        }, 1000);
    },

    cleanup() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    showAlert(msg) {
        const alertEl = document.createElement('div');
        alertEl.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--warning);color:#333;padding:12px 24px;border-radius:8px;font-weight:700;z-index:3000;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
        alertEl.textContent = msg;
        document.body.appendChild(alertEl);
        setTimeout(() => alertEl.remove(), 4000);
    },

    updateTimerDisplay() {
        const el = document.getElementById('exam-timer');
        if (!el) return;
        el.textContent = this.formatDuration(this.timeRemaining);
        el.className = 'timer';
        if (this.timeRemaining <= 5 * 60) el.classList.add('danger');
        else if (this.timeRemaining <= 30 * 60) el.classList.add('warning');
    },

    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        return `${m}:${String(s).padStart(2,'0')}`;
    },

    renderExamQuestion() {
        const main = document.getElementById('main-content');
        const q = this.questions[this.currentIndex];
        const total = this.questions.length;
        const answered = Object.keys(this.answers).length;

        main.innerHTML = `
            <div class="flex justify-between items-center mb-16">
                <div>
                    <span class="badge ${DataStore.getAreaBadgeClass(q.area)}">${DataStore.getAreaLabel(q.area)}</span>
                    <span class="text-muted" style="margin-left:8px">Questão ${this.currentIndex + 1} de ${total}</span>
                </div>
                <div class="flex items-center gap-16">
                    <span class="text-muted">${answered}/${total} respondidas</span>
                    <div class="timer" id="exam-timer">${this.formatDuration(this.timeRemaining)}</div>
                </div>
            </div>

            <div class="question-nav" id="question-nav">
                ${this.questions.map((qq, i) => {
                    let cls = 'question-nav-btn';
                    if (i === this.currentIndex) cls += ' current';
                    if (this.answers[qq.id]) cls += ' answered';
                    if (this.flagged.has(qq.id)) cls += ' flagged';
                    return `<button class="${cls}" onclick="Exam.goTo(${i})">${i + 1}</button>`;
                }).join('')}
            </div>

            <div class="question-card fade-in">
                ${q.supporting_text ? `
                    <div class="question-supporting-text">${Study.escapeHtml(q.supporting_text)}</div>
                ` : ''}
                ${q.image_path ? `<img src="${q.image_path}" class="question-image" alt="Imagem da questão ${q.number}" loading="lazy">` : ''}

                <div class="question-text">${Study.escapeHtml(q.text)}</div>

                <div class="options-list">
                    ${['A','B','C','D','E'].map(letter => {
                        const selected = this.answers[q.id] === letter;
                        return `
                            <button class="option-btn ${selected ? 'selected' : ''}" data-letter="${letter}"
                                    onclick="Exam.selectAnswer('${letter}')">
                                <span class="option-letter">${letter}</span>
                                <span>${Study.escapeHtml(q.options[letter] || '')}</span>
                            </button>
                        `;
                    }).join('')}
                </div>

                <div class="flex justify-between items-center mt-16">
                    <button class="btn btn-sm ${this.flagged.has(q.id) ? 'btn-secondary' : 'btn-outline'}"
                            style="${this.flagged.has(q.id) ? '' : 'border-color:var(--border);color:var(--text-light)'}"
                            onclick="Exam.toggleFlag()">
                        🚩 ${this.flagged.has(q.id) ? 'Marcada' : 'Marcar'}
                    </button>
                    <div class="btn-group">
                        ${this.currentIndex > 0 ? `<button class="btn btn-sm btn-primary" onclick="Exam.goTo(${this.currentIndex - 1})">← Anterior</button>` : ''}
                        ${this.currentIndex < total - 1
                            ? `<button class="btn btn-sm btn-primary" onclick="Exam.goTo(${this.currentIndex + 1})">Próxima →</button>`
                            : `<button class="btn btn-sm btn-danger" onclick="Exam.confirmFinish()">Finalizar Prova</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    },

    selectAnswer(letter) {
        const q = this.questions[this.currentIndex];
        this.answers[q.id] = letter;
        this.renderExamQuestion();
    },

    toggleFlag() {
        const q = this.questions[this.currentIndex];
        if (this.flagged.has(q.id)) this.flagged.delete(q.id);
        else this.flagged.add(q.id);
        this.renderExamQuestion();
    },

    goTo(index) {
        this.currentIndex = index;
        this.renderExamQuestion();
    },

    confirmFinish() {
        const unanswered = this.questions.length - Object.keys(this.answers).length;
        const msg = unanswered > 0
            ? `Você tem ${unanswered} questão(ões) sem resposta. Deseja finalizar mesmo assim?`
            : 'Deseja finalizar a prova?';

        if (confirm(msg)) {
            this.finish();
        }
    },

    finish() {
        this.cleanup();
        this.finished = true;
        const finishTime = new Date();

        // Calculate results
        let score = 0;
        const byArea = {};
        const areas = ['lingua_portuguesa', 'matematica', 'geografia_historia', 'ciencias'];
        areas.forEach(a => { byArea[a] = { correct: 0, total: 0 }; });

        this.questions.forEach(q => {
            const selected = this.answers[q.id] || null;
            const isCorrect = selected === q.answer;
            if (isCorrect) score++;

            if (byArea[q.area]) {
                byArea[q.area].total++;
                if (isCorrect) byArea[q.area].correct++;
            }

            // Save each attempt
            Storage.saveAttempt(q.id, selected, isCorrect, 'exam');
        });

        // Save exam
        Storage.saveExam({
            type: this.examType,
            started_at: this.startTime.toISOString(),
            finished_at: finishTime.toISOString(),
            questions: this.questions.map(q => q.id),
            score,
            total: this.questions.length,
            by_area: byArea,
            answers: { ...this.answers }
        });

        this.renderResult(score, byArea, finishTime);
    },

    renderResult(score, byArea, finishTime) {
        const main = document.getElementById('main-content');
        const total = this.questions.length;
        const pct = Math.round((score / total) * 100);
        const duration = Math.round((finishTime - this.startTime) / 1000);
        const areaColors = {
            lingua_portuguesa: 'var(--color-lp)',
            matematica: 'var(--color-mat)',
            geografia_historia: 'var(--color-gh)',
            ciencias: 'var(--color-cie)'
        };

        main.innerHTML = `
            <div class="card" style="max-width:700px;margin:0 auto">
                <h1 class="text-center">Resultado do Simulado</h1>
                <div class="result-score" style="color:${pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--secondary)' : 'var(--danger)'}">
                    ${score}/${total}
                </div>
                <p class="text-center text-muted mb-24">${pct}% de acerto • Tempo: ${this.formatDuration(duration)}</p>

                <h3 class="mb-16">Desempenho por Área</h3>
                ${Object.entries(byArea).map(([area, data]) => {
                    const areaPct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    return `
                        <div class="result-bar">
                            <span class="result-bar-label">${DataStore.getAreaLabel(area)}</span>
                            <div class="result-bar-track">
                                <div class="result-bar-fill" style="width:${areaPct}%;background:${areaColors[area] || '#999'}">
                                    ${data.correct}/${data.total}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}

                <div class="btn-group mt-24" style="justify-content:center">
                    <button class="btn btn-primary" onclick="Exam.renderReview()">📋 Revisar Questões</button>
                    <button class="btn btn-secondary" onclick="Exam.render()">Novo Simulado</button>
                    <button class="btn btn-accent" onclick="location.hash='#/desempenho'">Ver Desempenho</button>
                </div>
            </div>
        `;
    },

    renderReview() {
        const main = document.getElementById('main-content');

        main.innerHTML = `
            <div class="flex justify-between items-center mb-16">
                <h1 class="section-title" style="margin:0">Revisão do Simulado</h1>
                <button class="btn btn-sm btn-primary" onclick="Exam.render()">Voltar</button>
            </div>
            ${this.questions.map((q, i) => {
                const selected = this.answers[q.id];
                const isCorrect = selected === q.answer;
                return `
                    <div class="question-card" style="border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
                        <div class="question-meta">
                            <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">${isCorrect ? '✅ Correto' : '❌ Errado'}</span>
                            <span class="badge ${DataStore.getAreaBadgeClass(q.area)}">${DataStore.getAreaLabel(q.area)}</span>
                            <span class="question-number">Q${String(i+1).padStart(2,'0')} — Prova ${q.exam}</span>
                        </div>
                        ${q.image_path ? `<img src="${q.image_path}" class="question-image" alt="Imagem da questão" loading="lazy">` : ''}
                        <div class="question-text">${Study.escapeHtml(q.text)}</div>
                        <div class="options-list">
                            ${['A','B','C','D','E'].map(letter => {
                                let cls = 'option-btn disabled';
                                if (letter === q.answer) cls += ' correct';
                                if (letter === selected && !isCorrect) cls += ' wrong';
                                return `
                                    <div class="${cls}">
                                        <span class="option-letter">${letter}</span>
                                        <span>${Study.escapeHtml(q.options[letter] || '')}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        ${q.explanation?.summary ? `
                            <div class="explanation-box">
                                <p>${Study.escapeHtml(q.explanation.summary)}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        `;
    },

    reviewExam(examId) {
        const examData = Storage.getExamById(examId);
        if (!examData) return;

        this.questions = examData.questions.map(id => DataStore.getQuestionById(id)).filter(Boolean);
        this.answers = examData.answers || {};
        this.finished = true;
        this.renderReview();
    }
};
