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
            z: (Math.random() - 0.5) * 300 // 3D координата для AR простору
        });
    }
    
    edges = [];
    for (let i = 0; i < 50; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        if (a !== b) addEdge(a, b);
    }
    
    computeGNNEmbeddings();
}

// === МАШИННЕ НАВЧАННЯ: GRAPH CONVOLUTIONAL NETWORK (GCN) ===
function computeGNNEmbeddings() {
    const N = people.length;
    const M = interestPool.length;
    if (N === 0) return;

    // 1. Створення матриці ознак X (One-Hot encoding інтересів)
    let X = Array(N).fill(0).map(() => Array(M).fill(0));
    people.forEach((p, idx) => {
        p.interests.forEach(interest => {
            const intIdx = interestPool.indexOf(interest);
            if (intIdx !== -1) X[idx][intIdx] = 1;
        });
    });

    // 2. Побудова матриці суміжності з урахуванням self-loops (A_hat = A + I)
    let A_hat = Array(N).fill(0).map(() => Array(N).fill(0));
    for (let i = 0; i < N; i++) A_hat[i][i] = 1; // Self-loop
    edges.forEach(([u, v]) => {
        if (u < N && v < N) {
            A_hat[u][v] = 1;
            A_hat[v][u] = 1;
        }
    });

    // 3. Розрахунок матриці ступенів D_hat та симетричне нормування (D^-0.5 * A_hat * D^-0.5)
    let degrees = Array(N).fill(0);
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) degrees[i] += A_hat[i][j];
    }

    let A_norm = Array(N).fill(0).map(() => Array(N).fill(0));
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (degrees[i] > 0 && degrees[j] > 0) {
                A_norm[i][j] = A_hat[i][j] / Math.sqrt(degrees[i] * degrees[j]);
            }
        }
    }

    // 4. Прохід шару 1 (Message Passing): H1 = ReLU(A_norm * X * W1)
    // Фіксовані ваги для стабільності демонстрації (розмірність M x 8)
    let W1 = Array(M).fill(0).map((_, i) => Array(8).fill(0).map((_, j) => Math.sin(i + j * 0.5)));
    let H1 = Array(N).fill(0).map(() => Array(8).fill(0));
    
    // Множення A_norm * X
    let AX = Array(N).fill(0).map(() => Array(M).fill(0));
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
            for (let k = 0; k < N; k++) AX[i][j] += A_norm[i][k] * X[k][j];
        }
    }
    // Множення на W1 та активація ReLU
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < 8; j++) {
            let sum = 0;
            for (let k = 0; k < M; k++) sum += AX[i][k] * W1[k][j];
            H1[i][j] = Math.max(0, sum); // ReLU
        }
    }

    // Зберігаємо отримані ембеддінги графа у об'єкти вершин
    people.forEach((p, idx) => {
        p.gnnEmbedding = H1[idx];
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

function getRecommendations(personId) {
    const person = people.find(p => p.id === personId);
    if (!person) return [];
    
    return people
        .filter(p => p.id !== personId)
        .filter(p => !edges.some(e => (e[0] === personId && e[1] === p.id) || (e[0] === p.id && e[1] === personId)))
        .map(p => {
            const sim = calculateCosineSimilarity(person, p);
            return { ...p, similarity: sim, shared: getSharedInterests(personId, p.id) };
        })
        .filter(p => p.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity);
}

function addCustomPerson(name, selectedInterests) {
    const newId = people.length > 0 ? Math.max(...people.map(p => p.id)) + 1 : 0;
    const newPerson = {
        id: newId,
        name: name,
        interests: selectedInterests,
        x: 200 + Math.random() * 400,
        y: 200 + Math.random() * 200,
        z: (Math.random() - 0.5) * 200
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
        computeGNNEmbeddings(); // Перераховуємо ваги графа після зміни топології
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
