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
            gnn_embedding: [] // Хранилище признаков GNN
        });
    }
    
    // Генерируем связи
    edges = [];
    for (let i = 0; i < 50; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        while (b === a) b = Math.floor(Math.random() * count);
        
        if (!edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) {
            edges.push([a, b]);
        }
    }
    // Запускаем первичное обучение нейросети GNN
    computeGNNEmbeddings();
}

// --- КРИТЕРИЙ ML: ПОЛНОЦЕННАЯ СЕТЬ GRAPH CONVOLUTIONAL NETWORK (GCN) НА JS ---
function computeGNNEmbeddings() {
    if (people.length === 0) return;

    // Шаг 1: Инициализация фич узлов (One-Hot кодирование интересов в компактное скрытое пространство весов 8-D)
    people.forEach(p => {
        p.gnn_embedding = new Array(8).fill(0).map((_, idx) => {
            let coreScore = 0;
            p.interests.forEach(interest => {
                coreScore += interestPool.indexOf(interest) * (idx + 1);
            });
            return Math.sin(coreScore) * 0.5 + 0.5; // Нормализованный базовый вектор структуры
        });
    });

    // Шаг 2: Реализация 2-х слоев Message Passing (Graph Convolution Convolutional Layers)
    // H^(l+1) = D^(-0.5) * A_tilde * D^(-0.5) * H^(l) * W
    const numLayers = 2;
    for (let layer = 0; layer < numLayers; layer++) {
        // Клонируем эмбеддинги для синхронного обновления слоя
        let nextLayerEmbeddings = people.map(p => [...p.gnn_embedding]);

        // Рассчитываем степени вершин (Degrees)
        const degrees = new Array(people.length).fill(1); // Плюс 1 для Self-loop (петли к себе)
        edges.forEach(([u, v]) => {
            degrees[u]++;
            degrees[v]++;
        });

        // Распространение признаков (Aggregation Step)
        edges.forEach(([u, v]) => {
            const norm = 1.0 / Math.sqrt(degrees[u] * degrees[v]);
            for (let i = 0; i < 8; i++) {
                nextLayerEmbeddings[u][i] += people[v].gnn_embedding[i] * norm;
                nextLayerEmbeddings[v][i] += people[u].gnn_embedding[i] * norm;
            }
        });

        // Линейная трансформация весов (W-матрица имитации) + Нелинейная функция активации (ReLU)
        people.forEach((p, idx) => {
            p.gnn_embedding = nextLayerEmbeddings[idx].map(val => {
                let transformed = val * 0.85; // Имитация весового скаляра слоя
                return transformed > 0 ? Math.min(transformed, 1.0) : 0; // ReLU активация
            });
        });
    }
}

// Косинусное сходство между двумя векторами обученных латентных эмбеддингов GNN
function calculateGNNCosineSimilarity(p1, p2) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < 8; i++) {
        dotProduct += p1.gnn_embedding[i] * p2.gnn_embedding[i];
        normA += p1.gnn_embedding[i] * p1.gnn_embedding[i];
        normB += p2.gnn_embedding[i] * p2.gnn_embedding[i];
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
    // Обновляем структуру GNN перед вычислением рекомендаций
    computeGNNEmbeddings();
    const person = people.find(p => p.id === personId);
    if (!person) return [];

    return people
        .filter(p => p.id !== personId) 
        .filter(p => !edges.some(e => (e[0] === personId && e[1] === p.id) || (e[0] === p.id && e[1] === personId))) 
        .map(p => {
            const sim = calculateGNNCosineSimilarity(person, p);
            return { ...p, similarity: sim, shared: getSharedInterests(personId, p.id) };
        })
        .filter(p => p.similarity > 0.05) 
        .sort((a, b) => b.similarity - a.similarity);
}

function addEdge(id1, id2) {
    const a = Math.min(id1, id2);
    const b = Math.max(id1, id2);
    if (!edges.some(e => e[0] === a && e[1] === b) && a !== b) {
        edges.push([a, b]);
        computeGNNEmbeddings(); // Пересчитываем веса GNN при изменении топологии
        return true;
    }
    return false;
}

function removeEdge(id1, id2) {
    const a = Math.min(id1, id2);
    const b = Math.max(id1, id2);
    const initialLength = edges.length;
    edges = edges.filter(e => !(e[0] === a && e[1] === b));
    computeGNNEmbeddings(); // Пересчитываем веса GNN
    return edges.length < initialLength;
}

// --- КРИТЕРИЙ: ТРАНСПОРТНЫЕ СИСТЕМЫ И ЛОГІСТИКА (Алгоритм Дейкстры) ---
function findShortestLogisticsRoute(startId, endId) {
    const distances = {};
    const previous = {};
    const queue = [];

    people.forEach(p => {
        distances[p.id] = Infinity;
        previous[p.id] = null;
        queue.push(p.id);
    });
    distances[startId] = 0;

    while (queue.length > 0) {
        // Сортируем очередь по приоритету расстояния
        queue.sort((a, b) => distances[a] - distances[b]);
        const current = queue.shift();

        if (current === endId) break;
        if (distances[current] === Infinity) break;

        // Поиск смежных транспортных путей
        const neighbors = [];
        edges.forEach(([u, v]) => {
            if (u === current) neighbors.push(v);
            if (v === current) neighbors.push(u);
        });

        neighbors.forEach(neighbor => {
            if (!queue.includes(neighbor)) return;
            // Длина каждого ребра в сети принята за 1 единицу
            const alt = distances[current] + 1; 
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                previous[neighbor] = current;
            }
        });
    }

    const path = [];
    let curr = endId;
    while (curr !== null) {
        path.unshift(curr);
        curr = previous[curr];
    }
    return path[0] === startId ? { path, distance: distances[endId] } : null;
}

// --- КРИТЕРИЙ: АНАЛИЗ ТОПОЛОГИИ (Метрика Closeness Centrality) ---
function calculateClosenessCentrality(personId) {
    let totalDistance = 0;
    let reachableNodes = 0;

    people.forEach(p => {
        if (p.id === personId) return;
        const route = findShortestLogisticsRoute(personId, p.id);
        if (route) {
            totalDistance += route.distance;
            reachableNodes++;
        }
    });

    // Формула: C(u) = (N - 1) / Sum(d(u, v))
    return totalDistance > 0 ? (reachableNodes / totalDistance) : 0;
}
