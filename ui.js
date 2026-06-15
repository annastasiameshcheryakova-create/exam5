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
        recContainer.innerHTML = "<div style='opacity:0.6'>Немає рекомендацій (відсутні спільні інтереси)</div>";
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
    showToast(`Користувача ${name} додано й проаналізовано!`);
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
    showToast("Топологію зв'язків перегенеровано.");
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
                        <i class="fas fa-arrow-right" style="color:var(--text-muted); margin:0 10px;"></i> 
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
// СУЧАСНИЙ СПРАВЖНІЙ WebXR IMMERSIVE-AR МОДУЛЬ
// =========================================================
let xrScene, xrCamera, xrRenderer, xrSession = null;
let xrMeshes = {};
const raycaster = new THREE.Raycaster();
const workingVector = new THREE.Vector3();

function initARMode() {
    if (!navigator.xr) {
        showToast("Упс! Ваш браузер або пристрій не підтримує WebXR API.");
        return;
    }

    // Запит асинхронної сесії доступу до AR залізо-камери смартфона
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (!supported) {
            showToast("Режим Immersive-AR недоступний на цьому пристрої.");
            return;
        }

        // Стартуємо WebXR сесію
        navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['local'] })
            .then(onSessionStarted)
            .catch(err => {
                showToast("Не вдалося запустити AR сесію: " + err.message);
            });
    });
}

function onSessionStarted(session) {
    xrSession = session;
    showToast("WebXR сесію активовано! Граф розгорнуто навколо вашої кімнати.");

    // Налаштування сцени Three.js для AR
    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera();

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    xrRenderer.setPixelRatio(window.devicePixelRatio);
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.xr.enabled = true; // Важливо: вмикаємо внутрішній XR міст Three.js

    // Підв'язуємо рендерер до сесії WebXR пристрою
    xrRenderer.xr.setReferenceSpaceType('local');
    xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, xrRenderer.getContext()) });

    // Додаємо інтерфейс керування поверх AR шару за допомогою WebXR DOM Overlay
    let uiOverlay = document.createElement("div");
    uiOverlay.style.position = "fixed";
    uiOverlay.style.bottom = "30px";
    uiOverlay.style.left = "50%";
    uiOverlay.style.transform = "translateX(-50%)";
    uiOverlay.style.zIndex = "9999";
    uiOverlay.style.background = "rgba(15, 10, 30, 0.9)";
    uiOverlay.style.padding = "12px 20px";
    uiOverlay.style.borderRadius = "14px";
    uiOverlay.style.display = "flex";
    uiOverlay.style.gap = "10px";
    uiOverlay.style.border = "1px solid var(--accent-pink)";
    
    uiOverlay.innerHTML = `
        <button id="ar-mode-indicator" class="btn primary" style="font-size:12px; padding:6px 12px;">Режим: Огляд</button>
        <button id="ar-exit-btn" class="btn danger" style="font-size:12px; padding:6px 12px;">Вийти з AR</button>
    `;
    document.body.appendChild(uiOverlay);

    // Логіка перемикання режимів всередині AR за допомогою кнопки на екрані телефона
    const modeBtn = uiOverlay.querySelector("#ar-mode-indicator");
    if (isAddMode) modeBtn.textContent = "Режим: Зв'язки";
    
    modeBtn.onclick = (e) => {
        e.stopPropagation();
        toggleAddMode();
        modeBtn.textContent = isAddMode ? "Режим: Зв'язки" : "Режим: Огляд";
        modeBtn.style.borderColor = isAddMode ? "var(--danger)" : "var(--accent-pink)";
    };

    uiOverlay.querySelector("#ar-exit-btn").onclick = () => {
        xrSession.end();
    };

    // Обробка завершення сесії
    xrSession.addEventListener('end', () => {
        xrSession = null;
        uiOverlay.remove();
        showToast("WebXR AR сесію закрито.");
    });

    // Світло в AR просторі
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    xrScene.add(light);

    // Генерація 3D об'єктів
    buildARWorldElements();

    // Обробка натискань на екран смартфона під час AR-сесії (WebXR Inputs)
    xrSession.addEventListener('select', onARScreenTap);

    // Запуск внутрішнього циклу рендерингу WebXR
    xrRenderer.setAnimationLoop(renderARFrame);
}

function buildARWorldElements() {
    // Очищення сцени перед оновленням
    while(xrScene.children.length > 1) { 
        xrScene.remove(xrScene.children[xrScene.children.length - 1]); 
    }
    xrMeshes = {};

    // Будуємо людей у масштабі реального світу (метри замість пікселів)
    people.forEach((p, idx) => {
        const geometry = new THREE.SphereGeometry(0.04, 24, 24); // Кулі радіусом 4 сантиметри
        const material = new THREE.MeshPhongMaterial({
            color: 0xff7eb3,
            emissive: 0x1f0510,
            shininess: 30
        });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Розподіляємо вузли у просторі кімнати навколо користувача (в радіусі 1-1.5 метра)
        const angle = (idx / people.length) * Math.PI * 2;
        const radius = 1.2 + (Math.sin(idx) * 0.3); 
        const xPos = Math.cos(angle) * radius;
        const zPos = Math.sin(angle) * radius;
        const yPos = (p.y - 300) / 400; // Центруємо по висоті грудей/очей

        sphere.position.set(xPos, yPos, zPos);
        sphere.userData = { id: p.id, name: p.name };
        xrScene.add(sphere);
        xrMeshes[p.id] = sphere;

        // Створення 3D текстових плашок імен
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'Bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.split(" ")[0], 64, 20);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(sphere.position.x, sphere.position.y + 0.07, sphere.position.z);
        sprite.scale.set(0.2, 0.05, 1);
        xrScene.add(sprite);
    });

    // Малюємо суцільні зв'язки з урахуванням товщини від кількості спільних інтересів
    edges.forEach(([u, v]) => {
        const nodeA = xrMeshes[u];
        const nodeB = xrMeshes[v];
        if (nodeA && nodeB) {
            const points = [nodeA.position, nodeB.position];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            
            const shared = getSharedInterests(u, v).length;
            const lineColor = shared > 0 ? 0xff7eb3 : 0x8e2de2;

            const lineMat = new THREE.LineBasicMaterial({ 
                color: lineColor, 
                transparent: true,
                opacity: 0.4 + (shared * 0.15)
            });
            const line = new THREE.Line(lineGeo, lineMat);
            xrScene.add(line);
        }
    });
}

// Функція Raycasting для взаємодії за допомогою тачскріна в AR просторі
function onARScreenTap(event) {
    const inputSource = event.inputSource;
    const referenceSpace = xrRenderer.xr.getReferenceSpace();
    const pose = event.frame.getPose(inputSource.targetRaySpace, referenceSpace);
    
    if (!pose) return;

    // Встановлюємо промінь відносного положення пристрою у просторі кімнати
    workingVector.set(0, 0, 0).applyMatrix4(pose.transform.matrix);
    const origin = new THREE.Vector3().setFromMatrixPosition(pose.transform.matrix);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(pose.transform.matrix);

    raycaster.set(origin, direction);
    const intersects = raycaster.intersectObjects(xrScene.children);
    const clickedSphere = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

    if (clickedSphere) {
        const pId = clickedSphere.object.userData.id;
        const pName = clickedSphere.object.userData.name;
        
        if (isAddMode) {
            if (!selectedForConnection) {
                selectedForConnection = people.find(p => p.id === pId);
                showToast(`AR Вибір: ${pName}. Натисніть на іншу сферу.`);
                clickedSphere.object.material.color.setHex(0xffffff); // Підсвічуємо білим
            } else {
                if (selectedForConnection.id !== pId) {
                    const added = addEdge(selectedForConnection.id, pId);
                    if (added) {
                        showToast(`Зв'язок створено в AR!`);
                    } else {
                        removeEdge(selectedForConnection.id, pId);
                        showToast(`Зв'язок розірвано в AR.`);
                    }
                    buildARWorldElements(); // Динамічно оновлюємо 3D світ в AR
                    updateGraphElements();  // Синхронізуємо зі звичайним плоским 2D графом
                }
                selectedForConnection = null;
            }
        } else {
            const person = people.find(p => p.id === pId);
            clickedSphere.object.material.color.setHex(0x8e2de2);
            showToast(`Профіль: ${person.name} | Теги: ${person.interests.join(', ')}`);
            setTimeout(() => {
                if(clickedSphere.object && clickedSphere.object.material) {
                    clickedSphere.object.material.color.setHex(0xff7eb3);
                }
            }, 2500);
        }
    }
}

// Загальний рендер-цикл WebXR камери
function renderARFrame(timestamp, frame) {
    if (frame) {
        // Контролюємо мікропульсації елементів
        xrScene.children.forEach(child => {
            if (child.geometry && child.geometry.type === "SphereGeometry") {
                child.rotation.y += 0.01;
            }
        });
        xrRenderer.render(xrScene, xrCamera);
    }
}

// Глобальний міст, щоб виклики функцій з UI синхронізували тривимірну сцену
window.refreshAR = function() {
    if (xrSession) buildARWorldElements();
};
