// ui.js
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
// ПОВНОЦІННИЙ РЕЖИМ WEBXR (A-FRAME)
// =========================================================

window.initARMode = async function() {
    showToast("Ініціалізація WebXR через A-Frame...");
    
    // Динамічно завантажуємо A-Frame, якщо його ще немає в index.html
    if (typeof AFRAME === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://aframe.io/releases/1.4.2/aframe.min.js';
        script.onload = () => buildAFrameScene();
        document.head.appendChild(script);
    } else {
        buildAFrameScene();
    }
};

function buildAFrameScene() {
    // Приховуємо основний 2D-інтерфейс
    document.querySelector('.app').style.display = 'none';

    // Створюємо контейнер для A-Frame сцени
    const arContainer = document.createElement('div');
    arContainer.id = "aframe-ar-container";
    arContainer.style.position = "fixed";
    arContainer.style.top = "0";
    arContainer.style.left = "0";
    arContainer.style.width = "100vw";
    arContainer.style.height = "100vh";
    arContainer.style.zIndex = "9999";
    arContainer.style.background = "#0a0812";
    
    // Оверлей з кнопкою виходу (залишається активним поверх AR/3D)
    const arUI = document.createElement('div');
    arUI.id = "ar-overlay-ui";
    arUI.style.position = "absolute";
    arUI.style.bottom = "30px";
    arUI.style.left = "50%";
    arUI.style.transform = "translateX(-50%)";
    arUI.style.zIndex = "10000";
    arUI.innerHTML = `<button onclick="exitARMode()" class="btn danger" style="padding: 12px 24px; font-weight: bold; pointer-events: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">Вийти з 3D/AR</button>`;
    arContainer.appendChild(arUI);

    // Масштаб для конвертації пікселів 2D-графа у метри WebXR
    const scale = 100;
    const centerX = 400;
    const centerY = 300;

    // Формуємо A-Frame сцену
    // webxr="optionalFeatures: dom-overlay..." дозволяє клікати на наші HTML-кнопки в AR
    let sceneHTML = `<a-scene embedded webxr="optionalFeatures: dom-overlay; overlayElement: #ar-overlay-ui" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;">`;
    
    // Фон та освітлення (hide-on-enter-ar ховає небо, щоб бачити реальний світ через камеру в AR)
    sceneHTML += `
        <a-sky color="#0a0812" hide-on-enter-ar></a-sky>
        <a-light type="ambient" color="#ffffff" intensity="0.6"></a-light>
        <a-light type="directional" color="#ff7eb3" intensity="1" position="2 5 3"></a-light>
    `;

    // Камера, віддалена назад, щоб охопити граф
    sceneHTML += `<a-entity camera look-controls position="0 1.6 5"></a-entity>`;

    // Рендер вершин (Сфери + Текст)
    people.forEach(p => {
        const px = (p.x - centerX) / scale;
        const py = -(p.y - centerY) / scale;
        const pz = (p.z || 0) / scale;

        sceneHTML += `
            <a-sphere position="${px} ${py} ${pz}" radius="0.15" color="#ff7eb3" 
                      animation="property: rotation; to: 0 360 0; loop: true; dur: 4000"
                      material="emissive: #2a0815; roughness: 0.2; metalness: 0.1"></a-sphere>
            <a-text value="${p.name}" position="${px} ${py + 0.25} ${pz}" 
                    align="center" color="#ffffff" scale="0.6 0.6 0.6" side="double"></a-text>
        `;
    });

    // Рендер зв'язків (Лінії)
    edges.forEach(([u, v]) => {
        const p1 = people.find(p => p.id === u);
        const p2 = people.find(p => p.id === v);
        if (p1 && p2) {
            const px1 = (p1.x - centerX) / scale;
            const py1 = -(p1.y - centerY) / scale;
            const pz1 = (p1.z || 0) / scale;

            const px2 = (p2.x - centerX) / scale;
            const py2 = -(p2.y - centerY) / scale;
            const pz2 = (p2.z || 0) / scale;

            const sharedCount = getSharedInterests(u, v).length;
            const color = sharedCount > 0 ? "#ff7eb3" : "#8e2de2";
            
            // Вбудований компонент line в A-Frame
            sceneHTML += `<a-entity line="start: ${px1} ${py1} ${pz1}; end: ${px2} ${py2} ${pz2}; color: ${color};"></a-entity>`;
        }
    });

    sceneHTML += `</a-scene>`;
    
    // Вставляємо згенерований HTML у наш контейнер
    const sceneWrapper = document.createElement('div');
    sceneWrapper.innerHTML = sceneHTML;
    sceneWrapper.style.width = '100%';
    sceneWrapper.style.height = '100%';
    arContainer.appendChild(sceneWrapper);

    document.body.appendChild(arContainer);
}

window.exitARMode = function() {
    const arContainer = document.getElementById('aframe-ar-container');
    if (arContainer) {
        arContainer.remove();
    }
    // Повертаємо видимість стандартному інтерфейсу
    document.querySelector('.app').style.display = 'flex';
    showToast("Повернено до 2D інтерфейсу");
};

window.refreshAR = function() {
    // Якщо вузли оновилися і ми знаходимося в сцені, перемальовуємо її
    if (document.getElementById('aframe-ar-container')) {
        window.exitARMode();
        window.initARMode();
    }
};
