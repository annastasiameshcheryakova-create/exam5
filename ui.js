// ui.js
document.addEventListener("DOMContentLoaded", () => {
    generatePeople(25);
    initGraph();
    updateStats();
    
    document.getElementById("graph-svg").addEventListener("click", () => {
        if(!isAddMode) resetHighlights();
    });
});

function updateStats() {
    document.getElementById("total-people").textContent = people.length;
    document.getElementById("total-edges").textContent = edges.length;
}

function switchTab(tabIndex) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabIndex}`).classList.add('active');
    
    document.querySelectorAll('.menu a').forEach((el, i) => {
        if (i === tabIndex) el.classList.add('active');
        else el.classList.remove('active');
    });
    
    if (tabIndex === 1) renderProfiles();
    if (tabIndex === 2) renderRecommendationsTab();
    if (tabIndex === 3) renderInterests();
    if (tabIndex === 4) {
        if (simulation) simulation.stop(); // Останавливаем 2D симуляцию для разгрузки процессора в AR
    } else {
        if (simulation && tabIndex === 0) simulation.alpha(0.3).restart();
    }
}

function toggleAddMode() {
    isAddMode = !isAddMode;
    const fab = document.getElementById("fab");
    selectedForConnection = null;
    
    if (isAddMode) {
        fab.classList.add("active");
        fab.innerHTML = '<i class="fas fa-magic"></i>';
        showToast("Режим редагування зв'язків: УВІМКНЕНО. Клікайте на вершини.");
        document.getElementById("graph-svg").style.cursor = "crosshair";
    } else {
        fab.classList.remove("active");
        fab.innerHTML = '<i class="fas fa-link"></i>';
        showToast("Режим редагування: ВИМКНЕНО.");
        document.getElementById("graph-svg").style.cursor = "grab";
        resetHighlights();
    }
}

function openNodePanel(person) {
    const panel = document.getElementById("floating-panel");
    document.getElementById("panel-name").textContent = person.name;
    document.getElementById("panel-avatar").textContent = person.name[0];
    
    const intsContainer = document.getElementById("panel-interests");
    intsContainer.innerHTML = person.interests.map(i => `<span class="interest-tag">${i}</span>`).join('');
    
    const recs = getRecommendations(person.id);
    const recContainer = document.getElementById("panel-recommendation");
    
    if (recs.length > 0) {
        const topRec = recs[0];
        const shared = getSharedInterests(person.id, topRec.id);
        recContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center">
                <strong>${topRec.name}</strong>
                <span style="color:var(--accent-pink)">${Math.round(topRec.similarity * 100)}% GNN збіг</span>
            </div>
            <div style="font-size:11px; margin-top:4px; opacity:0.8">Спільне: ${shared.join(', ')}</div>
            <button onclick="quickAddFriend(${person.id}, ${topRec.id})" class="btn outline-pink full-width mt-4" style="padding: 6px;">
                <i class="fas fa-user-plus"></i> Додати
            </button>
        `;
    } else {
        recContainer.innerHTML = "<div style='opacity:0.6'>Немає ідеальних рекомендацій</div>";
    }
    
    panel.dataset.currentId = person.id;
    panel.classList.remove("hidden");
}

function closeFloatingPanel() {
    document.getElementById("floating-panel").classList.add("hidden");
    resetHighlights();
}

function quickAddFriend(id1, id2) {
    addEdge(id1, id2);
    updateGraphElements();
    showToast("Транспортний вузол підключено!");
    openNodePanel(people.find(p => p.id === id1));
}

function highlightSimilarNodes() {
    const panel = document.getElementById("floating-panel");
    const targetId = parseInt(panel.dataset.currentId);
    animateSearch(targetId);
}

function findHub() {
    switchTab(0);
    let maxEdges = 0;
    let hubId = null;
    
    people.forEach(p => {
        const degree = edges.filter(e => e[0] === p.id || e[1] === p.id).length;
        if (degree > maxEdges) {
            maxEdges = degree;
            hubId = p.id;
        }
    });
    
    if (hubId !== null) {
        openNodePanel(people.find(p => p.id === hubId));
        animateSearch(hubId);
        showToast(`Хаб знайдено: ${people.find(p => p.id === hubId).name} має ${maxEdges} зв'язків!`);
    }
}

function randomizeConnections() {
    edges = [];
    const count = people.length;
    for (let i = 0; i < 55; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        if (a !== b) addEdge(a, b);
    }
    updateGraphElements();
    showToast("Зв'язки мережі перегенеровано.");
}

function resetGraph() {
    edges = [];
    updateGraphElements();
    showToast("Граф повністю очищено.");
}

function searchPeople(e) {
    if (e.key === "Enter") {
        const term = e.target.value.toLowerCase();
        const found = people.find(p => p.name.toLowerCase().includes(term));
        if (found) {
            switchTab(0);
            openNodePanel(found);
            animateSearch(found.id);
        } else {
            showToast("Об'єкт не знайдено");
        }
    }
}

// Рендеринг профайлов с выводом Closeness Centrality топологии
function renderProfiles() {
    const container = document.getElementById("profile-grid");
    container.innerHTML = people.map(p => {
        const degree = edges.filter(e => e[0] === p.id || e[1] === p.id).length;
        const closeness = calculateClosenessCentrality(p.id).toFixed(3);
        return `
        <div class="profile-card" onclick="switchTab(0); openNodePanel(people[${p.id}]); animateSearch(${p.id})">
            <h3 style="color:var(--accent-pink); margin-bottom:8px;">${p.name} (ID: ${p.id})</h3>
            <div class="interests" style="margin-bottom: 12px;">
                ${p.interests.map(i => `<span class="interest-tag">${i}</span>`).join('')}
            </div>
            <div style="font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px;">
                <span><i class="fas fa-link"></i> Ступінь вузла (Degree): ${degree}</span>
                <span><i class="fas fa-chart-pie"></i> Близькість (Closeness Centrality): <strong>${closeness}</strong></span>
            </div>
        </div>
    `}).join('');
}

// Рендеринг ШИ рекомендаций на базе скрытых эмбеддингов нейросети GCN
function renderRecommendationsTab() {
    const container = document.getElementById("recommendations-list");
    let html = '';
    
    people.forEach(person => {
        const recs = getRecommendations(person.id);
        if (recs.length > 0) {
            html += `
                <div class="rec-card">
                    <div>
                        <strong style="color:white">${person.name}</strong> 
                        <i class="fas fa-arrow-right mx-2" style="color:var(--text-muted); font-size:12px; margin:0 10px;"></i> 
                        <span style="color:var(--accent-pink)">${recs[0].name}</span>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">
                            Нейромережевий збіг (GCN Embedding Similarity): <strong style="color:var(--accent-pink)">${Math.round(recs[0].similarity * 100)}%</strong> | Спільні інтереси: ${recs[0].shared.join(', ') || 'немає'}
                        </div>
                    </div>
                    <button onclick="quickAddFriend(${person.id}, ${recs[0].id}); switchTab(0)" class="btn outline-pink">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
        }
    });
    
    container.innerHTML = html || "<div style='color:var(--text-muted);'>Побудуйте більше зв'язків для розрахунку матриць графової мережі.</div>";
}

function renderInterests() {
    const counts = {};
    people.forEach(p => {
        p.interests.forEach(i => {
            counts[i] = (counts[i] || 0) + 1;
        });
    });
    
    const container = document.getElementById("all-interests");
    container.innerHTML = Object.entries(counts)
        .sort((a,b) => b[1] - a[1])
        .map(([int, count]) => `
            <div class="interest-tag" style="font-size:14px; padding:8px 16px; background:rgba(255,126,179,0.1); border-color:var(--accent-pink)">
                ${int} <span style="opacity:0.6; margin-left:6px;">${count}</span>
            </div>
        `).join('');
}

// Логика вычисления кратчайшего пути для транспортной логистики
function calculateLogisticsRoute() {
    const startId = parseInt(document.getElementById("logistics-start").value);
    const endId = parseInt(document.getElementById("logistics-end").value);
    const resultDiv = document.getElementById("logistics-result");

    if (isNaN(startId) || isNaN(endId)) {
        resultDiv.innerHTML = "<span style='color:var(--danger)'>Помилка: Введіть коректні чисельні ID вузлів!</span>";
        return;
    }

    const routeData = findShortestLogisticsRoute(startId, endId);
    if (routeData) {
        const namesPath = routeData.path.map(id => {
            let p = people.find(item => item.id === id);
            return `${p.name} (ID: ${id})`;
        });
        resultDiv.innerHTML = `<span style='color:#00ffcc;'><strong>Маршрут знайдено:</strong></span> ${namesPath.join(" ➔ ")} <br><span style='font-size:12px; color:var(--text-muted);'>Загальна вартість доставки (кількість транзитних ребер): ${routeData.distance}</span>`;
    } else {
        resultDiv.innerHTML = "<span style='color:var(--danger)'>Шлях між вказаними транспортними вузлами заблокований або відсутній.</span>";
    }
}

// Toast Notification System
let toastTimeout;
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}
