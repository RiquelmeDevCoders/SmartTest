require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smarttest-secret-key';

const allowedOrigins = [
    'https://smarttestai.netlify.app',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'CORS policy violation';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let genAI, model;
try {
    if (process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-pro" });
        console.log('✅ Gemini AI inicializado');
    } else {
        console.warn('⚠️ GEMINI_API_KEY não encontrada');
    }
} catch (error) {
    console.error('❌ Erro Gemini:', error.message);
}

let users = [];
let rankings = [
    { id: 1, name: 'Carlos', points: 2450, avatar: 'C' },
    { id: 2, name: 'Ana Oliveira', points: 2320, avatar: 'A' },
    { id: 3, name: 'Jean Ferreira', points: 2150, avatar: 'M' },
    { id: 4, name: 'Mateus Marques', points: 1980, avatar: 'P' },
    { id: 5, name: 'Breno', points: 1850, avatar: 'J' },
    { id: 6, name: 'Roberto Lima', points: 1720, avatar: 'R' }
];

const questionsDatabase = {
    matematica: [
        {
            question: "Qual é a derivada de f(x) = x² + 3x + 2?",
            options: ["2x + 3", "x² + 3", "2x + 2", "x + 3"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Se log₂(x) = 3, qual é o valor de x?",
            options: ["6", "8", "9", "12"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é o resultado de ∫(2x + 1)dx?",
            options: ["x² + x + C", "2x² + x + C", "x² + 2x + C", "2x + C"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Em um triângulo retângulo, se os catetos medem 3 e 4, qual é a hipotenusa?",
            options: ["5", "6", "7", "8"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual é o valor de sen(30°)?",
            options: ["1/2", "√2/2", "√3/2", "1"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Se uma função f(x) = 2x + 1, qual é f(5)?",
            options: ["10", "11", "12", "13"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual é a solução da equação 2x - 6 = 0?",
            options: ["x = 2", "x = 3", "x = 4", "x = 6"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Em uma progressão aritmética, se a₁ = 2 e r = 3, qual é o 5º termo?",
            options: ["14", "15", "16", "17"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual é a solução da equação x² - 9 = 0?",
            options: ["x = 3", "x = -3", "x = ±3", "x = 0"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Se a matriz A é 2x2 com determinante igual a 0, então A é:",
            options: ["Invertível", "Singular", "Diagonalizável", "Ortogonal"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é a derivada de cos(x)?",
            options: ["sen(x)", "-sen(x)", "cos(x)", "-cos(x)"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "O limite de (1 + 1/n)^n quando n → ∞ é:",
            options: ["0", "1", "e", "∞"],
            correctAnswer: 2,
            difficulty: "hard"
        }
    ],
    portugues: [
        {
            question: "Qual é a classificação morfológica da palavra 'correndo'?",
            options: ["Verbo", "Gerúndio", "Advérbio", "Substantivo"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual figura de linguagem está presente em 'O vento sussurrava segredos'?",
            options: ["Metáfora", "Personificação", "Hipérbole", "Comparação"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Complete: 'Eu _____ que você viesse.'",
            options: ["queria", "quero", "quisera", "quis"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual é a função sintática de 'aos amigos' em 'Dei presentes aos amigos'?",
            options: ["Sujeito", "Objeto direto", "Objeto indireto", "Predicativo"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Qual palavra está corretamente acentuada?",
            options: ["Saúde", "Saude", "Saúdê", "Saudê"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Em 'Machado de Assis', qual escola literária o autor representa?",
            options: ["Romantismo", "Realismo", "Naturalismo", "Modernismo"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é o plural de 'cidadão'?",
            options: ["cidadãos", "cidadões", "cidadãoes", "cidadans"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual conjunção indica oposição?",
            options: ["e", "mas", "ou", "logo"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual é o antônimo de 'feliz'?",
            options: ["alegre", "contente", "triste", "satisfeito"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Na frase 'A casa é grande', a palavra 'grande' é:",
            options: ["Sujeito", "Predicativo", "Objeto direto", "Adjunto adnominal"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é o tipo de discurso em 'Ele disse que viria amanhã'?",
            options: ["Direto", "Indireto", "Indireto livre", "Narrativo"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual oração apresenta voz passiva?",
            options: ["O menino chutou a bola.", "A bola foi chutada pelo menino.", "Ele chutava bolas.", "Chutaram a bola."],
            correctAnswer: 1,
            difficulty: "medium"
        }
    ],
    historia: [
        {
            question: "Em que ano o Brasil foi descoberto?",
            options: ["1498", "1500", "1501", "1502"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Quem foi o primeiro presidente do Brasil?",
            options: ["Getúlio Vargas", "Juscelino Kubitschek", "Deodoro da Fonseca", "Floriano Peixoto"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "A Revolução Industrial teve início em qual país?",
            options: ["França", "Alemanha", "Inglaterra", "Estados Unidos"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Em que século ocorreu a Idade Média?",
            options: ["V-XV", "IV-XIV", "VI-XVI", "III-XIII"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual império foi governado por Napoleão Bonaparte?",
            options: ["Império Romano", "Império Francês", "Império Britânico", "Império Alemão"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "A Segunda Guerra Mundial terminou em que ano?",
            options: ["1944", "1945", "1946", "1947"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual foi a capital do Império Romano do Oriente?",
            options: ["Roma", "Atenas", "Constantinopla", "Alexandria"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "A Proclamação da República no Brasil aconteceu em:",
            options: ["15 de novembro de 1889", "7 de setembro de 1822", "13 de maio de 1888", "15 de novembro de 1891"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Quem foi o líder da Revolução Russa de 1917?",
            options: ["Lênin", "Stálin", "Trotsky", "Czar Nicolau II"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual civilização construiu as pirâmides de Gizé?",
            options: ["Mesopotâmica", "Egípcia", "Romana", "Maya"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual tratado encerrou a Primeira Guerra Mundial?",
            options: ["Tratado de Tordesilhas", "Tratado de Versalhes", "Tratado de Viena", "Tratado de Paris"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Em que ano ocorreu a Independência do Brasil?",
            options: ["1808", "1822", "1831", "1889"],
            correctAnswer: 1,
            difficulty: "easy"
        }
    ],
    geografia: [
        {
            question: "Qual é o maior país do mundo em extensão territorial?",
            options: ["China", "Canadá", "Rússia", "Estados Unidos"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Qual é a capital da Austrália?",
            options: ["Sydney", "Melbourne", "Canberra", "Perth"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Em qual continente está localizado o Egito?",
            options: ["Ásia", "África", "Europa", "América"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual é o rio mais extenso do mundo?",
            options: ["Rio Amazonas", "Rio Nilo", "Rio Mississippi", "Rio Yangtzé"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Quantos fusos horários existem no mundo?",
            options: ["12", "24", "36", "48"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é o menor país do mundo?",
            options: ["Mônaco", "Vaticano", "San Marino", "Liechtenstein"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "A Cordilheira dos Andes está localizada em qual continente?",
            options: ["América do Norte", "América do Sul", "Ásia", "Europa"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual é a montanha mais alta do mundo?",
            options: ["K2", "Monte Everest", "Monte McKinley", "Monte Aconcágua"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual é a capital do Canadá?",
            options: ["Toronto", "Ottawa", "Vancouver", "Montreal"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual bioma brasileiro é conhecido pela grande biodiversidade e pela floresta densa?",
            options: ["Cerrado", "Pantanal", "Amazônia", "Caatinga"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Qual deserto é o maior do mundo?",
            options: ["Saara", "Gobi", "Kalahari", "Atacama"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual oceano banha a costa leste do Brasil?",
            options: ["Pacífico", "Atlântico", "Índico", "Ártico"],
            correctAnswer: 1,
            difficulty: "easy"
        }
    ],
    biologia: [
        {
            question: "Qual é a unidade básica da vida?",
            options: ["Átomo", "Molécula", "Célula", "Tecido"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Quantos cromossomos possui uma célula humana normal?",
            options: ["23", "46", "48", "52"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual organela é responsável pela fotossíntese?",
            options: ["Mitocôndria", "Núcleo", "Cloroplasto", "Ribossomo"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "O que é DNA?",
            options: ["Ácido desoxirribonucleico", "Ácido ribonucleico", "Proteína", "Carboidrato"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual reino inclui os fungos?",
            options: ["Plantae", "Animalia", "Fungi", "Protista"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Qual é o processo de respiração celular?",
            options: ["Fotossíntese", "Glicólise", "Respiração aeróbica", "Fermentação"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Quantas câmaras tem o coração humano?",
            options: ["2", "3", "4", "5"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Qual é a função dos glóbulos vermelhos?",
            options: ["Defesa", "Coagulação", "Transporte de oxigênio", "Digestão"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Qual é a molécula que carrega energia nas células?",
            options: ["ADP", "ATP", "GTP", "NADH"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual grupo de animais é caracterizado por serem vertebrados e possuírem penas?",
            options: ["Peixes", "Anfíbios", "Répteis", "Aves"],
            correctAnswer: 3,
            difficulty: "easy"
        },
        {
            question: "Onde ocorre a troca gasosa nos pulmões?",
            options: ["Traqueia", "Bronquíolos", "Alvéolos", "Diafragma"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Qual estrutura celular contém o material genético?",
            options: ["Cloroplasto", "Mitocôndria", "Núcleo", "Lisossomo"],
            correctAnswer: 2,
            difficulty: "easy"
        }
    ],
    quimica: [
        {
            question: "Qual é o símbolo químico do ouro?",
            options: ["Au", "Ag", "Al", "Ar"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Quantos prótons tem o átomo de carbono?",
            options: ["4", "6", "8", "12"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é a fórmula da água?",
            options: ["H2O", "CO2", "NH3", "CH4"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual gás é mais abundante na atmosfera terrestre?",
            options: ["Oxigênio", "Nitrogênio", "Argônio", "Dióxido de carbono"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é o pH de uma solução neutra?",
            options: ["0", "7", "14", "1"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual elemento tem número atômico 1?",
            options: ["Hélio", "Hidrogênio", "Lítio", "Carbono"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Que tipo de ligação existe na molécula de NaCl?",
            options: ["Covalente", "Iônica", "Metálica", "Van der Waals"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual é a unidade de medida da quantidade de matéria?",
            options: ["Mol", "Grama", "Litro", "Joule"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual elemento químico é representado pelo símbolo 'Fe'?",
            options: ["Ferro", "Fósforo", "Flúor", "Francium"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual é a fórmula química do ácido sulfúrico?",
            options: ["HCl", "H2SO4", "HNO3", "H2CO3"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "Qual estado físico da matéria possui forma e volume fixos?",
            options: ["Sólido", "Líquido", "Gasoso", "Plasma"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual processo separa misturas por diferença de ponto de ebulição?",
            options: ["Filtração", "Destilação", "Decantação", "Centrifugação"],
            correctAnswer: 1,
            difficulty: "medium"
        }
    ],
    fisica: [
        {
            question: "Qual é a velocidade da luz no vácuo?",
            options: ["300.000 km/s", "150.000 km/s", "450.000 km/s", "600.000 km/s"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "Qual é a unidade de força no SI?",
            options: ["Joule", "Newton", "Watt", "Pascal"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual lei da física afirma que 'toda ação tem uma reação'?",
            options: ["Primeira Lei de Newton", "Segunda Lei de Newton", "Terceira Lei de Newton", "Lei da Gravitação"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Qual é a aceleração da gravidade na Terra?",
            options: ["9,8 m/s²", "10 m/s²", "8,9 m/s²", "11 m/s²"],
            correctAnswer: 0,
            difficulty: "easy"
        },
        {
            question: "Qual grandeza física mede a resistência de um corpo ao movimento?",
            options: ["Força", "Massa", "Peso", "Inércia"],
            correctAnswer: 3,
            difficulty: "medium"
        },
        {
            question: "Qual é a fórmula da energia cinética?",
            options: ["E = mc²", "Ec = mv²/2", "E = mgh", "P = mv"],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "O que é um próton?",
            options: ["Partícula negativa", "Partícula positiva", "Partícula neutra", "Onda eletromagnética"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual é a unidade de potência no SI?",
            options: ["Joule", "Newton", "Watt", "Pascal"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Qual é a fórmula da força segundo Newton?",
            options: ["F = m/v", "F = m·a", "F = p·v", "F = E/t"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual partícula é responsável pela corrente elétrica em metais?",
            options: ["Prótons", "Nêutrons", "Elétrons", "Íons"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "A energia potencial gravitacional é dada por:",
            options: ["E = mv²/2", "E = mgh", "E = mc²", "E = q·V"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Qual fenômeno explica a separação da luz branca em um prisma?",
            options: ["Reflexão", "Refração", "Difração", "Interferência"],
            correctAnswer: 1,
            difficulty: "medium"
        }
    ],
    ingles: [
        {
            question: "What is the past tense of 'go'?",
            options: ["goed", "went", "gone", "going"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Which article is used before vowel sounds?",
            options: ["a", "an", "the", "no article"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "What does 'although' mean?",
            options: ["because", "however", "therefore", "even though"],
            correctAnswer: 3,
            difficulty: "medium"
        },
        {
            question: "Which is the correct plural of 'child'?",
            options: ["childs", "children", "childrens", "child"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "What is the superlative form of 'good'?",
            options: ["gooder", "goodest", "better", "best"],
            correctAnswer: 3,
            difficulty: "medium"
        },
        {
            question: "Which preposition is correct: 'I'm interested ___ music'?",
            options: ["in", "on", "at", "for"],
            correctAnswer: 0,
            difficulty: "medium"
        },
        {
            question: "What does 'frequently' mean?",
            options: ["rarely", "sometimes", "often", "never"],
            correctAnswer: 2,
            difficulty: "easy"
        },
        {
            question: "Which is the correct form: 'If I ___ rich, I would travel'?",
            options: ["am", "was", "were", "be"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "What is the opposite of 'hot'?",
            options: ["warm", "cold", "cool", "chill"],
            correctAnswer: 1,
            difficulty: "easy"
        },
        {
            question: "Which sentence is in present perfect?",
            options: ["I went to school.", "I have gone to school.", "I go to school.", "I was going to school."],
            correctAnswer: 1,
            difficulty: "medium"
        },
        {
            question: "What does 'quickly' describe in the sentence 'He runs quickly'?",
            options: ["Subject", "Verb", "Adverb", "Adjective"],
            correctAnswer: 2,
            difficulty: "medium"
        },
        {
            question: "Choose the correct option: 'There ___ many books on the table.'",
            options: ["is", "are", "am", "be"],
            correctAnswer: 1,
            difficulty: "easy"
        }
    ]
};


const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

async function generateQuestionsWithGemini(subject, difficulty, count) {
    if (!model) {
        throw new Error('Gemini não disponível');
    }

    const difficultyMap = {
        'easy': 'básico',
        'medium': 'intermediário',
        'hard': 'avançado'
    };

    const prompt = `Gere ${count} questões de múltipla escolha sobre ${subject} em português brasileiro.
Nível: ${difficultyMap[difficulty] || 'intermediário'}

FORMATO OBRIGATÓRIO:
QUESTAO 1:
Pergunta: [pergunta aqui]
A) [alternativa A]
B) [alternativa B] 
C) [alternativa C]
D) [alternativa D]
CORRETA: [A, B, C ou D]

Requisitos:
- Questões apropriadas ao ensino médio brasileiro
- Linguagem clara e precisa
- Apenas uma resposta correta
- Use EXATAMENTE o formato mostrado`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return parseGeminiResponse(text);
    } catch (error) {
        throw new Error(`Erro Gemini: ${error.message}`);
    }
}

function parseGeminiResponse(text) {
    const questions = [];
    const blocks = text.split(/QUESTAO\s+\d+:/);
    
    for (let i = 1; i < blocks.length; i++) {
        try {
            const block = blocks[i].trim();
            
            const questionMatch = block.match(/Pergunta:\s*(.+?)(?=\n[A-D]\))/s);
            if (!questionMatch) continue;
            
            const question = questionMatch[1].trim();
            
            const options = [];
            const optionMatches = [...block.matchAll(/([A-D])\)\s*(.+?)(?=\n[A-D]\)|\nCORRETA:|$)/gs)];
            
            for (const match of optionMatches) {
                options.push(match[2].trim());
            }
            
            const correctMatch = block.match(/CORRETA:\s*([A-D])/);
            if (!correctMatch || options.length !== 4) continue;
            
            const correctIndex = correctMatch[1].charCodeAt(0) - 65;
            
            questions.push({
                question: question,
                options: options,
                correctAnswer: correctIndex,
                difficulty: 'medium'
            });
        } catch (error) {
            continue;
        }
    }
    
    return questions;
}

function getRandomQuestions(subject, count = 5) {
    const subjectQuestions = questionsDatabase[subject];
    if (!subjectQuestions || subjectQuestions.length === 0) {
        return questionsDatabase.matematica.slice(0, count);
    }
    
    const shuffled = [...subjectQuestions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Campos obrigatórios não preenchidos' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const existingUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = {
            id: Date.now(),
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            points: 0,
            createdAt: new Date().toISOString()
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
        console.error('Erro no registro:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email e senha são obrigatórios' });
        }

        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        if (!user) {
            return res.status(400).json({ message: 'Email ou senha incorretos' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Email ou senha incorretos' });
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
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.post('/api/generate-questions', authenticateToken, async (req, res) => {
    try {
        const { subject, difficulty = 'medium', count = 5 } = req.body;
        
        if (!questionsDatabase[subject]) {
            return res.status(400).json({ message: 'Matéria não encontrada' });
        }

        let questions = [];
        let source = 'database';

        if (model && Math.random() > 0.3) {
            try {
                questions = await generateQuestionsWithGemini(subject, difficulty, count);
                source = 'gemini';
                console.log(`✅ ${questions.length} questões geradas pelo Gemini`);
            } catch (error) {
                console.warn('⚠️ Gemini falhou, usando banco de dados');
                questions = getRandomQuestions(subject, count);
            }
        } else {
            questions = getRandomQuestions(subject, count);
        }

        if (questions.length === 0) {
            questions = getRandomQuestions('matematica', count);
        }

        const questionsForClient = questions.slice(0, count).map((q, index) => ({
            id: index + 1,
            question: q.question,
            options: q.options,
            difficulty: q.difficulty || 'medium'
        }));

        res.json({
            questions: questionsForClient,
            total: questionsForClient.length,
            subject: subject,
            source: source,
            _questionsData: questions
        });

    } catch (error) {
        console.error('Erro ao gerar questões:', error);
        res.status(500).json({ message: 'Erro ao gerar questões' });
    }
});

app.post('/api/submit-quiz', authenticateToken, async (req, res) => {
    try {
        const { subject, answers, questionsData } = req.body;
        const userId = req.user.id;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ message: 'Respostas inválidas' });
        }

        if (!questionsData || questionsData.length === 0) {
            return res.status(400).json({ message: 'Dados das questões não fornecidos' });
        }

        let correctCount = 0;
        const totalQuestions = answers.length;

        answers.forEach((answer, index) => {
            if (index < questionsData.length && answer === questionsData[index].correctAnswer) {
                correctCount++;
            }
        });

        const accuracy = Math.round((correctCount / totalQuestions) * 100);
        const pointsEarned = correctCount * 20;

        const userIndex = users.findIndex(user => user.id === userId);
        if (userIndex !== -1) {
            users[userIndex].points += pointsEarned;
        }

        const recommendations = generateRecommendations(accuracy, subject);

        res.json({
            correctAnswers: correctCount,
            totalQuestions: totalQuestions,
            accuracy: accuracy,
            points: pointsEarned,
            recommendations: recommendations
        });
    } catch (error) {
        console.error('Erro ao processar quiz:', error);
        res.status(500).json({ message: 'Erro ao processar respostas' });
    }
});

function generateRecommendations(accuracy, subject) {
    const recommendations = [];
    
    if (accuracy < 40) {
        recommendations.push(`Revise os conceitos básicos de ${subject}`);
        recommendations.push("Dedique mais tempo aos estudos diários");
        recommendations.push("Procure exercícios de nível básico para fortalecer a base");
        recommendations.push("Assista a vídeos explicativos no YouTube ou plataformas de ensino");
        recommendations.push("Faça anotações à mão para fixar melhor o conteúdo");
        recommendations.push("Peça ajuda a um professor ou colega de confiança");
        recommendations.push("Organize um cronograma com metas pequenas e alcançáveis");
    } else if (accuracy < 70) {
        recommendations.push("Continue praticando regularmente");
        recommendations.push(`Foque nos tópicos mais difíceis de ${subject}`);
        recommendations.push("Faça resumos dos conteúdos estudados");
        recommendations.push("Resolva provas anteriores ou simulados");
        recommendations.push("Explique a matéria em voz alta como se estivesse ensinando");
        recommendations.push("Utilize mapas mentais para relacionar os conteúdos");
        recommendations.push("Participe de grupos de estudo para trocar conhecimento");
    } else {
        recommendations.push("Excelente desempenho! Continue assim");
        recommendations.push("Tente questões de nível mais avançado");
        recommendations.push("Ajude colegas com dificuldades na matéria");
        recommendations.push("Busque aprofundamento em livros ou artigos especializados");
        recommendations.push("Explore temas relacionados para expandir seu conhecimento");
        recommendations.push("Mantenha a regularidade, mesmo já estando em bom nível");
        recommendations.push("Estabeleça novos desafios pessoais, como competições ou olimpíadas");
    }
    
    
    recommendations.push("Faça pausas regulares para evitar cansaço mental");
    recommendations.push("Durma bem para melhorar a retenção da memória");
    recommendations.push("Use aplicativos de organização de tarefas e estudos");
    recommendations.push("Equilibre estudo com lazer e atividade física");

    return recommendations;
}


app.get('/api/ranking', (req, res) => {
    try {
        const allUsers = [...rankings, ...users.map(user => ({
            id: user.id,
            name: user.name,
            points: user.points || 0,
            avatar: user.name.charAt(0).toUpperCase()
        }))];

        const sortedRanking = allUsers
            .sort((a, b) => b.points - a.points)
            .map((user, index) => ({
                ...user,
                position: index + 1
            }));

        res.json({
            ranking: sortedRanking.slice(0, 20)
        });
    } catch (error) {
        console.error('Erro no ranking:', error);
        res.status(500).json({ message: 'Erro ao obter ranking' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'SmartTest API funcionando',
        timestamp: new Date().toISOString(),
        gemini: !!model
    });
});

app.get('/api/subjects', (req, res) => {
    res.json({
        subjects: Object.keys(questionsDatabase),
        total: Object.keys(questionsDatabase).length
    });
});

app.get('/api/profile', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                points: user.points || 0,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ message: 'Erro ao buscar dados do perfil' });
    }
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'SmartTest API',
        version: '2.0.0',
        endpoints: ['/api/health', '/api/register', '/api/login', '/api/generate-questions', '/api/submit-quiz', '/api/ranking']
    });
});

app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err.stack);
    res.status(500).json({ message: 'Erro interno do servidor' });
});

app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint não encontrado' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: https://smarttestai.netlify.app`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Gemini: ${model ? 'Ativo' : 'Inativo'}`);
});