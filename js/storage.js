/* ============================================
   Storage — localStorage abstraction
   ============================================ */

const Storage = {
    KEY: 'ifsc-prep-progress',

    _getStore() {
        try {
            const raw = localStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : this._defaultStore();
        } catch {
            return this._defaultStore();
        }
    },

    _defaultStore() {
        return {
            student: { started_at: new Date().toISOString().split('T')[0] },
            attempts: [],
            exams: [],
            studiedTopics: [],
            settings: {}
        };
    },

    _save(store) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(store));
        } catch (e) {
            console.error('Storage full or unavailable:', e);
        }
    },

    // --- Attempts ---

    saveAttempt(questionId, selected, correct, context = 'study', timeSpent = 0) {
        const store = this._getStore();
        store.attempts.push({
            question_id: questionId,
            selected,
            correct,
            timestamp: new Date().toISOString(),
            time_spent_seconds: timeSpent,
            context
        });
        this._save(store);
    },

    getAttempts() {
        return this._getStore().attempts;
    },

    getAttemptsForQuestion(questionId) {
        return this.getAttempts().filter(a => a.question_id === questionId);
    },

    // --- Exams ---

    saveExam(examData) {
        const store = this._getStore();
        examData.id = 'sim-' + Date.now();
        store.exams.push(examData);
        this._save(store);
        return examData.id;
    },

    getExams() {
        return this._getStore().exams;
    },

    getExamById(id) {
        return this.getExams().find(e => e.id === id);
    },

    // --- Studied Topics ---

    toggleStudiedTopic(topicKey) {
        const store = this._getStore();
        const idx = store.studiedTopics.indexOf(topicKey);
        if (idx >= 0) {
            store.studiedTopics.splice(idx, 1);
        } else {
            store.studiedTopics.push(topicKey);
        }
        this._save(store);
    },

    getStudiedTopics() {
        return this._getStore().studiedTopics;
    },

    // --- Analytics Helpers ---

    getAccuracyByArea() {
        const attempts = this.getAttempts();
        const areas = {};
        attempts.forEach(a => {
            const q = DataStore.getQuestionById(a.question_id);
            if (!q) return;
            if (!areas[q.area]) areas[q.area] = { correct: 0, total: 0 };
            areas[q.area].total++;
            if (a.correct) areas[q.area].correct++;
        });
        return areas;
    },

    getAccuracyByTopic() {
        const attempts = this.getAttempts();
        const topics = {};
        attempts.forEach(a => {
            const q = DataStore.getQuestionById(a.question_id);
            if (!q) return;
            const key = `${q.area}/${q.topic}`;
            if (!topics[key]) topics[key] = { correct: 0, total: 0, area: q.area, topic: q.topic };
            topics[key].total++;
            if (a.correct) topics[key].correct++;
        });
        return topics;
    },

    getUniqueQuestionsAnswered() {
        const ids = new Set(this.getAttempts().map(a => a.question_id));
        return ids.size;
    },

    getGlobalAccuracy() {
        const attempts = this.getAttempts();
        if (attempts.length === 0) return 0;
        const correct = attempts.filter(a => a.correct).length;
        return Math.round((correct / attempts.length) * 100);
    },

    getDaysStudying() {
        const attempts = this.getAttempts();
        if (attempts.length === 0) return 0;
        const days = new Set(attempts.map(a => a.timestamp.split('T')[0]));
        return days.size;
    },

    getWeakTopics(limit = 5) {
        const topicAccuracy = this.getAccuracyByTopic();
        return Object.values(topicAccuracy)
            .filter(t => t.total >= 2)
            .map(t => ({ ...t, accuracy: t.correct / t.total }))
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, limit);
    },

    // --- Export/Import ---

    exportData() {
        const store = this._getStore();
        const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ifsc-prep-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.attempts && data.exams) {
                    this._save(data);
                    alert('Dados importados com sucesso! Recarregando...');
                    location.reload();
                } else {
                    alert('Arquivo inválido.');
                }
            } catch {
                alert('Erro ao ler o arquivo.');
            }
        };
        reader.readAsText(file);
    },

    clearProgress() {
        if (confirm('Tem certeza que deseja apagar todo o progresso? Esta ação não pode ser desfeita.')) {
            localStorage.removeItem(this.KEY);
            location.reload();
        }
    }
};
