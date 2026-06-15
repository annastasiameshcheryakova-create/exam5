// ui.js
let arAnimationId = null;

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
    
    // Остановка AR-сессии при уходе со вкладки
    if (tabIndex !== 4 && arAnimationId) {
        cancelAnimationFrame(arAnimationId);
        arAnimationId = null;
        document.getElementById("ar-canvas").style.display = "none";
        document.getElementById("ar-intro").style.display = "block";
        document.getElementById("ar-status-overlay").style.display = "none";
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
    
    // Interests
    const intsContainer = document.getElementById("panel-interests");
    intsContainer.innerHTML = person.interests.map(i => `<span class="interest-tag">${i}</span>`).join('');
    
    // Точные рекомендации по общим интересам
    const recs = getRecommendations(person.id);
    const recContainer = document.getElementById("panel-recommendation");
    
    if (recs.length > 0) {
        const topRec = recs[0];
        const shared = getSharedInterests(person.id, topRec.id);
        recContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center">
                <strong>${topRec.name}</strong>
                <span style="color:var(--accent-pink)">Спільних інтересів: ${shared.length}</span>
            </div>
            <div style="font-size:11px; margin-top:4px; opacity:0.8">Спільне: ${shared.join(', ')}</div>
            <button onclick="quickAddFriend(${person.id}, ${topRec.id})" class="btn outline-pink full-width mt-4" style="padding: 6px;">
                <i class="fas fa-user-plus"></i> Додати
            </button>
        `;
    } else {
        recContainer.innerHTML = "<div style='opacity:0.6'>Немає спільних інтересів для рекомендацій</div>";
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
    showToast("Друга додано!");
    openNodePanel(people.find(p => p.id === id1)); // refresh panel
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
    for (let i = 0; i < 70; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        if (a !== b) addEdge(a, b);
    }
    updateGraphElements();
    showToast("Зв'язки рандомізовано.");
}

function resetGraph() {
    edges = [];
    updateGraphElements();
    showToast("Граф очищено.");
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
            showToast("Людину не знайдено");
        }
    }
}

// Запуск интерактивной симуляции AR пространства
function startARSession() {
    document.getElementById("ar-intro").style.display = "none";
    const canvas = document.getElementById("ar-canvas");
    const overlay = document.getElementById("ar-status-overlay");
    
    canvas.style.display = "block";
    overlay.style.display = "block";
    showToast("AR Простір активовано!");
    
    const ctx = canvas.getContext("2d");
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Создаем копию объектов для трехмерного псевдо-движка в AR
    const arNodes = people.map(p => ({
        name: p.name.split(" ")[0],
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 250 + 50,
        dx: (Math.random() - 0.5) * 1.8,
        dy: (Math.random() - 0.5) * 1.8,
        dz: (Math.random() - 0.5) * 1.2
    }));
    
    function drawARFrame() {
        ctx.fillStyle = "rgba(11, 8, 20, 0.25)";
        ctx.fillRect(0, 0, width, height);
        
        // Отрисовка пространственной сетки («сканирование пола»)
        ctx.strokeStyle = "rgba(142, 45, 226, 0.12)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 50) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        
        // Отрисовка пространственных связей графа в 3D
        ctx.strokeStyle = "rgba(255, 126, 179, 0.3)";
        edges.forEach(([source, target]) => {
            const s = arNodes[source % arNodes.length];
            const t = arNodes[target % arNodes.length];
            if (s && t) {
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(t.x, t.y);
                ctx.stroke();
            }
        });
        
        // Просчет изменения координат и рендеринг узлов с учетом перспективы
        arNodes.forEach(n => {
            n.x += n.dx; n.y += n.dy; n.z += n.dz;
            
            if (n.x < 0 || n.x > width) n.dx *= -1;
            if (n.y < 0 || n.y > height) n.dy *= -1;
            if (n.z < 40 || n.z > 300) n.dz *= -1;
            
            const projectionScale = 180 / n.z;
            const size = 11 * projectionScale;
            
            ctx.beginPath();
            ctx.arc(n.x, n.y, Math.max(2, size), 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 126, 179, 0.85)";
            ctx.shadowBlur = 12;
            ctx.shadowColor = "var(--accent-pink)";
            ctx.fill();
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = "#ffffff";
            ctx.font = `${Math.floor(Math.max(8, 10 * projectionScale))}px Inter`;
            ctx.fillText(n.name, n.x - size, n.y - size - 4);
        });
        
        arAnimationId = requestAnimationFrame(drawARFrame);
    }
    drawARFrame();
}

function renderProfiles() {
    const container = document.getElementById("profile-grid");
    container.innerHTML = people.map(p => {
        const degree = edges.filter(e => e[0] === p.id || e[1] === p.id).length;
        return `
        <div class="profile-card" onclick="switchTab(0); openNodePanel(people[${p.id}]); animateSearch(${p.id})">
            <h3 style="color:var(--accent-pink); margin-bottom:12px;">${p.name}</h3>
            <div class="interests">
                ${p.interests.map(i => `<span class="interest-tag">${i}</span>`).join('')}
            </div>
            <div style="margin-top:16px; font-size:13px; color:var(--text-muted)">
                <i class="fas fa-link"></i> Зв'язків: ${degree}
            </div>
        </div>
    `}).join('');
}

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
                            Спільних інтересів: <strong>${recs[0].shared.length}</strong> | Спільне: ${recs[0].shared.join(', ')}
                        </div>
                    </div>
                    <button onclick="quickAddFriend(${person.id}, ${recs[0].id}); switchTab(0)" class="btn outline-pink">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
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

let toastTimeout;
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}
