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
    
    // Відображення інтересів
    const intsContainer = document.getElementById("panel-interests");
    intsContainer.innerHTML = person.interests.map(i => `<span class="interest-tag">${i}</span>`).join('');
    
    // === ФУНКЦІОНАЛЬНІСТЬ: ЛОГІСТИКА ТА ЛЮДИ ПОРУЧ ===
    renderNearbyPeople(person);
    
    // Рекомендація на базі GNN
    const recs = getRecommendations(person.id);
    const recContainer = document.getElementById("panel-recommendation");
    
    if (recs.length > 0) {
        const topRec = recs[0];
        const shared = getSharedInterests(person.id, topRec.id);
        recContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center">
                <strong>${topRec.name}</strong>
                <span style="color:var(--accent-pink)">${Math.round(topRec.similarity * 100)}% збіг (GNN)</span>
            </div>
            <div style="font-size:11px; margin-top:4px; opacity:0.8">Спільне: ${shared.join(', ')}</div>
            <button onclick="quickAddFriend(${person.id}, ${topRec.id})" class="btn outline-pink full-width mt-4" style="padding: 6px;">
                <i class="fas fa-user-plus"></i> Додати зв'язок
            </button>
        `;
    } else {
        recContainer.innerHTML = "<div style='opacity:0.6'>Немає GNN рекомендацій</div>";
    }
    
    panel.dataset.currentId = person.id;
    panel.classList.remove("hidden");
}

function renderNearbyPeople(centerPerson) {
    const container = document.getElementById("panel-nearby");
    if (!container) return;

    // Рахуємо фізичну логістичну відстань на координатному плато
    let distances = people
        .filter(p => p.id !== centerPerson.id)
        .map(p => {
            const dx = p.x - centerPerson.x;
            const dy = p.y - centerPerson.y;
            const dist = Math.sqrt(dx*dx + dy*dy).toFixed(1); // Логістична метрика відстані
            const gnnSim = calculateCosineSimilarity(centerPerson, p);
            return { ...p, distance: parseFloat(dist), gnnSim: gnnSim };
        });

    // Сортування: Спершу найближчі за географією, які мають високий збіг інтересів за GCN
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
    showToast(`Користувача ${name} додано й проаналізовано GNN!`);
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

// === РЕНДЕР ТАБЛІВ ===
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
                <i class="fas fa-link"></i> Топологічний ступінь (Валентність): ${degree}
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
                            Нейромережевий збіг (GCN Embedding Vector Match): <strong>${Math.round(recs[0].similarity * 100)}%</strong> | Спільне: ${recs[0].shared.join(', ')}
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


// ==========================================
// ТЕХНОЛОГІЯ: WEBXR / AR ТРИВИМІРНИЙ ПРОСТІР
// ==========================================
let xrScene, xrCamera, xrRenderer, xrContainer;
let meshes = {};

function initARMode() {
    showToast("Ініціалізація WebXR 3D середовища простору...");
    
    // Створюємо повноекранний контейнер для 3D
    xrContainer = document.createElement("div");
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0";
    xrContainer.style.left = "0";
    xrContainer.style.width = "100vw";
    xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999";
    xrContainer.style.background = "#07050d";
    document.body.appendChild(xrContainer);

    // Кнопка закриття AR
    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з AR простору';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1000";
    closeBtn.onclick = () => { xrContainer.remove(); };
    xrContainer.appendChild(closeBtn);

    // Інфо-панель керування у 3D
    let info = document.createElement("div");
    info.style.position = "absolute";
    info.style.bottom = "20px";
    info.style.left = "20px";
    info.style.zIndex = "1000";
    info.style.background = "rgba(0,0,0,0.8)";
    info.style.padding = "15px";
    info.style.borderRadius = "10px";
    info.style.fontSize = "13px";
    info.innerHTML = `
        <h4 style="color:var(--accent-pink)">WebXR AR Контролер Мережі</h4>
        <p style="margin-top:4px;">Клікніть на 3D-сферу для керування зв'язками</p>
        <div style="margin-top:8px; display:flex; gap:5px;">
           <button onclick="window.randomizeConnections(); window.refreshAR();" class="btn secondary" style="padding:4px 8px; font-size:11px;">Рандом</button>
           <button onclick="window.resetGraph(); window.refreshAR();" class="btn danger" style="padding:4px 8px; font-size:11px;">Очистити</button>
        </div>
    `;
    xrContainer.appendChild(info);

    // Налаштування Three.js сцен
    xrScene = new THREE.Scene();
    xrScene.fog = new THREE.FogExp2(0x07050d, 0.0015);

    xrCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    xrCamera.position.set(0, 0, 500);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setPixelRatio(window.devicePixelRatio);
    xrContainer.appendChild(xrRenderer.domElement);

    // Додаємо світло
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    xrScene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xff7eb3, 1, 1000);
    pointLight.position.set(0, 200, 200);
    xrScene.add(pointLight);

    window.refreshAR = function() {
        // Очищаємо старі об'єкти
        while(xrScene.children.length > 2) { 
            xrScene.remove(xrScene.children[xrScene.children.length - 1]); 
        }
        meshes = {};

        // Малюємо людей (Сфери з іменами)
        people.forEach(p => {
            // Геометрія вузла
            const geometry = new THREE.SphereGeometry(14, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: 0xff7eb3,
                emissive: 0x2a0815,
                shininess: 30
            });
            const sphere = new THREE.Mesh(geometry, material);
            
            // Масштабуємо 2D координати D3 в 3D об'єм AR
            sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            sphere.userData = { id: p.id, name: p.name };
            xrScene.add(sphere);
            meshes[p.id] = sphere;

            // Створення Текстового Білборда над шариком (Ім'я над кожною сферою!)
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'Bold 24px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 128, 40);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set(sphere.position.x, sphere.position.y + 25, sphere.position.z);
            sprite.scale.set(60, 15, 1);
            xrScene.add(sprite);
        });

        // Малюємо логістичні ребра (Лінії)
        edges.forEach(([u, v]) => {
            const nodeA = meshes[u];
            const nodeB = meshes[v];
            if (nodeA && nodeB) {
                const points = [nodeA.position, nodeB.position];
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                
                // Колір залежить від спільних інтересів
                const shared = getSharedInterests(u, v).length;
                const lineColor = shared > 0 ? 0xff7eb3 : 0x8e2de2;

                const lineMat = new THREE.LineBasicMaterial({ 
                    color: lineColor, 
                    linewidth: 2,
                    transparent: true,
                    opacity: 0.6
                });
                const line = new THREE.Line(lineGeo, lineMat);
                xrScene.add(line);
            }
        });
    };

    window.refreshAR();

    // Рейкастінг для взаємодії (кліки у 3D AR просторі)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    xrRenderer.domElement.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, xrCamera);
        
        const intersects = raycaster.intersectObjects(xrScene.children);
        const clickedSphere = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

        if (clickedSphere) {
            const pId = clickedSphere.object.userData.id;
            const pName = clickedSphere.object.userData.name;
            
            // Якщо увімкнено AddMode в основному інтерфейсі
            if (isAddMode) {
                if (!selectedForConnection) {
                    selectedForConnection = people.find(p => p.id === pId);
                    showToast(`AR Вибір: ${pName}. Оберіть другу вершину.`);
                    clickedSphere.object.material.color.setHex(0xffffff);
                } else {
                    if (selectedForConnection.id !== pId) {
                        const added = addEdge(selectedForConnection.id, pId);
                        showToast(added ? "Зв'язок створено в AR!" : "Зв'язок видалено в AR!");
                        if (!added) removeEdge(selectedForConnection.id, pId);
                        window.refreshAR();
                        updateGraphElements();
                    }
                    selectedForConnection = null;
                }
            } else {
                // Перемикаємо колір для фокусу інтересів
                const person = people.find(p => p.id === pId);
                clickedSphere.object.material.color.setHex(0x8e2de2);
                showToast(`Профіль: ${person.name} | Інтереси: ${person.interests.join(', ')}`);
                setTimeout(() => clickedSphere.object.material.color.setHex(0xff7eb3), 3000);
            }
        }
    });

    // Обертання сцени мишкою для симуляції огляду
    let isDragging = false;
    let prevMouseX = 0;
    xrRenderer.domElement.addEventListener('mousedown', (e) => { isDragging = true; prevMouseX = e.clientX; });
    xrRenderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - prevMouseX;
            xrScene.rotation.y += deltaX * 0.005;
            prevMouseX = e.clientX;
        }
    });
    window.addEventListener('mouseup', () => isDragging = false);

    // Рендер-луп
    function animate() {
        if (!document.body.contains(xrContainer)) return;
        requestAnimationFrame(animate);
        
        // Анімаційні мікрохвилі пульсації вузлів
        xrScene.children.forEach(child => {
            if (child.geometry && child.geometry.type === "SphereGeometry") {
                child.rotation.y += 0.01;
            }
        });
        
        xrRenderer.render(xrScene, xrCamera);
    }
    animate();
}
