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
        if (is3DActive) toggle3DMode();
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
            <span style="color:var(--text-muted)">${p.distance}м (${Math.round(p.gnnSim*100)}% GNN)</span>
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
    if (is3DActive) build3DGraph();
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
    if (is3DActive) build3DGraph();
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
        let b = Math.floor(Math.random() * randomConnections);
        if (a !== b) addEdge(a, b);
    }
    updateGraphElements();
    if (is3DActive) build3DGraph();
    showToast("Топологію перегенеровано.");
}

function resetGraph() {
    edges = [];
    updateGraphElements();
    if (is3DActive) build3DGraph();
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
                <i class="fas fa-link"></i> Ступінь зв'язків: ${degree}
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
                            Схожість: <strong>${Math.round(recs[0].similarity * 100)}%</strong> | Спільне: ${recs[0].shared.join(', ')}
                        </div>
                    </div>
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
    container.innerHTML = Object.entries(counts).map(([int, count]) => `
        <div class="interest-tag" style="font-size:14px; padding:8px 16px;">
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
// ЛОКАЛЬНИЙ 3D РЕЖИМ (ВКЛАДКА)
// =========================================================
let scene3D, camera3D, renderer3D, controls3D;
let is3DActive = false;
let meshes3D = {};
let graphGroup3D;

function toggle3DMode() {
    const svgEl = document.getElementById("graph-svg");
    const container3D = document.getElementById("graph-3d-container");
    const btn = document.getElementById("toggle-3d-btn");

    is3DActive = !is3DActive;
    if (is3DActive) {
        svgEl.classList.add("hidden");
        container3D.classList.remove("hidden");
        btn.innerHTML = '<i class="fas fa-project-diagram"></i> 2D Режим';
        init3DScene();
    } else {
        svgEl.classList.remove("hidden");
        container3D.classList.add("hidden");
        btn.innerHTML = '<i class="fas fa-cubes"></i> 3D Режим';
        if (renderer3D) { renderer3D.dispose(); container3D.innerHTML = ""; }
    }
}

function init3DScene() {
    const container = document.getElementById("graph-3d-container");
    scene3D = new THREE.Scene();
    camera3D = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 2000);
    camera3D.position.set(0, 0, 500);

    renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer3D.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer3D.domElement);

    controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
    controls3D.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene3D.add(ambientLight);

    graphGroup3D = new THREE.Group();
    scene3D.add(graphGroup3D);
    build3DGraph();

    function animate() {
        if (!is3DActive) return;
        requestAnimationFrame(animate);
        graphGroup3D.rotation.y += 0.002;
        controls3D.update();
        renderer3D.render(scene3D, camera3D);
    }
    animate();
}

function build3DGraph() {
    if (!graphGroup3D) return;
    while(graphGroup3D.children.length > 0) { graphGroup3D.remove(graphGroup3D.children[0]); }
    meshes3D = {};

    people.forEach(p => {
        const geometry = new THREE.SphereGeometry(12, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff7eb3 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
        graphGroup3D.add(sphere);
        meshes3D[p.id] = sphere;
    });

    edges.forEach(([u, v]) => {
        const nodeA = meshes3D[u];
        const nodeB = meshes3D[v];
        if (nodeA && nodeB) {
            const points = [nodeA.position, nodeB.position];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x8e2de2, transparent: true, opacity: 0.5 });
            const line = new THREE.Line(lineGeo, lineMat);
            graphGroup3D.add(line);
        }
    });
}

// =========================================================
// ЗОНА ОПЕРАЦІЙ WEBXR (ДОПОВНЕНА РЕАЛЬНІСТЬ)
// =========================================================
let xrSession = null;
let xrRenderer = null;
let xrScene = null;

async function startXRSession() {
    if (!navigator.xr) {
        showToast("Ваш браузер або пристрій не підтримує WebXR API.");
        return;
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
        showToast("Режим AR (Доповненої реальності) не підтримується.");
        return;
    }

    try {
        const overlay = document.getElementById("xr-overlay");
        
        xrSession = await navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: overlay }
        });

        overlay.classList.remove("hidden");
        showToast("Сесія WebXR AR успішно запущена!");

        xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        xrRenderer.xr.enabled = true;
        xrRenderer.setPixelRatio(window.devicePixelRatio);
        xrRenderer.setSize(window.innerWidth, window.innerHeight);
        await xrRenderer.xr.setSession(xrSession);

        xrScene = new THREE.Scene();
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        xrScene.add(ambientLight);

        // Будуємо тривимірну модель графа спеціально для AR сцени (масштабуємо у метри)
        const xrGraphGroup = new THREE.Group();
        xrGraphGroup.position.set(0, 0, -1.5); // Ставимо граф на 1.5 метри перед користувачем
        xrGraphGroup.scale.set(0.002, 0.002, 0.002); // Зменшуємо d3-координати в матрицю метрів
        xrScene.add(xrGraphGroup);

        let xrMeshes = {};
        people.forEach(p => {
            const geo = new THREE.SphereGeometry(15, 16, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff7eb3 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            xrGraphGroup.add(mesh);
            xrMeshes[p.id] = mesh;
        });

        edges.forEach(([u, v]) => {
            const mA = xrMeshes[u];
            const mB = xrMeshes[v];
            if (mA && mB) {
                const points = [mA.position, mB.position];
                const lGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lMat = new THREE.LineBasicMaterial({ color: 0x00f3ff });
                xrGraphGroup.add(new THREE.Line(lGeo, lMat));
            }
        });

        // Головний рендер-цикл WebXR сесії
        xrRenderer.setAnimationLoop((time, frame) => {
            xrGraphGroup.rotation.y += 0.005; // Обертаємо граф у повітрі
            xrRenderer.render(xrScene, xrRenderer.xr.getCamera());
        });

        // Навішуємо подію на кнопку виходу
        document.getElementById("exit-xr-btn").onclick = () => {
            xrSession.end();
        };

        xrSession.addEventListener('end', () => {
            xrRenderer.setAnimationLoop(null);
            overlay.classList.add("hidden");
            xrSession = null;
            xrRenderer = null;
            showToast("WebXR AR сесію завершено.");
        });

    } catch (err) {
        console.error("Помилка WebXR ініціалізації: ", err);
        showToast("Помилка при запуску WebXR.");
    }
}
