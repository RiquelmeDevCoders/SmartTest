require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smarttest-secret-key';

// Configurar CORS para aceitar requests do Netlify
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smarttestai.netlify.app';

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Inicializar Gemini
let genAI, model;
try {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  GEMINI_API_KEY não encontrada. O modo de demonstração será usado.');
    } else {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-pro" });
        console.log('✅ Gemini AI inicializado com sucesso');
    }
} catch (error) {
    console.error('❌ Erro ao inicializar Gemini:', error);
}

// Simulação de banco de dados em memória
let users = [];
let rankings = [
    { id: 1, name: 'Carlos Silva', points: 2450, avatar: 'C' },
    { id: 2, name: 'Ana Oliveira', points: 2320, avatar: 'A' },
    { id: 3, name: 'Maria Santos', points: 2150, avatar: 'M' },
    { id: 4, name: 'Pedro Costa', points: 1980, avatar: 'P' }
];

// Cache para questões geradas (evitar muitas chamadas à API)
let questionsCache = {};

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token de acesso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// Mapa de disciplinas em português para inglês
const subjectMap = {
    'matematica': 'mathematics',
    'portugues': 'portuguese language',
    'historia': 'history',
    'geografia': 'geography',
    'biologia': 'biology',
    'quimica': 'chemistry',
    'fisica': 'physics',
    'ingles': 'english language'
};

// Função para gerar questões com Gemini
async function generateQuestionsWithGemini(subject, difficulty, count) {
    try {
        if (!model) {
            throw new Error('Gemini API não configurada');
        }

        const subjectInEnglish = subjectMap[subject.toLowerCase()] || subject;
        const difficultyText = {
            'easy': 'básico/fácil',
            'medium': 'intermediário/médio',
            'hard': 'avançado/difícil'
        }[difficulty] || 'intermediário/médio';

        const prompt = `Gere ${count} questões de múltipla escolha sobre ${subject} em português brasileiro.
        
Nível de dificuldade: ${difficultyText}

Formato EXATO para cada questão:
QUESTAO 1:
Pergunta: [sua pergunta aqui]
A) [alternativa A]
B) [alternativa B]
C) [alternativa C]
D) [alternativa D]
CORRETA: [A, B, C ou D]

QUESTAO 2:
Pergunta: [sua pergunta aqui]
A) [alternativa A]
B) [alternativa B]
C) [alternativa C]
D) [alternativa D]
CORRETA: [A, B, C ou D]

Requisitos:
- Questões adequadas ao nível educacional brasileiro
- Linguagem clara e objetiva
- Apenas uma alternativa correta por questão
- Siga EXATAMENTE o formato mostrado
- Use o padrão QUESTAO [número]:

Disciplina: ${subject}
Número de questões: ${count}`;

        console.log('📝 Gerando questões com Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Resposta do Gemini recebida');
        return parseGeminiResponse(text);
    } catch (error) {
        console.error('❌ Erro ao gerar questões com Gemini:', error);
        throw new Error(`Falha ao gerar questões: ${error.message}`);
    }
}

// Função para parsear a resposta do Gemini
function parseGeminiResponse(text) {
    const questions = [];
    const questionBlocks = text.split(/QUESTAO\s+\d+:/);
    
    for (let i = 1; i < questionBlocks.length; i++) {
        try {
            const block = questionBlocks[i].trim();
            
            // Extrair pergunta
            const questionMatch = block.match(/Pergunta:\s*(.+?)(?=\n[A-D]\))/s);
            if (!questionMatch) continue;
            
            const question = questionMatch[1].trim();
            
            // Extrair alternativas
            const options = [];
            const optionRegex = /([A-D])\)\s*(.+?)(?=\n[A-D]\)|\nCORRETA:|$)/gs;
            let match;
            
            while ((match = optionRegex.exec(block)) !== null) {
                options.push(match[2].trim());
            }
            
            // Extrair resposta correta
            const correctMatch = block.match(/CORRETA:\s*([A-D])/);
            if (!correctMatch || options.length !== 4) continue;
            
            const correctLetter = correctMatch[1];
            const correctIndex = correctLetter.charCodeAt(0) - 'A'.charCodeAt(0);
            
            questions.push({
                question: question,
                options: options,
                correctAnswer: correctIndex,
                difficulty: 'medium'
            });
        } catch (error) {
            console.error('❌ Erro ao parsear questão:', error);
            continue;
        }
    }
    
    if (questions.length === 0) {
        throw new Error('Nenhuma questão válida encontrada na resposta do Gemini');
    }
    
    return questions;
}

// Questões de fallback para quando o Gemini falhar
const fallbackQuestions = {
    matematica: [
        {
            question: "Qual é a derivada de f(x) = x² + 3x + 2?",
            options: [
                "2x + 3",
                "x² + 3",
                "2x + 2",
                "x + 3"
            ],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual é o resultado de ∫(2x dx) de 0 a 3?",
            options: [
                "9",
                "6",
                "12",
                "18"
            ],
            correctAnswer: 0,
            difficulty: "medium"
        }
    ],
    portugues: [
        {
            question: "Qual é a classificação morfológica da palavra 'correndo'?",
            options: [
                "Verbo",
                "Adjetivo",
                "Advérbio",
                "Substantivo"
            ],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual figura de linguagem está presente em 'O tempo é um rio que flui'?",
            options: [
                "Metáfora",
                "Comparação",
                "Hipérbole",
                "Personificação"
            ],
            correctAnswer: 0,
            difficulty: "medium"
        }
    ]
};

// Rotas de autenticação
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validação básica
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
        }

        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
            return res.status(400).json({ message: 'E-mail já cadastrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: users.length + 1,
            name,
            email,
            password: hashedPassword,
            points: 0,
            createdAt: new Date()
        };

        users.push(newUser);

        const token = jwt.sign(
            { id: newUser.id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                points: newUser.points
            }
        });
    } catch (error) {
        console.error('❌ Erro no registro:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validação básica
        if (!email || !password) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios' });
        }

        const user = users.find(user => user.email === email);
        if (!user) {
            return res.status(400).json({ message: 'E-mail ou senha incorretos' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'E-mail ou senha incorretos' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                points: user.points
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

// Rota para gerar questões
app.post('/api/generate-questions', authenticateToken, async (req, res) => {
    try {
        const { subject, difficulty = 'medium', count = 5 } = req.body;
        
        // Verificar se a disciplina é válida
        if (!subjectMap[subject.toLowerCase()]) {
            return res.status(400).json({ message: 'Disciplina não encontrada' });
        }

        console.log(`📚 Gerando ${count} questões de ${subject} (dificuldade: ${difficulty})`);

        let questions = [];

        // Tentar usar o Gemini se estiver disponível
        if (model) {
            try {
                questions = await generateQuestionsWithGemini(subject, difficulty, count);
                console.log(`✅ ${questions.length} questões geradas pelo Gemini`);
            } catch (geminiError) {
                console.warn('⚠️  Gemini falhou, usando questões de fallback:', geminiError.message);
            }
        }

        // Se o Gemini falhou ou não está disponível, usar questões de fallback
        if (questions.length === 0) {
            questions = fallbackQuestions[subject] || fallbackQuestions.matematica;
            console.log(`📋 Usando ${questions.length} questões de fallback`);
        }

        // Limitar ao número solicitado
        const selectedQuestions = questions.slice(0, count);
        
        const questionsForClient = selectedQuestions.map((q, index) => ({
            id: index + 1,
            question: q.question,
            options: q.options,
            difficulty: q.difficulty
        }));

        res.json({
            questions: questionsForClient,
            total: questionsForClient.length,
            subject: subject,
            source: model ? 'gemini' : 'fallback'
        });

    } catch (error) {
        console.error('❌ Erro ao gerar questões:', error);
        res.status(500).json({ 
            message: 'Erro ao gerar questões. Tente novamente.',
            error: error.message
        });
    }
});

// Rota para verificar respostas
app.post('/api/submit-quiz', authenticateToken, async (req, res) => {
    try {
        const { subject, answers, questionsData } = req.body;
        const userId = req.user.id;

        if (!questionsData || questionsData.length === 0) {
            return res.status(400).json({ message: 'Dados das questões não fornecidos' });
        }

        let correctCount = 0;
        let totalPoints = 0;
        const results = [];

        // Verificar cada resposta
        answers.forEach((answer, index) => {
            if (index < questionsData.length) {
                const questionData = questionsData[index];
                const isCorrect = answer === questionData.correctAnswer;
                
                if (isCorrect) {
                    correctCount++;
                    const points = questionData.difficulty === 'easy' ? 50 : 
                                 questionData.difficulty === 'medium' ? 100 : 150;
                    totalPoints += points;
                }

                results.push({
                    questionId: index + 1,
                    userAnswer: answer,
                    correctAnswer: questionData.correctAnswer,
                    isCorrect: isCorrect,
                    question: questionData.question
                });
            }
        });

        // Atualizar pontuação do usuário
        const userIndex = users.findIndex(user => user.id === userId);
        if (userIndex !== -1) {
            users[userIndex].points += totalPoints;
        }

        const accuracy = Math.round((correctCount / answers.length) * 100);

        res.json({
            correctAnswers: correctCount,
            totalQuestions: answers.length,
            accuracy: accuracy,
            points: totalPoints,
            results: results,
            recommendations: [
                "Continue praticando regularmente",
                "Revise os tópicos com maior dificuldade",
                "Faça exercícios complementares"
            ]
        });
    } catch (error) {
        console.error('❌ Erro ao processar respostas:', error);
        res.status(500).json({ message: 'Erro ao processar respostas' });
    }
});

// Rotas restantes
app.get('/api/ranking', (req, res) => {
    try {
        const allUsers = [...rankings, ...users.map(user => ({
            id: user.id,
            name: user.name,
            points: user.points,
            avatar: user.name.charAt(0).toUpperCase()
        }))];

        const sortedRanking = allUsers.sort((a, b) => b.points - a.points);
        
        const rankingWithPosition = sortedRanking.map((user, index) => ({
            ...user,
            position: index + 1
        }));

        res.json({
            ranking: rankingWithPosition.slice(0, 20),
            period: 'global'
        });
    } catch (error) {
        console.error('❌ Erro ao obter ranking:', error);
        res.status(500).json({ message: 'Erro ao obter ranking' });
    }
});

app.get('/api/profile', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const user = users.find(user => user.id === userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            points: user.points,
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error('❌ Erro ao obter perfil:', error);
        res.status(500).json({ message: 'Erro ao obter perfil' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        gemini: !!model
    });
});

// Rota padrão
app.get('/', (req, res) => {
    res.json({ 
        message: 'SmartTest API',
        version: '1.0.0',
        endpoints: {
            login: '/api/login',
            register: '/api/register',
            questions: '/api/generate-questions',
            ranking: '/api/ranking'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err.stack);
    res.status(500).json({ message: 'Erro interno do servidor' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Endpoint não encontrado' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: ${FRONTEND_URL}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Gemini: ${model ? '✅ Configurado' : '❌ Não configurado'}`);
});