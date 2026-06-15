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
// ПОВНОЦІННИЙ РЕЖИМ WEBXR (ДОПОВНЕНА РЕАЛЬНІСТЬ)
// =========================================================
let xrScene, xrCamera, xrRenderer, xrContainer;
let meshes = {};
let graphGroup; // Група для зручного масштабування графа у реальних метрах

async function initARMode() {
    // Перевіряємо підтримку WebXR у браузері
    if ('xr' in navigator) {
        try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            if (supported) {
                startTrueWebXR();
            } else {
                showToast("Пристрій не підтримує AR. Запускаю 3D-симуляцію.");
                start3DFallback();
            }
        } catch (e) {
            showToast("Помилка доступу до WebXR.");
            start3DFallback();
        }
    } else {
        showToast("WebXR не підтримується. Запускаю 3D-симуляцію.");
        start3DFallback();
    }
}

function startTrueWebXR() {
    showToast("Ініціалізація WebXR AR...");

    // 1. Створюємо контейнер для DOM Overlay (HTML елементи поверх AR)
    xrContainer = document.createElement("div");
    xrContainer.id = "xr-overlay";
    xrContainer.style.position = "absolute";
    xrContainer.style.top = "0";
    xrContainer.style.left = "0";
    xrContainer.style.width = "100vw";
    xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999";
    xrContainer.style.pointerEvents = "none"; // Пропускаємо кліки до Three.js
    document.body.appendChild(xrContainer);

    // Панель керування AR
    let info = document.createElement("div");
    info.style.position = "absolute";
    info.style.bottom = "40px";
    info.style.left = "50%";
    info.style.transform = "translateX(-50%)";
    info.style.background = "rgba(10, 8, 18, 0.85)";
    info.style.border = "1px solid var(--accent-pink)";
    info.style.padding = "15px 25px";
    info.style.borderRadius = "12px";
    info.style.pointerEvents = "auto";
    info.style.textAlign = "center";
    info.style.backdropFilter = "blur(10px)";
    info.innerHTML = `
        <h4 style="color:var(--accent-pink); margin-bottom: 10px; font-weight: 600;">AR Режим Графа</h4>
        <p style="font-size: 12px; color: #ccc; margin-bottom: 12px;">Тапай по сферах для взаємодії</p>
        <button id="exit-ar-btn" class="btn danger" style="padding:8px 20px; font-weight: bold;">
            <i class="fas fa-times"></i> Вийти з AR
        </button>
    `;
    xrContainer.appendChild(info);

    // 2. Налаштування Three.js для WebXR
    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    xrRenderer.setPixelRatio(window.devicePixelRatio);
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.xr.enabled = true; // КЛЮЧОВЕ: Вмикаємо WebXR двіжок

    // Освітлення (щоб сфери виглядали об'ємними у реальному світі)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    xrScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xff7eb3, 1.5);
    dirLight.position.set(2, 5, 3);
    xrScene.add(dirLight);

    // 3. Побудова графа у 3D просторі
    graphGroup = new THREE.Group();
    // Розміщуємо граф на 1.2 метра прямо перед камерою смартфона
    graphGroup.position.set(0, 0, -1.2); 
    // Масштабуємо великі піксельні координати (D3) до метрів (WebXR)
    graphGroup.scale.set(0.0015, 0.0015, 0.0015);
    xrScene.add(graphGroup);

    buildARGraph();

    // 4. Взаємодія (Контролер WebXR) - Тап по екрану
    const controller = xrRenderer.xr.getController(0);
    controller.addEventListener('select', onARSelect);
    xrScene.add(controller);

    function onARSelect() {
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        const raycaster = new THREE.Raycaster();
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        
        const intersects = raycaster.intersectObjects(graphGroup.children, true);
        const clicked = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

        if (clicked) {
            const pId = clicked.object.userData.id;
            const person = people.find(p => p.id === pId);
            
            showToast(`Вибрано: ${person.name} | Зв'язків: ${edges.filter(e => e[0] === pId || e[1] === pId).length}`);
            
            // Анімація кліку (спалах)
            const originalEmissive = clicked.object.material.emissive.getHex();
            clicked.object.material.emissive.setHex(0xffffff);
            setTimeout(() => {
                if(clicked.object) clicked.object.material.emissive.setHex(originalEmissive);
            }, 300);
        }
    }

    // 5. Запуск AR Сесії з підтримкою DOM Overlay
    navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: xrContainer }
    }).then((session) => {
        xrRenderer.xr.setSession(session);
        
        document.getElementById('exit-ar-btn').onclick = () => session.end();
        
        session.addEventListener('end', () => {
            xrContainer.remove();
            xrRenderer.dispose();
            xrRenderer.setAnimationLoop(null);
        });

        // Головний цикл рендеру
        xrRenderer.setAnimationLoop((time, frame) => {
            if (frame) {
                // Плавне обертання вершин
                graphGroup.children.forEach(child => {
                    if (child.geometry && child.geometry.type === "SphereGeometry") {
                        child.rotation.y += 0.01;
                    }
                });
            }
            xrRenderer.render(xrScene, xrCamera);
        });
    }).catch(err => {
        console.error("Помилка запуску сесії:", err);
        showToast("Помилка запуску AR сесії. Перевірте дозволи.");
        xrContainer.remove();
    });
}

function buildARGraph() {
    // Очищаємо попередній стан
    while(graphGroup.children.length > 0) { 
        graphGroup.remove(graphGroup.children[graphGroup.children.length - 1]); 
    }
    meshes = {};

    // Знаходимо центр для коректного позиціонування
    const centerX = 400; 
    const centerY = 300;

    // Створюємо вершини
    people.forEach(p => {
        const geometry = new THREE.SphereGeometry(18, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff7eb3, 
            emissive: 0x2a0815, 
            shininess: 60 
        });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Трансформуємо 2D координати в 3D. Додаємо Z для глибини
        sphere.position.set(p.x - centerX, -(p.y - centerY), p.z || (Math.random() * 300 - 150));
        sphere.userData = { id: p.id, name: p.name };
        
        graphGroup.add(sphere);
        meshes[p.id] = sphere;

        // Створюємо текст (імена) над вершинами
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'Bold 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        // Обводка тексту для кращої читабельності на світлому фоні
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(p.name, 128, 45);
        ctx.fillText(p.name, 128, 45);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false }); // depthTest: false щоб текст не перекривався сферами
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(sphere.position.x, sphere.position.y + 35, sphere.position.z);
        sprite.scale.set(100, 25, 1);
        graphGroup.add(sprite);
    });

    // Малюємо зв'язки (ребра)
    edges.forEach(([u, v]) => {
        const nodeA = meshes[u];
        const nodeB = meshes[v];
        if (nodeA && nodeB) {
            const points = [nodeA.position, nodeB.position];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const sharedCount = getSharedInterests(u, v).length;
            
            const lineMat = new THREE.LineBasicMaterial({ 
                color: sharedCount > 0 ? 0xff7eb3 : 0x8e2de2, 
                linewidth: 3, 
                transparent: true,
                opacity: 0.5 + (sharedCount * 0.1) // Що більше спільних інтересів, то яскравіша лінія
            });
            const line = new THREE.Line(lineGeo, lineMat);
            graphGroup.add(line);
        }
    });
}

// Запасний план, якщо телефон/браузер не підтримує справжній AR
function start3DFallback() {
    // Тут залишається логіка OrbitControls або відео-фону,
    // якщо WebXR недоступний (код із попереднього файлу)
    showToast("Запущено режим 3D-перегляду.");
}
