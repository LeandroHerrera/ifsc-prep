/* ============================================
   DataStore — Load and index question data
   ============================================ */

const DataStore = {
    questions: [],
    topics: {},
    exams: [],
    syllabus: {},
    _indices: {
        byId: {},
        byArea: {},
        byTopic: {},
        byExam: {},
        bySubtopic: {}
    },

    async init() {
        try {
            const [questionsRes, topicsRes, examsRes, syllabusRes] = await Promise.all([
                fetch('data/questions.json'),
                fetch('data/topics.json'),
                fetch('data/exams.json'),
                fetch('data/syllabus.json')
            ]);

            this.questions = await questionsRes.json();
            this.topics = await topicsRes.json();
            this.exams = await examsRes.json();
            this.syllabus = await syllabusRes.json();

            this._buildIndices();
            console.log(`DataStore: loaded ${this.questions.length} questions`);
            return true;
        } catch (e) {
            console.error('Failed to load data:', e);
            return false;
        }
    },

    _buildIndices() {
        this._indices = { byId: {}, byArea: {}, byTopic: {}, byExam: {}, bySubtopic: {} };

        this.questions.forEach(q => {
            // By ID
            this._indices.byId[q.id] = q;

            // By Area
            if (!this._indices.byArea[q.area]) this._indices.byArea[q.area] = [];
            this._indices.byArea[q.area].push(q);

            // By Topic
            const topicKey = `${q.area}/${q.topic}`;
            if (!this._indices.byTopic[topicKey]) this._indices.byTopic[topicKey] = [];
            this._indices.byTopic[topicKey].push(q);

            // By Exam
            if (!this._indices.byExam[q.exam]) this._indices.byExam[q.exam] = [];
            this._indices.byExam[q.exam].push(q);

            // By Subtopic
            if (q.subtopic) {
                const stKey = `${q.area}/${q.topic}/${q.subtopic}`;
                if (!this._indices.bySubtopic[stKey]) this._indices.bySubtopic[stKey] = [];
                this._indices.bySubtopic[stKey].push(q);
            }
        });
    },

    // --- Query Methods ---

    getQuestionById(id) {
        return this._indices.byId[id] || null;
    },

    getQuestionsByArea(area) {
        return this._indices.byArea[area] || [];
    },

    getQuestionsByTopic(area, topic) {
        return this._indices.byTopic[`${area}/${topic}`] || [];
    },

    getQuestionsByExam(examId) {
        return this._indices.byExam[examId] || [];
    },

    filterQuestions({ area, topic, exam, difficulty, excludeIds = [] } = {}) {
        let result = this.questions;

        if (area) result = result.filter(q => q.area === area);
        if (topic) result = result.filter(q => q.topic === topic);
        if (exam) result = result.filter(q => q.exam === exam);
        if (difficulty) result = result.filter(q => q.difficulty === difficulty);
        if (excludeIds.length) {
            const set = new Set(excludeIds);
            result = result.filter(q => !set.has(q.id));
        }

        return result;
    },

    // --- Utility ---

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    getAreaLabel(areaKey) {
        return this.topics[areaKey]?.label || areaKey;
    },

    getAreaColor(areaKey) {
        return this.topics[areaKey]?.color || '#999';
    },

    getAreaBadgeClass(areaKey) {
        const map = {
            lingua_portuguesa: 'badge-lp',
            matematica: 'badge-mat',
            geografia_historia: 'badge-gh',
            ciencias: 'badge-cie'
        };
        return map[areaKey] || '';
    },

    getAreaCardClass(areaKey) {
        const map = {
            lingua_portuguesa: 'area-card-lp',
            matematica: 'area-card-mat',
            geografia_historia: 'area-card-gh',
            ciencias: 'area-card-cie'
        };
        return map[areaKey] || '';
    },

    getTopicLabel(areaKey, topicKey) {
        return this.topics[areaKey]?.topics?.[topicKey]?.label || topicKey;
    },

    getTopicsForArea(areaKey) {
        const areaDef = this.topics[areaKey];
        if (!areaDef) return [];
        return Object.entries(areaDef.topics).map(([key, val]) => {
            const questions = this.getQuestionsByTopic(areaKey, key);
            return { key, label: val.label, count: questions.length, subtopics: val.subtopics };
        }).filter(t => t.count > 0);
    },

    getAllAreas() {
        return Object.entries(this.topics).map(([key, val]) => ({
            key,
            label: val.label,
            icon: val.icon,
            color: val.color,
            count: this.getQuestionsByArea(key).length
        })).filter(a => a.count > 0);
    },

    // --- Exam Selection ---

    selectQuestionsForExam(type = 'complete') {
        const areas = ['lingua_portuguesa', 'matematica', 'geografia_historia', 'ciencias'];

        if (type === 'complete') {
            // 7 questions per area = 28 total
            let selected = [];
            areas.forEach(area => {
                const pool = this.shuffle(this.getQuestionsByArea(area));
                selected = selected.concat(pool.slice(0, 7));
            });
            return selected;
        }

        if (type === 'quick') {
            // 3-4 per area = ~14 total
            let selected = [];
            areas.forEach(area => {
                const pool = this.shuffle(this.getQuestionsByArea(area));
                const count = Math.random() < 0.5 ? 3 : 4;
                selected = selected.concat(pool.slice(0, count));
            });
            return selected.slice(0, 14);
        }

        if (type === 'adaptive') {
            // Prioritize weak topics
            const topicAccuracy = Storage.getAccuracyByTopic();
            let selected = [];

            areas.forEach(area => {
                const topics = this.getTopicsForArea(area);
                // Sort topics by accuracy (worst first)
                topics.sort((a, b) => {
                    const accA = topicAccuracy[`${area}/${a.key}`];
                    const accB = topicAccuracy[`${area}/${b.key}`];
                    const rateA = accA ? accA.correct / accA.total : 0.5;
                    const rateB = accB ? accB.correct / accB.total : 0.5;
                    return rateA - rateB;
                });

                let areaQuestions = [];
                for (const topic of topics) {
                    if (areaQuestions.length >= 7) break;
                    const pool = this.shuffle(this.getQuestionsByTopic(area, topic.key));
                    const needed = 7 - areaQuestions.length;
                    areaQuestions = areaQuestions.concat(pool.slice(0, Math.min(needed, 3)));
                }

                // Fill remaining from general pool
                if (areaQuestions.length < 7) {
                    const usedIds = new Set(areaQuestions.map(q => q.id));
                    const remaining = this.shuffle(
                        this.getQuestionsByArea(area).filter(q => !usedIds.has(q.id))
                    );
                    areaQuestions = areaQuestions.concat(remaining.slice(0, 7 - areaQuestions.length));
                }

                selected = selected.concat(areaQuestions.slice(0, 7));
            });

            return selected;
        }

        return [];
    },

    // --- Trend Analysis ---

    getTopicFrequencyByExam() {
        const frequency = {};
        const examIds = this.exams.map(e => e.id);

        this.questions.forEach(q => {
            const topicKey = `${q.area}/${q.topic}`;
            if (!frequency[topicKey]) {
                frequency[topicKey] = {
                    area: q.area,
                    topic: q.topic,
                    label: this.getTopicLabel(q.area, q.topic),
                    exams: {}
                };
            }
            if (!frequency[topicKey].exams[q.exam]) {
                frequency[topicKey].exams[q.exam] = 0;
            }
            frequency[topicKey].exams[q.exam]++;
        });

        return { frequency, examIds };
    }
};
