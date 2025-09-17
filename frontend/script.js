let currentSection = 'home';
let currentSubject = '';
let timerInterval;
let timeLeft = 900;
let currentQuestion = 1;
let totalQuestions = 5;
let score = 0;
let correctAnswers = 0;
let incorrectAnswers = 0;
let currentQuestions = [];
let userAnswers = [];
let questionsData = [];
let authToken = null;
let currentUser = null;

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://smarttest-1.onrender.com/api';

const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.nav-link');
const subjectCards = document.querySelectorAll('.subject-card');
const nextQuestionBtn = document.getElementById('next-question');
const quizFeedback = document.getElementById('quiz-feedback');
const progressFill = document.getElementById('progress-fill');
const timer = document.getElementById('timer');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const goToRegister = document.getElementById('goToRegister');
const goToLogin = document.getElementById('goToLogin');
const startJourneyBtn = document.getElementById('startJourney');
const backToSubjectsBtn = document.getElementById('back-to-subjects');
const tryAgainBtn = document.getElementById('try-again');

document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    authToken = localStorage.getItem('authToken');
    
    setupNavigation();
    setupModals();
    setupQuiz();
    setupActionButtons();
    
    if (authToken) {
        updateAuthUI(true);
        loadUserProfile();
        loadRanking();
    }
}

function updateAuthUI(isLoggedIn) {
    if (loginBtn && registerBtn) {
        loginBtn.style.display = isLoggedIn ? 'none' : 'inline-block';
        registerBtn.style.display = isLoggedIn ? 'none' : 'inline-block';
    }
    
    if (isLoggedIn && currentUser) {
        updateProfileDisplay();
    }
}

async function authenticatedFetch(url, options = {}) {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            handleAuthError();
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

function handleAuthError() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    updateAuthUI(false);
    clearProfileDisplay();
    showNotification('Sessão expirada. Faça login novamente.', 'error');
}

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');

            if ((sectionId === 'ranking' || sectionId === 'profile') && !authToken) {
                showNotification('Faça login para acessar esta seção', 'warning');
                if (loginModal) loginModal.classList.add('show');
                return;
            }

            showSection(sectionId);
        });
    });
}

async function loadUserProfile() {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/profile`);
        if (!response) return;

        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            updateProfileDisplay();
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

function updateProfileDisplay() {
    if (!currentUser) return;

    // Atualizar nome do usuário
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.textContent = currentUser.name;
    }

    // Atualizar email do usuário
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = currentUser.email;
    }

    // Atualizar pontos do usuário
    const userPointsEl = document.getElementById('user-points');
    if (userPointsEl) {
        userPointsEl.textContent = `${currentUser.points} pontos`;
    }

    // Atualizar avatar (primeira letra do nome)
    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) {
        userAvatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
    }

    // Atualizar data de cadastro se existir
    const memberSinceEl = document.getElementById('member-since');
    if (memberSinceEl && currentUser.createdAt) {
        const date = new Date(currentUser.createdAt);
        const formattedDate = date.toLocaleDateString('pt-BR');
        memberSinceEl.textContent = `Membro desde ${formattedDate}`;
    }
}

function clearProfileDisplay() {
    const elements = [
        'user-name',
        'user-email', 
        'user-points',
        'user-avatar',
        'member-since'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '';
        }
    });
}

function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });

    currentSection = sectionId;

    if (sectionId === 'quiz') {
        startTimer();
    } else if (sectionId === 'ranking') {
        loadRanking();
    } else if (sectionId === 'profile') {
        loadUserProfile();
    }
}

function setupModals() {
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (loginModal) loginModal.classList.add('show');
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            if (registerModal) registerModal.classList.add('show');
        });
    }

    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (loginModal) loginModal.classList.remove('show');
            if (registerModal) registerModal.classList.remove('show');
        });
    });

    if (goToRegister) {
        goToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.classList.remove('show');
            if (registerModal) registerModal.classList.add('show');
        });
    }

    if (goToLogin) {
        goToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (registerModal) registerModal.classList.remove('show');
            if (loginModal) loginModal.classList.add('show');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === loginModal && loginModal) {
            loginModal.classList.remove('show');
        }
        if (e.target === registerModal && registerModal) {
            registerModal.classList.remove('show');
        }
    });

    setupAuthForms();
}

function setupAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;

    if (!email || !password) {
        showNotification('Preencha todos os campos', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateAuthUI(true);
            if (loginModal) loginModal.classList.remove('show');
            showNotification('Login realizado com sucesso!', 'success');
            document.getElementById('loginForm').reset();
        } else {
            showNotification(data.message || 'Erro ao fazer login', 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showNotification('Erro de conexão. Tente novamente.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('name')?.value;
    const email = document.getElementById('register-email')?.value;
    const password = document.getElementById('register-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;

    if (!name || !email || !password || !confirmPassword) {
        showNotification('Preencha todos os campos', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('As senhas não coincidem', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('A senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateAuthUI(true);
            if (registerModal) registerModal.classList.remove('show');
            showNotification('Conta criada com sucesso!', 'success');
            document.getElementById('registerForm').reset();
        } else {
            showNotification(data.message || 'Erro ao criar conta', 'error');
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        showNotification('Erro de conexão. Tente novamente.', 'error');
    }
}

function setupQuiz() {
    subjectCards.forEach(card => {
        card.addEventListener('click', async () => {
            if (!authToken) {
                showNotification('Faça login para iniciar o simulado', 'warning');
                if (loginModal) loginModal.classList.add('show');
                return;
            }

            currentSubject = card.getAttribute('data-subject');
            
            const quizSubjectEl = document.getElementById('quiz-subject');
            const resultSubjectEl = document.getElementById('result-subject');
            
            if (quizSubjectEl) quizSubjectEl.textContent = capitalizeFirstLetter(currentSubject);
            if (resultSubjectEl) resultSubjectEl.textContent = capitalizeFirstLetter(currentSubject);

            await loadQuestions();
            showSection('quiz');
        });
    });

    if (nextQuestionBtn) {
        nextQuestionBtn.addEventListener('click', () => {
            if (currentQuestion < totalQuestions) {
                currentQuestion++;
                updateQuestionProgress();
                loadCurrentQuestion();
            } else {
                finishQuiz();
            }
        });
    }
}

async function loadQuestions() {
    const container = document.querySelector('.question-container');
    if (!container) return;

    showLoadingQuestions(container);

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/generate-questions`, {
            method: 'POST',
            body: JSON.stringify({
                subject: currentSubject,
                difficulty: 'medium',
                count: 5
            })
        });

        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            currentQuestions = data.questions;
            questionsData = data._questionsData || [];
            totalQuestions = data.total;
            userAnswers = new Array(totalQuestions);
            currentQuestion = 1;

            setupQuestionContainer(container);
            setupQuizOptions();
            updateQuestionProgress();
            loadCurrentQuestion();

            console.log(`Questões carregadas: ${data.source === 'gemini' ? 'IA Gemini' : 'Banco de dados'}`);
        } else {
            showErrorMessage(container, data.message || 'Erro ao gerar questões');
        }
    } catch (error) {
        console.error('Erro ao carregar questões:', error);
        showErrorMessage(container, 'Erro de conexão. Tente novamente.');
    }
}

function showLoadingQuestions(container) {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 20px;"></i>
            <p>Gerando questões personalizadas...</p>
            <p style="font-size: 0.9rem; color: #666;">Aguarde alguns segundos</p>
        </div>
    `;
}

function showErrorMessage(container, message) {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ff6b6b; margin-bottom: 20px;"></i>
            <p>${message}</p>
            <button onclick="loadQuestions()" class="btn btn-primary" style="margin-top: 20px;">Tentar Novamente</button>
        </div>
    `;
}

function setupQuestionContainer(container) {
    container.innerHTML = `
        <div class="question-card">
            <h3 id="question-text"></h3>
            <div class="options-container">
                <div class="option" data-option="A">
                    <span class="option-letter">A</span>
                    <span class="option-text"></span>
                </div>
                <div class="option" data-option="B">
                    <span class="option-letter">B</span>
                    <span class="option-text"></span>
                </div>
                <div class="option" data-option="C">
                    <span class="option-letter">C</span>
                    <span class="option-text"></span>
                </div>
                <div class="option" data-option="D">
                    <span class="option-letter">D</span>
                    <span class="option-text"></span>
                </div>
            </div>
        </div>
    `;
}

function setupQuizOptions() {
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            const selectedIndex = Array.from(option.parentNode.children).indexOf(option);
            userAnswers[currentQuestion - 1] = selectedIndex;
        });
    });
}

function loadCurrentQuestion() {
    if (currentQuestions.length === 0) return;

    const question = currentQuestions[currentQuestion - 1];
    const questionTextEl = document.getElementById('question-text');
    
    if (questionTextEl) {
        questionTextEl.textContent = question.question;
    }

    const optionElements = document.querySelectorAll('.option');
    optionElements.forEach((option, index) => {
        if (question.options[index]) {
            const optionText = option.querySelector('.option-text');
            if (optionText) {
                optionText.textContent = question.options[index];
            }
            option.style.display = 'flex';
            option.classList.remove('selected', 'correct', 'incorrect');
        } else {
            option.style.display = 'none';
        }
    });

    if (userAnswers[currentQuestion - 1] !== undefined) {
        optionElements[userAnswers[currentQuestion - 1]]?.classList.add('selected');
    }
}

async function finishQuiz() {
    clearInterval(timerInterval);
    showSection('results');

    const resultsContent = document.querySelector('.results-content');
    if (resultsContent) {
        showLoadingResults(resultsContent);

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/submit-quiz`, {
                method: 'POST',
                body: JSON.stringify({
                    subject: currentSubject,
                    answers: userAnswers.filter(answer => answer !== undefined),
                    questionsData: questionsData
                })
            });

            if (!response) return;

            const data = await response.json();

            if (response.ok) {
                hideLoadingResults(resultsContent);
                updateResults(data);
            } else {
                hideLoadingResults(resultsContent);
                showNotification(data.message || 'Erro ao processar resultado', 'error');
            }
        } catch (error) {
            console.error('Erro ao finalizar quiz:', error);
            hideLoadingResults(resultsContent);
            showNotification('Erro de conexão. Tente novamente.', 'error');
        }
    }
}

function showLoadingResults(resultsContent) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-results';
    loadingDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 20px;"></i>
            <p>Analisando suas respostas...</p>
            <p style="font-size: 0.9rem; color: #666;">Gerando recomendações</p>
        </div>
    `;
    
    resultsContent.style.display = 'none';
    resultsContent.parentNode.appendChild(loadingDiv);
}

function hideLoadingResults(resultsContent) {
    const loadingDiv = document.getElementById('loading-results');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    resultsContent.style.display = 'block';
}

function updateResults(data) {
    const scorePercentEl = document.getElementById('score-percent');
    const correctAnswersEl = document.getElementById('correct-answers');
    const incorrectAnswersEl = document.getElementById('incorrect-answers');
    const timeSpentEl = document.getElementById('time-spent');

    if (scorePercentEl) scorePercentEl.textContent = `${data.accuracy}%`;
    if (correctAnswersEl) correctAnswersEl.textContent = data.correctAnswers;
    if (incorrectAnswersEl) incorrectAnswersEl.textContent = data.totalQuestions - data.correctAnswers;

    const timeSpent = 900 - timeLeft;
    const minutesSpent = Math.floor(timeSpent / 60);
    const secondsSpent = timeSpent % 60;
    if (timeSpentEl) {
        timeSpentEl.textContent = `${minutesSpent.toString().padStart(2, '0')}:${secondsSpent.toString().padStart(2, '0')}`;
    }

    updateRecommendations(data.recommendations);
    updateProgressCircle(data.accuracy);
}

function updateRecommendations(recommendations) {
    const recommendationsList = document.querySelector('.recommendations-list');
    if (!recommendationsList) return;

    recommendationsList.innerHTML = '';
    recommendations.forEach(rec => {
        const div = document.createElement('div');
        div.className = 'recommendation';
        div.innerHTML = `<i class="fas fa-lightbulb"></i><p>${rec}</p>`;
        recommendationsList.appendChild(div);
    });
}

async function loadRanking() {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/ranking`);
        if (!response) return;

        const data = await response.json();
        if (response.ok) {
            updateRankingDisplay(data.ranking);
        }
    } catch (error) {
        console.error('Erro ao carregar ranking:', error);
    }
}

function updateRankingDisplay(ranking) {
    const rankingList = document.querySelector('.ranking-list');
    if (!rankingList) return;

    rankingList.innerHTML = '';

    ranking.slice(0, 10).forEach((user, index) => {
        const div = document.createElement('div');
        div.className = `ranking-item ${index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : ''}`;

        div.innerHTML = `
            <div class="rank">${user.position}</div>
            <div class="user-info">
                <div class="avatar">${user.avatar}</div>
                <div class="name-points">
                    <span class="name">${user.name}</span>
                    <span class="points">${user.points} pontos</span>
                </div>
            </div>
            <div class="badges">
                <i class="fas ${index < 3 ? 'fa-trophy' : 'fa-star'}"></i>
            </div>
        `;

        rankingList.appendChild(div);
    });
}

function updateProgressCircle(percentage) {
    const circle = document.querySelector('.progress-ring-circle.fill');
    if (!circle) return;

    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 900;

    timerInterval = setInterval(() => {
        timeLeft--;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        if (timer) {
            timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            finishQuiz();
        }
    }, 1000);
}

function updateQuestionProgress() {
    const currentQuestionEl = document.getElementById('current-question');
    const totalQuestionsEl = document.getElementById('total-questions');
    
    if (currentQuestionEl) currentQuestionEl.textContent = currentQuestion;
    if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions;
    
    if (progressFill) {
        const progressPercent = (currentQuestion / totalQuestions) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }
}

function setupActionButtons() {
    if (startJourneyBtn) {
        startJourneyBtn.addEventListener('click', () => {
            showSection('subjects');
        });
    }

    if (backToSubjectsBtn) {
        backToSubjectsBtn.addEventListener('click', () => {
            resetQuiz();
            showSection('subjects');
        });
    }

    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
            resetQuiz();
            loadQuestions();
        });
    }
}

function resetQuiz() {
    currentQuestion = 1;
    score = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    currentQuestions = [];
    userAnswers = [];
    questionsData = [];
    clearInterval(timerInterval);
    updateQuestionProgress();
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    document.body.appendChild(notification);

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

window.loadQuestions = loadQuestions;