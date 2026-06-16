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

<script>
// ... (existing code above stays the same) ...

// =========================================================
// 3D ВІЗУАЛІЗАЦІЯ + AR
// =========================================================

let xrContainer, xrScene, xrCamera, xrRenderer;
let meshes = {};
let graphGroup;
let controls; // OrbitControls for 3D mode

function start3DVisualization() {
    showToast("Запуск 3D візуалізації...");
    init3DScene(false); // false = 3D mode (no real AR)
}

function startRealAR() {
    showToast("Запуск AR режиму...");
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar').then(supported => {
            if (supported) {
                init3DScene(true); // true = real WebXR AR
            } else {
                showToast("WebXR AR не підтримується. Запускаю 3D з камерою.");
                init3DScene(false);
            }
        });
    } else {
        showToast("WebXR не підтримується. Запускаю 3D.");
        init3DScene(false);
    }
}

function init3DScene(isAR) {
    xrContainer = document.createElement("div");
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0";
    xrContainer.style.left = "0";
    xrContainer.style.width = "100vw";
    xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999";
    xrContainer.style.overflow = "hidden";
    document.body.appendChild(xrContainer);

    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    xrCamera.position.set(0, 100, 600);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: isAR });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    xrRenderer.domElement.style.position = "absolute";
    xrRenderer.domElement.style.top = "0";
    xrRenderer.domElement.style.left = "0";
    xrContainer.appendChild(xrRenderer.domElement);

    // Lights
    xrScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const pointLight = new THREE.PointLight(0xff7eb3, 1.5, 2000);
    pointLight.position.set(300, 400, 300);
    xrScene.add(pointLight);

    // Background for 3D mode
    if (!isAR) {
        let videoBg = document.createElement("video");
        videoBg.style.position = "absolute";
        videoBg.style.top = "50%";
        videoBg.style.left = "50%";
        videoBg.style.width = "100%";
        videoBg.style.height = "100%";
        videoBg.style.objectFit = "cover";
        videoBg.style.transform = "translate(-50%, -50%)";
        videoBg.style.zIndex = "1";
        videoBg.autoplay = true;
        videoBg.playsInline = true;
        xrContainer.appendChild(videoBg);

        if (navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                .then(stream => videoBg.srcObject = stream)
                .catch(() => xrContainer.style.background = "#0a0812");
        } else {
            xrContainer.style.background = "#0a0812";
        }
    }

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1000";
    closeBtn.onclick = () => exit3DScene();
    xrContainer.appendChild(closeBtn);

    // Info panel
    const info = document.createElement("div");
    info.style.position = "absolute";
    info.style.bottom = "20px";
    info.style.left = "20px";
    info.style.background = "rgba(0,0,0,0.75)";
    info.style.padding = "12px 16px";
    info.style.borderRadius = "10px";
    info.style.zIndex = "1000";
    info.style.fontSize = "13px";
    info.innerHTML = isAR 
        ? `<strong style="color:var(--accent-pink)">WebXR AR</strong><br>Тапніть по сфері для взаємодії` 
        : `<strong style="color:var(--accent-pink)">3D Візуалізація</strong><br>ЛКМ — обертання • Колесо — масштаб • ПКМ — панорамування`;
    xrContainer.appendChild(info);

    // Build graph in Three.js
    refreshThreeJSGraph();

    // Controls
    if (!isAR) {
        controls = new THREE.OrbitControls(xrCamera, xrRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = true;
        controls.minDistance = 100;
        controls.maxDistance = 1500;
    }

    // Animation loop
    function animate() {
        if (!document.body.contains(xrContainer)) return;

        if (controls) controls.update();

        // Gentle rotation on spheres
        Object.values(meshes).forEach(mesh => {
            if (mesh) mesh.rotation.y += 0.008;
        });

        xrRenderer.render(xrScene, xrCamera);
        requestAnimationFrame(animate);
    }
    animate();

    // Click / Select handling
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
        if (isAR) return; // WebXR uses controller

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, xrCamera);

        const intersects = raycaster.intersectObjects(xrScene.children, true);
        const sphere = intersects.find(i => i.object.userData?.id !== undefined);

        if (sphere) handleNodeInteraction(sphere.object.userData.id);
    };

    xrRenderer.domElement.addEventListener('click', onClick);
}

function refreshThreeJSGraph() {
    // Clear old objects
    while (xrScene.children.length > 2) xrScene.remove(xrScene.children[xrScene.children.length - 1]);
    meshes = {};

    people.forEach(p => {
        // Sphere
        const geometry = new THREE.SphereGeometry(22, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff7eb3,
            emissive: 0x2a0815,
            shininess: 50
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
        sphere.userData = { id: p.id, name: p.name };
        xrScene.add(sphere);
        meshes[p.id] = sphere;

        // Name label
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.split(' ')[0], 128, 42);

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(canvas)
        }));
        sprite.position.set(sphere.position.x, sphere.position.y + 45, sphere.position.z);
        sprite.scale.set(90, 22, 1);
        xrScene.add(sprite);
    });

    // Edges
    edges.forEach(([u, v]) => {
        if (meshes[u] && meshes[v]) {
            const points = [meshes[u].position, meshes[v].position];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const shared = getSharedInterests(u, v).length;
            const lineMat = new THREE.LineBasicMaterial({
                color: shared > 0 ? 0xff7eb3 : 0x8e2de2,
                linewidth: 5,
                transparent: true,
                opacity: 0.5 + shared * 0.12
            });
            const line = new THREE.Line(lineGeo, lineMat);
            xrScene.add(line);
        }
    });
}

function handleNodeInteraction(id) {
    const person = people.find(p => p.id === id);
    if (!person) return;

    if (isAddMode) {
        if (!selectedForConnection) {
            selectedForConnection = person;
            showToast(`Вибрано: ${person.name}`);
        } else if (selectedForConnection.id !== id) {
            const added = addEdge(selectedForConnection.id, id);
            showToast(added ? "Зв'язок створено!" : "Зв'язок видалено");
            if (!added) removeEdge(selectedForConnection.id, id);
            refreshThreeJSGraph();
            updateGraphElements();
            selectedForConnection = null;
        }
    } else {
        openNodePanel(person);
        setTimeout(() => exit3DScene(), 800);
    }
}

function exit3DScene() {
    if (xrRenderer) xrRenderer.dispose();
    if (xrContainer && xrContainer.parentNode) xrContainer.parentNode.removeChild(xrContainer);
    meshes = {};
    controls = null;
}

// Make functions global for HTML buttons
window.start3DVisualization = start3DVisualization;
window.startRealAR = startRealAR;
</script>
