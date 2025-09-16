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

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
        const subjectInEnglish = subjectMap[subject.toLowerCase()] || subject;
        const difficultyText = {
            'easy': 'básico/fácil',
            'medium': 'intermediário/médio',
            'hard': 'avançado/difícil'
        };

        const prompt = `Gere ${count} questões de múltipla escolha sobre ${subject} em português brasileiro.
        
Nível de dificuldade: ${difficultyText[difficulty] || 'médio'}

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return parseGeminiResponse(text);
    } catch (error) {
        console.error('Erro ao gerar questões com Gemini:', error);
        throw error;
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
            const optionsRegex = /([A-D])\)\s*(.+?)(?=\n[A-D]\)|\nCORRETA:|$)/gs;
            const options = [];
            let match;
            
            while ((match = optionsRegex.exec(block)) !== null) {
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
            console.error('Erro ao parsear questão:', error);
            continue;
        }
    }
    
    return questions;
}

// Rotas de autenticação (sem alterações)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

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
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

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
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

// Rota MODIFICADA para gerar questões com Gemini
app.post('/api/generate-questions', authenticateToken, async (req, res) => {
    try {
        const { subject, difficulty = 'medium', count = 5 } = req.body;
        
        // Verificar se a disciplina é válida
        if (!subjectMap[subject.toLowerCase()]) {
            return res.status(400).json({ message: 'Disciplina não encontrada' });
        }

        // Chave para cache
        const cacheKey = `${subject}_${difficulty}_${count}`;
        
        // Verificar cache (válido por 1 hora)
        if (questionsCache[cacheKey] && questionsCache[cacheKey].timestamp > Date.now() - 3600000) {
            const cachedQuestions = questionsCache[cacheKey].questions;
            
            // Embaralhar questões do cache
            const shuffled = [...cachedQuestions].sort(() => Math.random() - 0.5);
            const selectedQuestions = shuffled.slice(0, count);
            
            const questionsForClient = selectedQuestions.map((q, index) => ({
                id: index + 1,
                question: q.question,
                options: q.options,
                difficulty: q.difficulty
            }));

            return res.json({
                questions: questionsForClient,
                total: questionsForClient.length,
                subject: subject,
                source: 'cache'
            });
        }

        // Gerar novas questões com Gemini
        const generatedQuestions = await generateQuestionsWithGemini(subject, difficulty, Math.min(count, 10));
        
        if (generatedQuestions.length === 0) {
            return res.status(500).json({ message: 'Erro ao gerar questões. Tente novamente.' });
        }

        // Salvar no cache
        questionsCache[cacheKey] = {
            questions: generatedQuestions,
            timestamp: Date.now()
        };

        // Selecionar questões solicitadas
        const selectedQuestions = generatedQuestions.slice(0, count);
        
        const questionsForClient = selectedQuestions.map((q, index) => ({
            id: index + 1,
            question: q.question,
            options: q.options,
            difficulty: q.difficulty
        }));

        // Salvar questões para correção posterior
        req.generatedQuestions = selectedQuestions;

        res.json({
            questions: questionsForClient,
            total: questionsForClient.length,
            subject: subject,
            source: 'gemini'
        });

    } catch (error) {
        console.error('Erro ao gerar questões:', error);
        res.status(500).json({ message: 'Erro ao gerar questões. Tente novamente.' });
    }
});

// Rota MODIFICADA para verificar respostas
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
            recommendations: await generateRecommendationsWithGemini(subject, accuracy)
        });
    } catch (error) {
        console.error('Erro ao processar respostas:', error);
        res.status(500).json({ message: 'Erro ao processar respostas' });
    }
});

// Função para gerar recomendações com Gemini
async function generateRecommendationsWithGemini(subject, accuracy) {
    try {
        const performanceLevel = accuracy < 50 ? 'baixo' : accuracy < 80 ? 'médio' : 'alto';
        
        const prompt = `Com base no desempenho ${performanceLevel} (${accuracy}% de acertos) em ${subject}, gere 3 recomendações específicas de estudo.

Formato:
- [recomendação 1]
- [recomendação 2]  
- [recomendação 3]

Requisitos:
- Recomendações práticas e específicas
- Adequadas ao nível de desempenho
- Linguagem motivacional e construtiva
- Foco em melhorar os pontos fracos`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Extrair recomendações
        const recommendations = text.split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace('-', '').trim())
            .slice(0, 3);
            
        return recommendations.length > 0 ? recommendations : getDefaultRecommendations(subject, accuracy);
    } catch (error) {
        console.error('Erro ao gerar recomendações:', error);
        return getDefaultRecommendations(subject, accuracy);
    }
}

// Função de fallback para recomendações
function getDefaultRecommendations(subject, accuracy) {
    const recommendations = {
        matematica: {
            low: ["Revise conceitos básicos de álgebra", "Pratique operações fundamentais", "Estude geometria plana"],
            medium: ["Revise derivadas de funções polinomiais", "Pratique mais exercícios de cálculo diferencial", "Estude as regras de derivação"],
            high: ["Explore tópicos avançados de cálculo", "Pratique problemas de aplicação", "Estude integrais definidas"]
        },
        portugues: {
            low: ["Revise regras básicas de gramática", "Pratique concordância verbal e nominal", "Estude classes de palavras"],
            medium: ["Pratique análise sintática", "Estude figuras de linguagem", "Revise regência verbal e nominal"],
            high: ["Aprofunde-se em literatura brasileira", "Pratique redação e dissertação", "Estude estilística e semântica"]
        }
    };

    const level = accuracy < 50 ? 'low' : accuracy < 80 ? 'medium' : 'high';
    return recommendations[subject]?.[level] || [
        "Continue praticando regularmente",
        "Revise os tópicos com maior dificuldade",
        "Busque exercícios complementares"
    ];
}

// Rotas restantes (sem alterações)
app.get('/api/ranking', (req, res) => {
    try {
        const { period = 'global' } = req.query;
        
        const allUsers = [...rankings];
        users.forEach(user => {
            allUsers.push({
                id: user.id,
                name: user.name,
                points: user.points,
                avatar: user.name.charAt(0).toUpperCase()
            });
        });

        const sortedRanking = allUsers.sort((a, b) => b.points - a.points);
        
        const rankingWithPosition = sortedRanking.map((user, index) => ({
            ...user,
            position: index + 1
        }));

        res.json({
            ranking: rankingWithPosition.slice(0, 20),
            period: period
        });
    } catch (error) {
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
        res.status(500).json({ message: 'Erro ao obter perfil' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});