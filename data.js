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

function generatePeople(count = 28) {
    people = [];
    for (let i = 0; i < count; i++) {
        const shuffled = [...interestPool].sort(() => 0.5 - Math.random());
        const interests = shuffled.slice(0, 4);
        
        people.push({
            id: i,
            name: names[i % names.length] + " " + String.fromCharCode(65 + Math.floor(i/10)),
            interests: interests,
            x: Math.random() * 800,
            y: Math.random() * 600
        });
    }
    
    // Generate initial connections
    edges = [];
    for (let i = 0; i < 60; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        while (b === a) b = Math.floor(Math.random() * count);
        
        if (!edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) {
            edges.push([a, b]);
        }
    }
}

// ML Feature: Cosine Similarity for vectors (interests)
function calculateCosineSimilarity(p1, p2) {
    const intersection = p1.interests.filter(i => p2.interests.includes(i)).length;
    if (intersection === 0) return 0;
    
    const magnitude1 = Math.sqrt(p1.interests.length);
    const magnitude2 = Math.sqrt(p2.interests.length);
    
    return intersection / (magnitude1 * magnitude2);
}

function getSharedInterests(id1, id2) {
    const p1 = people.find(p => p.id === id1);
    const p2 = people.find(p => p.id === id2);
    if (!p1 || !p2) return [];
    return p1.interests.filter(i => p2.interests.includes(i));
}

function getRecommendations(personId) {
    const person = people.find(p => p.id === personId);
    
    const recs = people
        .filter(p => p.id !== personId) // Not self
        .filter(p => !edges.some(e => (e[0] === personId && e[1] === p.id) || (e[0] === p.id && e[1] === personId))) // Not already friends
        .map(p => {
            const sim = calculateCosineSimilarity(person, p);
            return { ...p, similarity: sim, shared: getSharedInterests(personId, p.id) };
        })
        .filter(p => p.similarity > 0) // Only recommend if they have common interests
        .sort((a, b) => b.similarity - a.similarity);

    return recs;
}

function addEdge(id1, id2) {
    const a = Math.min(id1, id2);
    const b = Math.max(id1, id2);
    if (!edges.some(e => e[0] === a && e[1] === b) && a !== b) {
        edges.push([a, b]);
        return true;
    }
    return false;
}

function removeEdge(id1, id2) {
    const a = Math.min(id1, id2);
    const b = Math.max(id1, id2);
    const initialLength = edges.length;
    edges = edges.filter(e => !(e[0] === a && e[1] === b));
    return edges.length < initialLength;
}
