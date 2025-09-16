// Variáveis globais
let currentSection = 'home';
let currentSubject = '';
let timerInterval;
let timeLeft = 900; // 15 minutos em segundos
let currentQuestion = 1;
let totalQuestions = 5; // Reduzido para economizar API
let score = 0;
let correctAnswers = 0;
let incorrectAnswers = 0;
let currentQuestions = []; // Para armazenar as questões atuais
let userAnswers = []; // Para armazenar as respostas do usuário
let questionsData = []; // Para armazenar dados das questões incluindo respostas corretas
let authToken = localStorage.getItem('authToken'); // Token de autenticação

// Base URL da API - ALTERE ESTA URL APÓS O DEPLOY NO RENDER
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://smarttest-q17g.onrender.com';

// Elementos DOM
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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
    setupModals();
    setupQuiz();
    setupActionButtons();
    
    // Verificar se o usuário está logado
    if (authToken) {
        updateAuthUI(true);
        loadRanking();
    }
});

// Atualizar interface de autenticação
function updateAuthUI(isLoggedIn) {
    if (isLoggedIn) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        // Poderia adicionar botão de logout aqui
    } else {
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
    }
}

// Função para fazer requisições autenticadas
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

    const response = await fetch(url, config);
    
    if (response.status === 401) {
        // Token expirado, remover e redirecionar para login
        localStorage.removeItem('authToken');
        authToken = null;
        updateAuthUI(false);
        alert('Sessão expirada. Faça login novamente.');
        return null;
    }

    return response;
}

// Configuração da navegação
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            
            // Verificar se precisa de autenticação
            if ((sectionId === 'ranking' || sectionId === 'profile') && !authToken) {
                alert('Faça login para acessar esta seção');
                loginModal.classList.add('show');
                return;
            }
            
            showSection(sectionId);
        });
    });
}

// Mostrar seção específica
function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
    
    currentSection = sectionId;
    
    // Carregar dados específicos da seção
    if (sectionId === 'quiz') {
        startTimer();
    } else if (sectionId === 'ranking') {
        loadRanking();
    }
}

// Configuração dos modais
function setupModals() {
    loginBtn.addEventListener('click', () => {
        loginModal.classList.add('show');
    });
    
    registerBtn.addEventListener('click', () => {
        registerModal.classList.add('show');
    });
    
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            loginModal.classList.remove('show');
            registerModal.classList.remove('show');
        });
    });
    
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.remove('show');
        registerModal.classList.add('show');
    });
    
    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerModal.classList.remove('show');
        loginModal.classList.add('show');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.remove('show');
        }
        if (e.target === registerModal) {
            registerModal.classList.remove('show');
        }
    });
    
    // Formulário de login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                updateAuthUI(true);
                loginModal.classList.remove('show');
                alert('Login realizado com sucesso!');
            } else {
                alert(data.message || 'Erro ao fazer login');
            }
        } catch (error) {
            alert('Erro de conexão. Tente novamente.');
        }
    });
    
    // Formulário de registro
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (password !== confirmPassword) {
            alert('As senhas não coincidem');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                updateAuthUI(true);
                registerModal.classList.remove('show');
                alert('Conta criada com sucesso!');
            } else {
                alert(data.message || 'Erro ao criar conta');
            }
        } catch (error) {
            alert('Erro de conexão. Tente novamente.');
        }
    });
}

// Configuração do questionário
function setupQuiz() {
    subjectCards.forEach(card => {
        card.addEventListener('click', async () => {
            if (!authToken) {
                alert('Faça login para iniciar o simulado');
                loginModal.classList.add('show');
                return;
            }
            
            currentSubject = card.getAttribute('data-subject');
            document.getElementById('quiz-subject').textContent = 
                capitalizeFirstLetter(currentSubject);
            document.getElementById('result-subject').textContent = 
                capitalizeFirstLetter(currentSubject);
            
            // Carregar questões da API (com Gemini)
            await loadQuestions();
            showSection('quiz');
        });
    });
    
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

// Carregar questões da API com Gemini
async function loadQuestions() {
    try {
        // Mostrar loading
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-questions';
        loadingDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 20px;"></i>
                <p>Gerando questões personalizadas com IA Gemini...</p>
                <p style="font-size: 0.9rem; color: #666;">Isso pode levar alguns segundos</p>
            </div>
        `;
        
        const container = document.querySelector('.question-container');
        container.innerHTML = '';
        container.appendChild(loadingDiv);
        
        const response = await authenticatedFetch(`${API_BASE_URL}/generate-questions`, {
            method: 'POST',
            body: JSON.stringify({
                subject: currentSubject,
                difficulty: 'medium',
                count: 5 // Reduzido para economizar API do Gemini
            })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            currentQuestions = data.questions;
            totalQuestions = data.total;
            userAnswers = new Array(totalQuestions);
            currentQuestion = 1;
            
            // Restaurar estrutura HTML original
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
            
            // Reconfigurar event listeners para as opções
            setupQuizOptions();
            
            updateQuestionProgress();
            loadCurrentQuestion();
            
            // Log informativo
            console.log(`Questões ${data.source === 'gemini' ? 'geradas pela IA Gemini' : 'carregadas do cache'}`);
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ff6b6b; margin-bottom: 20px;"></i>
                    <p>Erro ao gerar questões</p>
                    <button onclick="loadQuestions()" class="btn btn-primary" style="margin-top: 20px;">Tentar Novamente</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        const container = document.querySelector('.question-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-wifi" style="font-size: 2rem; color: #ff6b6b; margin-bottom: 20px;"></i>
                <p>Erro de conexão</p>
                <button onclick="loadQuestions()" class="btn btn-primary" style="margin-top: 20px;">Tentar Novamente</button>
            </div>
        `;
    }
}

// Configurar event listeners das opções
function setupQuizOptions() {
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            // Remover seleção anterior
            options.forEach(opt => opt.classList.remove('selected'));
            
            // Selecionar nova opção
            option.classList.add('selected');
            
            // Salvar resposta
            const selectedIndex = Array.from(option.parentNode.children).indexOf(option);
            userAnswers[currentQuestion - 1] = selectedIndex;
        });
    });
}

// Carregar questão atual
function loadCurrentQuestion() {
    if (currentQuestions.length === 0) return;
    
    const question = currentQuestions[currentQuestion - 1];
    
    document.getElementById('question-text').textContent = question.question;
    
    const optionElements = document.querySelectorAll('.option');
    optionElements.forEach((option, index) => {
        if (question.options[index]) {
            option.querySelector('.option-text').textContent = question.options[index];
            option.style.display = 'flex';
            option.classList.remove('selected', 'correct', 'incorrect');
        } else {
            option.style.display = 'none';
        }
    });
    
    // Restaurar seleção anterior se houver
    if (userAnswers[currentQuestion - 1] !== undefined) {
        optionElements[userAnswers[currentQuestion - 1]].classList.add('selected');
    }
}

// Finalizar questionário com processamento no backend
async function finishQuiz() {
    clearInterval(timerInterval);
    
    try {
        showSection('results');
        
        // Mostrar loading nos resultados
        const resultsContent = document.querySelector('.results-content');
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 20px;"></i>
                <p>Analisando suas respostas com IA...</p>
                <p style="font-size: 0.9rem; color: #666;">Gerando recomendações personalizadas</p>
            </div>
        `;
        
        resultsContent.style.display = 'none';
        resultsContent.parentNode.appendChild(loadingDiv);
        
        // Enviar respostas para o backend processar
        const response = await authenticatedFetch(`${API_BASE_URL}/submit-quiz`, {
            method: 'POST',
            body: JSON.stringify({
                subject: currentSubject,
                answers: userAnswers.filter(answer => answer !== undefined),
                questionsData: currentQuestions // O backend vai simular as respostas corretas
            })
        });
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            // Remover loading
            loadingDiv.remove();
            resultsContent.style.display = 'block';
            
            // Atualizar elementos de resultado
            document.getElementById('score-percent').textContent = `${data.accuracy}%`;
            document.getElementById('correct-answers').textContent = data.correctAnswers;
            document.getElementById('incorrect-answers').textContent = 
                data.totalQuestions - data.correctAnswers;
            
            // Calcular tempo gasto
            const timeSpent = 900 - timeLeft;
            const minutesSpent = Math.floor(timeSpent / 60);
            const secondsSpent = timeSpent % 60;
            document.getElementById('time-spent').textContent = 
                `${minutesSpent.toString().padStart(2, '0')}:${secondsSpent.toString().padStart(2, '0')}`;
            
            // Atualizar recomendações (vindas do Gemini)
            const recommendationsList = document.querySelector('.recommendations-list');
            recommendationsList.innerHTML = '';
            data.recommendations.forEach(rec => {
                const div = document.createElement('div');
                div.className = 'recommendation';
                div.innerHTML = `<i class="fas fa-lightbulb"></i><p>${rec}</p>`;
                recommendationsList.appendChild(div);
            });
            
            // Atualizar círculo de progresso
            updateProgressCircle(data.accuracy);
        } else {
            loadingDiv.remove();
            resultsContent.style.display = 'block';
            alert(data.message || 'Erro ao processar resultado');
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('Erro de conexão. Tente novamente.');
    }
}

// Carregar ranking
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

// Atualizar display do ranking
function updateRankingDisplay(ranking) {
    const rankingList = document.querySelector('.ranking-list');
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

// Atualizar círculo de progresso
function updateProgressCircle(percentage) {
    const circle = document.querySelector('.progress-ring-circle.fill');
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
    }
}

// Iniciar timer
function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 900;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            finishQuiz();
        }
    }, 1000);
}

// Atualizar progresso da questão
function updateQuestionProgress() {
    document.getElementById('current-question').textContent = currentQuestion;
    document.getElementById('total-questions').textContent = totalQuestions;
    const progressPercent = (currentQuestion / totalQuestions) * 100;
    progressFill.style.width = `${progressPercent}%`;
}

// Configurar botões de ação
function setupActionButtons() {
    startJourneyBtn.addEventListener('click', () => {
        showSection('subjects');
    });
    
    backToSubjectsBtn.addEventListener('click', () => {
        resetQuiz();
        showSection('subjects');
    });
    
    tryAgainBtn.addEventListener('click', () => {
        resetQuiz();
        loadQuestions();
    });
}

// Reiniciar questionário
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

// Capitalizar primeira letra
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}