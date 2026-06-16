/// ui.js
document.addEventListener("DOMContentLoaded", () => {
    generatePeople(25);
    initGraph();
    updateStats();
    buildInterestCheckboxes();
    
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
}

function toggleAddMode() {
    isAddMode = !isAddMode;
    const fab = document.getElementById("fab");
    selectedForConnection = null;
    
    if (isAddMode) {
        fab.classList.add("active");
        fab.innerHTML = '<i class="fas fa-magic"></i>';
        showToast("Режим зв'язків: Клікніть на дві вершини поспіль.");
        document.getElementById("graph-svg").style.cursor = "crosshair";
    } else {
        fab.classList.remove("active");
        fab.innerHTML = '<i class="fas fa-link"></i>';
        showToast("Режим редагування вимкнено.");
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
    
    renderNearbyPeople(person);
    
    const recs = getRecommendations(person.id);
    const recContainer = document.getElementById("panel-recommendation");
    
    if (recs.length > 0) {
        const topRec = recs[0];
        const shared = getSharedInterests(person.id, topRec.id);
        recContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center">
                <strong>${topRec.name}</strong>
                <span style="color:var(--accent-pink)">${Math.round(topRec.similarity * 100)}% збіг</span>
            </div>
            <div style="font-size:11px; margin-top:4px; opacity:0.8">Спільне: ${shared.join(', ')}</div>
            <button onclick="quickAddFriend(${person.id}, ${topRec.id})" class="btn outline-pink full-width mt-4" style="padding: 6px;">
                <i class="fas fa-user-plus"></i> Додати зв'язок
            </button>
        `;
    } else {
        recContainer.innerHTML = "<div style='opacity:0.6'>Немає рекомендацій</div>";
    }
    
    panel.dataset.currentId = person.id;
    panel.classList.remove("hidden");
}

function renderNearbyPeople(centerPerson) {
    const container = document.getElementById("panel-nearby");
    if (!container) return;

    let distances = people
        .filter(p => p.id !== centerPerson.id)
        .map(p => {
            const dx = p.x - centerPerson.x;
            const dy = p.y - centerPerson.y;
            const dist = Math.sqrt(dx*dx + dy*dy).toFixed(1);
            const gnnSim = calculateCosineSimilarity(centerPerson, p);
            return { ...p, distance: parseFloat(dist), gnnSim: gnnSim };
        });

    distances.sort((a, b) => a.distance - b.distance || b.gnnSim - a.gnnSim);

    container.innerHTML = distances.slice(0, 3).map(p => `
        <div class="nearby-item" style="display:flex; justify-content:space-between; margin-top:8px; font-size:12px; background:rgba(255,255,255,0.05); padding:6px; border-radius:6px;">
            <span>📍 <strong>${p.name}</strong></span>
            <span style="color:var(--text-muted)">Відстань: ${p.distance}м (${Math.round(p.gnnSim*100)}% GNN)</span>
        </div>
    `).join('');
}

function buildInterestCheckboxes() {
    const container = document.getElementById("interests-selector");
    if (!container) return;
    container.innerHTML = interestPool.map(int => `
        <label style="display:inline-flex; align-items:center; margin:4px; font-size:12px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; cursor:pointer;">
            <input type="checkbox" value="${int}" style="margin-right:4px;"> ${int}
        </label>
    `).join('');
}

function createNewUser() {
    const nameInput = document.getElementById("new-user-name");
    const name = nameInput.value.trim();
    if (!name) { showToast("Введіть ім'я!"); return; }

    const checkedBoxes = document.querySelectorAll("#interests-selector input:checked");
    const selectedInts = Array.from(checkedBoxes).map(cb => cb.value);

    if (selectedInts.length === 0) { showToast("Оберіть хоча б 1 інтерес!"); return; }

    const added = addCustomPerson(name, selectedInts);
    updateGraphElements();
    nameInput.value = "";
    document.querySelectorAll("#interests-selector input:checked").forEach(cb => cb.checked = false);
    
    switchTab(0);
    openNodePanel(added);
    animateSearch(added.id);
    showToast(`Користувача ${name} додано!`);
}

function closeFloatingPanel() {
    document.getElementById("floating-panel").classList.add("hidden");
    resetHighlights();
}

function quickAddFriend(id1, id2) {
    addEdge(id1, id2);
    updateGraphElements();
    showToast("Зв'язок успішно додано!");
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
        if (degree > maxEdges) { maxEdges = degree; hubId = p.id; }
    });
    
    if (hubId !== null) {
        openNodePanel(people.find(p => p.id === hubId));
        animateSearch(hubId);
        showToast(`Хаб топології: ${people.find(p => p.id === hubId).name} (${maxEdges} зв'язків)`);
    }
}

function randomizeConnections() {
    edges = [];
    const count = people.length;
    for (let i = 0; i < 60; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        if (a !== b) addEdge(a, b);
    }
    updateGraphElements();
    showToast("Топологію перегенеровано.");
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
            showToast("Людину не знайдено");
        }
    }
}

function renderProfiles() {
    const container = document.getElementById("profile-grid");
    container.innerHTML = people.map(p => {
        const degree = edges.filter(e => e[0] === p.id || e[1] === p.id).length;
        return `
        <div class="profile-card" onclick="switchTab(0); openNodePanel(people.find(pe => pe.id === ${p.id})); animateSearch(${p.id})">
            <h3 style="color:var(--accent-pink); margin-bottom:12px;">${p.name}</h3>
            <div class="interests">
                ${p.interests.map(i => `<span class="interest-tag">${i}</span>`).join('')}
            </div>
            <div style="margin-top:16px; font-size:13px; color:var(--text-muted)">
                <i class="fas fa-link"></i> Топологічний ступінь: ${degree}
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
                            Точний збіг: <strong>${Math.round(recs[0].similarity * 100)}%</strong> | Спільне: ${recs[0].shared.join(', ')}
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
    people.forEach(p => { p.interests.forEach(i => { counts[i] = (counts[i] || 0) + 1; }); });
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
    toastTimeout = setTimeout(() => { toast.classList.add("hidden"); }, 3000);
}

// =========================================================
// ДОПОВНЕНА РЕАЛЬНІСТЬ (AR) ТА 3D НА БАЗІ A-FRAME
// =========================================================
let arContainer = null;

function initARMode() {
    showToast("Запуск A-Frame 3D/AR простору...");
    
    // Створюємо контейнер-оверлей для A-Frame сцени
    arContainer = document.createElement("div");
    arContainer.id = "aframe-ar-overlay";
    arContainer.style.position = "fixed";
    arContainer.style.top = "0";
    arContainer.style.left = "0";
    arContainer.style.width = "100vw";
    arContainer.style.height = "100vh";
    arContainer.style.zIndex = "9999";
    document.body.appendChild(arContainer);

    // HTML-структура A-Frame сцени
    arContainer.innerHTML = `
        <a-scene embedded xr-mode-ui="enabled: true" webxr="optionalFeatures: dom-overlay; overlayElement: #ar-ui-overlay">
            <a-assets>
                </assets>

            <a-entity camera look-controls wasd-controls position="0 1.6 3">
                <a-cursor id="mouseCursor" raycaster="objects: .ar-node" material="color: #ff7eb3; shader: flat" position="0 0 -1" geometry="primitive: ring; radiusInner: 0.02; radiusOuter: 0.03"></a-cursor>
            </a-entity>

            <a-entity light="type: ambient; color: #fff; intensity: 0.8"></a-entity>
            <a-entity light="type: directional; color: #ff7eb3; intensity: 0.6" position="-1 2 1"></a-entity>

            <a-entity id="graph-holder" position="0 1 -2" scale="0.003 0.003 0.003"></a-entity>
        </a-scene>

        <div id="ar-ui-overlay" style="position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 10px; color: white; font-family: sans-serif; z-index: 10000; pointer-events: auto;">
            <h4 style="color:var(--accent-pink); margin: 0 0 5px 0;">A-Frame WebXR Простір</h4>
            <p style="margin: 0 0 10px 0; font-size: 12px; opacity: 0.8;">Наведіть центр екрана (кільце) на сферу для взаємодії.</p>
            <div style="display: flex; gap: 8px;">
                <button onclick="window.toggleAFrameAddMode()" class="btn outline-pink" id="ar-add-btn" style="padding: 6px 12px; font-size: 11px;">Режим зв'язків: ВИМК</button>
                <button onclick="window.closeAFrameAR()" class="btn danger" style="padding: 6px 12px; font-size: 11px;"><i class="fas fa-times"></i> Вийти</button>
            </div>
        </div>
    `;

    // Глобальні функції керування всередині AR
    window.toggleAFrameAddMode = function() {
        isAddMode = !isAddMode;
        selectedForConnection = null;
        const btn = document.getElementById('ar-add-btn');
        if (isAddMode) {
            btn.style.background = "var(--accent-pink)";
            btn.style.color = "white";
            btn.textContent = "Режим зв'язків: УВІМК";
            showToast("Режим зв'язків: Оберіть дві вершини");
        } else {
            btn.style.background = "transparent";
            btn.style.color = "var(--accent-pink)";
            btn.textContent = "Режим зв'язків: ВИМК";
            showToast("Режим перегляду інформації");
        }
    };

    window.closeAFrameAR = function() {
        if (arContainer) {
            arContainer.remove();
            arContainer = null;
            isAddMode = false;
            showToast("Вихід з 3D простору");
        }
    };

    window.refreshAFrameGraph = function() {
        const holder = document.getElementById("graph-holder");
        if (!holder) return;
        holder.innerHTML = ""; // Очищення сцени

        const nodePositions = {};

        // 1. Рендеринг Вершин (Людей)
        people.forEach(p => {
            // Центруємо координати відносно локального контейнера holder
            const posX = p.x - 400;
            const posY = -(p.y - 300);
            const posZ = p.z || 0;
            nodePositions[p.id] = { x: posX, y: posY, z: posZ };

            // Створюємо сутність для вузла
            const nodeEl = document.createElement("a-entity");
            nodeEl.setAttribute("position", `${posX} ${posY} ${posZ}`);
            nodeEl.setAttribute("class", "ar-node");

            // Сфера (Тіло вузла)
            const sphereEl = document.createElement("a-sphere");
            sphereEl.setAttribute("radius", "15");
            sphereEl.setAttribute("color", "#ff7eb3");
            sphereEl.setAttribute("material", "roughness: 0.3; metalness: 0.1; emissive: #2a0815");
            
            // Анімація обертання сфери
            sphereEl.setAttribute("animation", "property: rotation; to: 0 360 0; loop: true; dur: 5000; easing: linear");
            nodeEl.appendChild(sphereEl);

            // Текст з іменем (A-Frame text компонент)
            const textEl = document.createElement("a-entity");
            textEl.setAttribute("text", `value: ${p.name}; align: center; color: #ffffff; width: 350; font: kelsonsans`);
            textEl.setAttribute("position", "0 30 0");
            // Робимо так, щоб текст завжди дивився на камеру (Billboarding)
            textEl.setAttribute("look-at", "[camera]"); 
            nodeEl.appendChild(textEl);

            // Подія кліку/наведення курсору (Raycaster Click)
            nodeEl.addEventListener("click", () => {
                if (isAddMode) {
                    if (!selectedForConnection) {
                        selectedForConnection = p;
                        showToast(`Обрано: ${p.name}. Наведіть на 2-гу вершину.`);
                        sphereEl.setAttribute("color", "#ffffff");
                    } else {
                        if (selectedForConnection.id !== p.id) {
                            const added = addEdge(selectedForConnection.id, p.id);
                            showToast(added ? "Зв'язок створено!" : "Зв'язок розірвано!");
                            if (!added) removeEdge(selectedForConnection.id, p.id);
                            window.refreshAFrameGraph();
                            updateGraphElements();
                        }
                        selectedForConnection = null;
                    }
                } else {
                    sphereEl.setAttribute("color", "#8e2de2");
                    showToast(`${p.name} | Інтереси: ${p.interests.join(', ')}`);
                    setTimeout(() => {
                        sphereEl.setAttribute("color", "#ff7eb3");
                    }, 3000);
                }
            });

            holder.appendChild(nodeEl);
        });

        // 2. Рендеринг Ребер (Зв'язків за допомогою лінії-вектора)
        edges.forEach(([u, v]) => {
            const posA = nodePositions[u];
            const posB = nodePositions[v];

            if (posA && posB) {
                const shared = getSharedInterests(u, v).length;
                const lineColor = shared > 0 ? "#ff7eb3" : "#8e2de2";
                const opacity = 0.5 + (shared * 0.15);

                const lineEl = document.createElement("a-entity");
                // Використовуємо вбудований компонент line в A-Frame
                lineEl.setAttribute("line", `start: ${posA.x} ${posA.y} ${posA.z}; end: ${posB.x} ${posB.y} ${posB.z}; color: ${lineColor}; opacity: ${opacity}`);
                holder.appendChild(lineEl);
            }
        });
    };

    // Запускаємо генерацію графа після побудови DOM сцени
    setTimeout(() => {
        window.refreshAFrameGraph();
    }, 100);
}
