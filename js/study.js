/* ============================================
   Study Mode — Practice by topic
   ============================================ */

const Study = {
    currentQuestions: [],
    currentIndex: 0,
    sessionCorrect: 0,
    sessionTotal: 0,
    answered: false,

    render() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <h1 class="section-title">📖 Modo Estudo</h1>
            <p class="text-muted mb-16">Selecione uma área e tema para praticar.</p>

            <div class="grid grid-4 mb-24" id="area-selector">
                ${DataStore.getAllAreas().map(a => `
                    <div class="area-card ${DataStore.getAreaCardClass(a.key)}"
                         onclick="Study.selectArea('${a.key}')">
                        <h3>${a.icon} ${a.label}</h3>
                        <p>${a.count} questões</p>
                    </div>
                `).join('')}
            </div>

            <div id="topic-selector" style="display:none"></div>
            <div id="study-session" style="display:none"></div>
        `;
    },

    selectArea(areaKey) {
        const topics = DataStore.getTopicsForArea(areaKey);
        const areaLabel = DataStore.getAreaLabel(areaKey);
        const totalQuestions = DataStore.getQuestionsByArea(areaKey).length;

        document.getElementById('topic-selector').style.display = 'block';
        document.getElementById('topic-selector').innerHTML = `
            <div class="card mb-16">
                <div class="card-header">
                    <h2>${areaLabel}</h2>
                    <button class="btn btn-sm btn-primary" onclick="Study.startSession('${areaKey}')">
                        Todas (${totalQuestions})
                    </button>
                </div>
                <div>
                    ${topics.map(t => `
                        <div class="topic-item" onclick="Study.startSession('${areaKey}', '${t.key}')">
                            <span class="topic-name">${t.label}</span>
                            <span class="topic-count">${t.count} questões</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Highlight selected area
        document.querySelectorAll('.area-card').forEach(el => el.classList.remove('selected'));
        event.currentTarget?.classList.add('selected');
    },

    startSession(area, topic = null) {
        let questions = topic
            ? DataStore.getQuestionsByTopic(area, topic)
            : DataStore.getQuestionsByArea(area);

        this.currentQuestions = DataStore.shuffle(questions);
        this.currentIndex = 0;
        this.sessionCorrect = 0;
        this.sessionTotal = 0;
        this.answered = false;

        document.getElementById('area-selector').style.display = 'none';
        document.getElementById('topic-selector').style.display = 'none';
        document.getElementById('study-session').style.display = 'block';

        this.renderQuestion();
    },

    renderQuestion() {
        if (this.currentIndex >= this.currentQuestions.length) {
            this.renderSessionEnd();
            return;
        }

        const q = this.currentQuestions[this.currentIndex];
        const container = document.getElementById('study-session');
        this.answered = false;

        container.innerHTML = `
            <div class="session-counter">
                <div class="session-stat">
                    <div class="session-stat-value">${this.currentIndex + 1}/${this.currentQuestions.length}</div>
                    <div class="session-stat-label">Questão</div>
                </div>
                <div class="session-stat">
                    <div class="session-stat-value text-success">${this.sessionCorrect}</div>
                    <div class="session-stat-label">Acertos</div>
                </div>
                <div class="session-stat">
                    <div class="session-stat-value text-danger">${this.sessionTotal - this.sessionCorrect}</div>
                    <div class="session-stat-label">Erros</div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="Study.render()" style="margin-left:auto">Encerrar</button>
            </div>

            <div class="question-card fade-in">
                <div class="question-meta">
                    <span class="badge ${DataStore.getAreaBadgeClass(q.area)}">${DataStore.getAreaLabel(q.area)}</span>
                    <span class="badge badge-warning">${DataStore.getTopicLabel(q.area, q.topic)}</span>
                    <span class="question-number">Prova ${q.exam} — Q${String(q.number).padStart(2, '0')}</span>
                    ${q.has_image && !q.image_path ? '<span class="badge badge-warning">📷 Imagem</span>' : ''}
                </div>

                ${q.supporting_text ? `
                    <div class="question-supporting-text">${this.escapeHtml(q.supporting_text)}</div>
                ` : ''}

                ${q.image_path ? `<img src="${q.image_path}" class="question-image" alt="Imagem da questão ${q.number}" loading="lazy">` : ''}

                <div class="question-text">${this.escapeHtml(q.text)}</div>

                <div class="options-list" id="options-list">
                    ${['A', 'B', 'C', 'D', 'E'].map(letter => `
                        <button class="option-btn" data-letter="${letter}"
                                onclick="Study.selectOption('${letter}')">
                            <span class="option-letter">${letter}</span>
                            <span>${this.escapeHtml(q.options[letter] || '')}</span>
                        </button>
                    `).join('')}
                </div>

                <div id="feedback-area"></div>
            </div>
        `;
    },

    selectOption(letter) {
        if (this.answered) return;
        this.answered = true;

        const q = this.currentQuestions[this.currentIndex];
        const isCorrect = letter === q.answer;

        this.sessionTotal++;
        if (isCorrect) this.sessionCorrect++;

        // Save attempt
        Storage.saveAttempt(q.id, letter, isCorrect, 'study');

        // Highlight options
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.add('disabled');
            const l = btn.dataset.letter;
            if (l === q.answer) btn.classList.add('correct');
            if (l === letter && !isCorrect) btn.classList.add('wrong');
        });

        // Show explanation
        const feedback = document.getElementById('feedback-area');
        const explanation = q.explanation || {};

        feedback.innerHTML = `
            <div class="explanation-box">
                <h4>${isCorrect ? '✅ Correto!' : '❌ Incorreto'}</h4>
                ${explanation.summary ? `<p><strong>Explicação:</strong> ${this.escapeHtml(explanation.summary)}</p>` : ''}
                ${explanation.correct ? `<p class="text-success">${this.escapeHtml(explanation.correct)}</p>` : ''}
                ${!isCorrect && explanation.wrong && explanation.wrong[letter]
                    ? `<p class="wrong-explanation">Sua resposta (${letter}): ${this.escapeHtml(explanation.wrong[letter])}</p>`
                    : ''}
                <button class="btn btn-primary mt-16" onclick="Study.nextQuestion()">
                    ${this.currentIndex + 1 < this.currentQuestions.length ? 'Próxima Questão →' : 'Ver Resultado'}
                </button>
            </div>
        `;
    },

    nextQuestion() {
        this.currentIndex++;
        this.renderQuestion();
    },

    renderSessionEnd() {
        const pct = this.sessionTotal > 0 ? Math.round((this.sessionCorrect / this.sessionTotal) * 100) : 0;
        const container = document.getElementById('study-session');

        container.innerHTML = `
            <div class="card text-center" style="max-width:500px;margin:0 auto;">
                <h2>Sessão de Estudo Finalizada!</h2>
                <div class="result-score" style="color:${pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--secondary)' : 'var(--danger)'}">
                    ${pct}%
                </div>
                <p class="mb-16">${this.sessionCorrect} acertos de ${this.sessionTotal} questões</p>
                <div class="progress-bar mb-24">
                    <div class="progress-fill" style="width:${pct}%;background:${pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--secondary)' : 'var(--danger)'}"></div>
                </div>
                <div class="btn-group" style="justify-content:center">
                    <button class="btn btn-primary" onclick="Study.render()">Nova Sessão</button>
                    <button class="btn btn-accent" onclick="location.hash='#/desempenho'">Ver Desempenho</button>
                </div>
            </div>
        `;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
