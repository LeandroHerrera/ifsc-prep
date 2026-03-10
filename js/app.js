/* ============================================
   App — Router, initialization, home page
   ============================================ */

const App = {
    currentRoute: '',

    async init() {
        // Show loading
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⏳</div>
                <h3>Carregando dados...</h3>
            </div>
        `;

        // Load data
        const ok = await DataStore.init();
        if (!ok) {
            main.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Erro ao carregar dados</h3>
                    <p>Verifique se os arquivos JSON estão na pasta <code>data/</code>.</p>
                </div>
            `;
            return;
        }

        // Setup router
        window.addEventListener('hashchange', () => this.route());

        // Setup menu toggle
        const toggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
            // Close sidebar on nav click (mobile)
            sidebar.querySelectorAll('.nav-link').forEach(item => {
                item.addEventListener('click', () => {
                    sidebar.classList.remove('open');
                });
            });
        }

        // Initial route
        this.route();
    },

    route() {
        const hash = location.hash || '#/';
        this.currentRoute = hash;

        // Update active nav (sidebar + bottom nav)
        document.querySelectorAll('.nav-link, .bottom-link').forEach(item => {
            item.classList.toggle('active', item.getAttribute('href') === hash);
        });

        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('open');

        // Route to page
        switch (hash) {
            case '#/estudo':
                Study.render();
                break;
            case '#/simulado':
                Exam.render();
                break;
            case '#/desempenho':
                Analytics.render();
                break;
            case '#/tendencias':
                Trends.render();
                break;
            case '#/guia':
                Guide.render();
                break;
            default:
                this.renderHome();
        }

        // Scroll to top
        window.scrollTo(0, 0);
    },

    renderHome() {
        const main = document.getElementById('main-content');
        const totalQ = DataStore.questions.length;
        const areas = DataStore.getAllAreas();
        const attempts = Storage.getAttempts();
        const uniqueQ = Storage.getUniqueQuestionsAnswered();
        const globalAcc = Storage.getGlobalAccuracy();

        main.innerHTML = `
            <div class="hero">
                <h1>🎓 IFSC Prep</h1>
                <p>Banco de Questões Inteligente para o Exame de Classificação</p>
                <p class="text-muted mt-16" style="font-size:1.1rem">Cada questão resolvida te deixa mais perto! 💪</p>
            </div>

            <div class="grid grid-4 mb-24">
                <div class="stat-card">
                    <div class="stat-value text-primary">${totalQ}</div>
                    <div class="stat-label">Questões no Banco</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${DataStore.exams.length}</div>
                    <div class="stat-label">Provas Históricas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-success">${uniqueQ}</div>
                    <div class="stat-label">Questões Resolvidas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color:${globalAcc >= 70 ? 'var(--success)' : globalAcc >= 50 ? 'var(--secondary)' : 'var(--danger)'}">${globalAcc}%</div>
                    <div class="stat-label">Acerto Global</div>
                </div>
            </div>

            <div class="grid grid-2 mb-24">
                <div class="card">
                    <h3 class="mb-16">📖 Começar a Estudar</h3>
                    <p class="text-muted mb-16">Escolha uma área e pratique questões com feedback imediato.</p>
                    <div class="grid grid-2" style="gap:8px">
                        ${areas.map(a => `
                            <button class="area-card ${DataStore.getAreaCardClass(a.key)}"
                                    onclick="location.hash='#/estudo';setTimeout(()=>Study.selectArea('${a.key}'),100)"
                                    style="text-align:left;padding:12px;cursor:pointer;border:none">
                                <strong>${a.icon} ${a.label}</strong>
                                <div class="text-muted" style="font-size:0.8rem">${a.count} questões</div>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="card">
                    <h3 class="mb-16">📝 Simulados</h3>
                    <p class="text-muted mb-16">Simule a prova real com cronômetro e condições idênticas.</p>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <a href="#/simulado" class="btn btn-primary" style="text-align:center">
                            Simulado Completo (28q / 4h)
                        </a>
                        <a href="#/simulado" class="btn btn-accent" style="text-align:center">
                            Simulado Rápido (14q / 2h)
                        </a>
                        <a href="#/simulado" class="btn btn-sm" style="text-align:center;background:var(--bg-card);border:1px solid var(--border)">
                            Simulado Adaptativo
                        </a>
                    </div>
                </div>
            </div>

            ${attempts.length > 0 ? `
                <div class="card mb-24">
                    <h3 class="mb-16">🎯 Seus Temas Prioritários</h3>
                    ${this.renderQuickRecommendations()}
                </div>
            ` : ''}

            <div class="grid grid-2 mb-24">
                <a href="#/tendencias" class="card" style="text-decoration:none;color:inherit">
                    <h3>📈 Tendências</h3>
                    <p class="text-muted">Descubra quais temas têm mais chance de cair na próxima prova.</p>
                </a>
                <a href="#/guia" class="card" style="text-decoration:none;color:inherit">
                    <h3>🎯 Guia de Estudos</h3>
                    <p class="text-muted">Lista priorizada de temas para estudar, baseada na sua performance.</p>
                </a>
            </div>
        `;
    },

    renderQuickRecommendations() {
        const weak = Storage.getWeakTopics(3);
        if (weak.length === 0) {
            return '<p class="text-muted">Resolva mais questões para ver recomendações.</p>';
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
            <a href="#/guia" class="btn btn-sm mt-8" style="display:inline-block">Ver guia completo →</a>
        `;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
