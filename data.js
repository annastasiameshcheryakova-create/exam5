// data.js
let people = [];
let edges = [];

const interestPool = [
    "WebXR", "Геймдев", "Аніме", "Кіберспорт", "ШІ та ML", "UI/UX Дизайн",
    "Genshin Impact", "3D Моделювання", "Теорія Графів", "C++", "JavaScript", "React",
    "Blender", "Figma", "AR/VR", "Кіно", "Музика", "Фотографія", "Спорт",
    "Література", "Малювання", "Естетика", "Стримінг", "Криптовалюта", "Робототехніка",
    "Косплей", "Фізика", "Хімія", "Історія", "Психологія", "Стартапи", "Велоспорт"
];

const names = [
    "Анастасія", "Максим", "Софія", "Дмитро", "Ольга", "Іван", "Марія", 
    "Артем", "Катерина", "Олександр", "Поліна", "Віктор", "Анна", 
    "Єгор", "Вікторія", "Тимофій", "Єлизавета", "Михайло", "Дарина",
    "Роман", "Аліна", "Кирило", "Вероніка", "Богдан", "Юлія", "Павло",
    "Христина", "Ігор"
];

function generatePeople(count = 25) {
    people = [];
    for (let i = 0; i < count; i++) {
        const shuffled = [...interestPool].sort(() => 0.5 - Math.random());
        const interests = shuffled.slice(0, 4);
        
        people.push({
            id: i,
            name: names[i % names.length] + " " + String.fromCharCode(65 + Math.floor(i/10)),
            interests: interests,
            x: Math.random() * 800,
            y: Math.random() * 600,
            z: (Math.random() - 0.5) * 200
        });
    }
    
    edges = [];
    for (let i = 0; i < 45; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        if (a !== b) addEdge(a, b);
    }
    
    computeGNNEmbeddings();
}

// === ДЕТЕРМИНИРОВАННЫЙ СТАБИЛЬНЫЙ GNN ЭМБЕДДИНГ (MESSAGE PASSING) ===
function computeGNNEmbeddings() {
    const N = people.length;
    const M = interestPool.length;
    if (N === 0) return;

    // Матрица признаков X (One-Hot)
    let X = Array(N).fill(0).map(() => Array(M).fill(0));
    people.forEach((p, idx) => {
        p.interests.forEach(interest => {
            const intIdx = interestPool.indexOf(interest);
            if (intIdx !== -1) X[idx][intIdx] = 1;
        });
    });

    // Создание фиксированного вектора (Residual Skip-Connection)
    // Первые M измерений — личные интересы, вторые M измерений — агрегированные интересы соседей.
    let H = Array(N).fill(0).map(() => Array(M * 2).fill(0));
    
    for (let i = 0; i < N; i++) {
        // Личные интересы
        for (let j = 0; j < M; j++) {
            H[i][j] = X[i][j] * 2.0; 
        }
        
        // Посыл сообщений от соседей по графу
        const neighbors = edges.filter(e => e[0] === i || e[1] === i)
                               .map(e => e[0] === i ? e[1] : e[0]);
                               
        neighbors.forEach(nIdx => {
            if (nIdx < N) {
                for (let j = 0; j < M; j++) {
                    H[i][M + j] += X[nIdx][j] / (neighbors.length || 1);
                }
            }
        });
    }

    people.forEach((p, idx) => {
        p.gnnEmbedding = H[idx];
    });
}

function calculateCosineSimilarity(p1, p2) {
    if (!p1.gnnEmbedding || !p2.gnnEmbedding) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    
    for (let i = 0; i < p1.gnnEmbedding.length; i++) {
        dotProduct += p1.gnnEmbedding[i] * p2.gnnEmbedding[i];
        normA += p1.gnnEmbedding[i] * p1.gnnEmbedding[i];
        normB += p2.gnnEmbedding[i] * p2.gnnEmbedding[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getSharedInterests(id1, id2) {
    const p1 = people.find(p => p.id === id1);
    const p2 = people.find(p => p.id === id2);
    if (!p1 || !p2) return [];
    return p1.interests.filter(i => p2.interests.includes(i));
}

// === ТОЧНЫЙ ПОДБОР ПО ОБЩИМ ИНТЕРЕСАМ ===
function getRecommendations(personId) {
    const person = people.find(p => p.id === personId);
    if (!person) return [];
    
    return people
        .filter(p => p.id !== personId)
        // Исключаем тех, кто уже в друзьях
        .filter(p => !edges.some(e => (e[0] === personId && e[1] === p.id) || (e[0] === p.id && e[1] === personId)))
        .map(p => {
            const sim = calculateCosineSimilarity(person, p);
            return { ...p, similarity: sim, shared: getSharedInterests(personId, p.id) };
        })
        // Жесткий фильтр: обязательно наличие хотя бы одного общего интереса
        .filter(p => p.shared.length > 0)
        // Сортировка: сначала количество общих интересов, затем близость структуры графа (GNN)
        .sort((a, b) => b.shared.length - a.shared.length || b.similarity - a.similarity);
}

function addCustomPerson(name, selectedInterests) {
    const newId = people.length > 0 ? Math.max(...people.map(p => p.id)) + 1 : 0;
    const newPerson = {
        id: newId,
        name: name,
        interests: selectedInterests,
        x: 200 + Math.random() * 400,
        y: 200 + Math.random() * 200,
        z: (Math.random() - 0.5) * 150
    };
    people.push(newPerson);
    computeGNNEmbeddings();
    return newPerson;
}

function addEdge(id1, id2) {
    const a = Math.min(id1, id2);
    const b = Math.max(id1, id2);
    if (!edges.some(e => e[0] === a && e[1] === b) && a !== b) {
        edges.push([a, b]);
        computeGNNEmbeddings();
        return true;
    }
    return false;
}

function removeEdge(id1, id2) {
    const a = Math.min(id1, id2);
    const b = Math.max(id1, id2);
    const initialLength = edges.length;
    edges = edges.filter(e => !(e[0] === a && e[1] === b));
    computeGNNEmbeddings();
    return edges.length < initialLength;
}
