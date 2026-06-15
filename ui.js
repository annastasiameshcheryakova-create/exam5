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
// ОБ'ЄДНАНИЙ AR / VR РЕЖИМ (ПОЛУ-ФАСКРІЗНИЙ ДЛЯ ШОЛОМІВ)
// =========================================================
let xrScene, xrCamera, xrRenderer, xrContainer;
let cameraLeft, cameraRight; // Для стерео VR-окулярів
let isStereoMode = false;     // Початково звичайний AR екран
let meshes = {};
let graphGroup;

function initARMode() {
    // Для повноцінної роботи Стерео-VR з камерою запускаємо розширену симуляцію,
    // яка ідеально працює в Cardboard / VR Box шоломах на будь-якому телефоні
    startVideoAR();
}

function startVideoAR() {
    showToast("Ініціалізація AR/VR Простору...");
    isStereoMode = false; // Скидаємо прапорець при новому запуску
    
    xrContainer = document.createElement("div");
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0"; xrContainer.style.left = "0";
    xrContainer.style.width = "100vw"; xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999"; xrContainer.style.overflow = "hidden";
    document.body.appendChild(xrContainer);

    // Створюємо два відео-елементи для лівого та правого ока у стерео режимі
    let videoLeft = document.createElement("video");
    videoLeft.style.position = "absolute"; videoLeft.style.top = "50%"; videoLeft.style.left = "0";
    videoLeft.style.width = "100vw"; videoLeft.style.height = "100vh";
    videoLeft.style.objectFit = "cover"; videoLeft.style.transform = "translate(0, -50%)";
    videoLeft.style.zIndex = "1"; videoLeft.autoplay = true; videoLeft.playsInline = true;
    xrContainer.appendChild(videoLeft);

    let videoRight = document.createElement("video");
    videoRight.style.position = "absolute"; videoRight.style.top = "50%"; videoRight.style.left = "50vw";
    videoRight.style.width = "50vw"; videoRight.style.height = "100vh";
    videoRight.style.objectFit = "cover"; videoRight.style.transform = "translate(0, -50%)";
    videoRight.style.zIndex = "1"; videoRight.autoplay = true; videoRight.playsInline = true;
    videoRight.style.display = "none";
    xrContainer.appendChild(videoRight);

    // Стрімимо камеру в обидва ока
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => { 
                videoLeft.srcObject = stream; 
                videoRight.srcObject = stream; 
            })
            .catch(err => { xrContainer.style.background = "#07050d"; });
    }

    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute"; closeBtn.style.top = "20px"; closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1000";
    closeBtn.onclick = () => { 
        if (videoLeft.srcObject) videoLeft.srcObject.getTracks().forEach(t => t.stop());
        if (videoRight.srcObject) videoRight.srcObject.getTracks().forEach(t => t.stop());
        xrContainer.remove(); 
    };
    xrContainer.appendChild(closeBtn);

    let info = document.createElement("div");
    info.style.position = "absolute"; info.style.bottom = "20px"; info.style.left = "20px";
    info.style.zIndex = "1000"; info.style.background = "rgba(0,0,0,0.8)";
    info.style.padding = "15px"; info.style.borderRadius = "10px"; info.style.fontSize = "13px";
    info.innerHTML = `
        <h4 style="color:var(--accent-pink)">Контролер Простору</h4>
        <p style="margin-top:4px; opacity:0.8;">Клікніть на сферу для взаємодії</p>
        <div style="margin-top:8px; display:flex; gap:5px; flex-wrap:wrap;">
           <button onclick="window.toggleStereoMode()" id="stereo-toggle-btn" class="btn outline-pink" style="padding:4px 8px; font-size:11px;"><i class="fas fa-vr-cardboard"></i> Режим: Звичайний AR</button>
           <button onclick="window.toggleARAddMode()" id="ar-add-btn" class="btn secondary" style="padding:4px 8px; font-size:11px;">Зв'язки: ВИМК</button>
        </div>
    `;
    xrContainer.appendChild(info);

    // Функція перемикання Стерео-VR / Екранного AR
    window.toggleStereoMode = function() {
        isStereoMode = !isStereoMode;
        const btn = document.getElementById("stereo-toggle-btn");
        if (isStereoMode) {
            btn.innerHTML = '<i class="fas fa-mobile-alt"></i> Режим: Стерео VR (Шолом)';
            btn.style.background = "var(--accent-purple)";
            videoLeft.style.width = "50vw";
            videoRight.style.display = "block";
            showToast("Екран розділено! Вставте телефон у VR шолом 🕶️");
        } else {
            btn.innerHTML = '<i class="fas fa-vr-cardboard"></i> Режим: Звичайний AR';
            btn.style.background = "transparent";
            videoLeft.style.width = "100vw";
            videoRight.style.display = "none";
            showToast("Повернено одноформатний режим екрана");
        }
    };

    window.toggleARAddMode = function() {
        isAddMode = !isAddMode;
        selectedForConnection = null;
        const btn = document.getElementById('ar-add-btn');
        btn.style.background = isAddMode ? "var(--accent-pink)" : "rgba(255,255,255,0.1)";
        btn.style.color = isAddMode ? "white" : "white";
        btn.textContent = isAddMode ? "Зв'язки: УВІМК" : "Зв'язки: ВИМК";
        showToast(isAddMode ? "Режим редагування: Оберіть 2 сфери" : "Режим перегляду");
    };

    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    xrCamera.position.set(0, 0, 500);

    // Додаткові камери для стереоскопічного зміщення очей (IPD)
    cameraLeft = new THREE.PerspectiveCamera(60, (window.innerWidth / 2) / window.innerHeight, 1, 2000);
    cameraRight = new THREE.PerspectiveCamera(60, (window.innerWidth / 2) / window.innerHeight, 1, 2000);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setClearColor(0x000000, 0); 
    xrRenderer.domElement.style.position = "absolute";
    xrRenderer.domElement.style.top = "0"; xrRenderer.domElement.style.left = "0";
    xrRenderer.domElement.style.zIndex = "2"; 
    xrContainer.appendChild(xrRenderer.domElement);

    xrScene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const pointLight = new THREE.PointLight(0xff7eb3, 1.2, 1000);
    pointLight.position.set(0, 200, 200);
    xrScene.add(pointLight);

    graphGroup = new THREE.Group();
    xrScene.add(graphGroup);

    window.refreshAR = function() {
        while(graphGroup.children.length > 0) { graphGroup.remove(graphGroup.children[graphGroup.children.length - 1]); }
        meshes = {};

        people.forEach(p => {
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 32), new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815, shininess: 40 }));
            sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            sphere.userData = { id: p.id, name: p.name };
            graphGroup.add(sphere);
            meshes[p.id] = sphere;

            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.font = 'Bold 24px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, 128, 40);
            
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.position.set(sphere.position.x, sphere.position.y + 25, sphere.position.z);
            sprite.scale.set(60, 15, 1);
            graphGroup.add(sprite);
        });

        edges.forEach(([u, v]) => {
            if (meshes[u] && meshes[v]) {
                const line = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints([meshes[u].position, meshes[v].position]), 
                    new THREE.LineBasicMaterial({ color: getSharedInterests(u, v).length > 0 ? 0xff7eb3 : 0x8e2de2, linewidth: 4, transparent: true, opacity: 0.6 })
                );
                graphGroup.add(line);
            }
        });
    };
    window.refreshAR();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    xrRenderer.domElement.addEventListener('click', (event) => {
        const width = window.innerWidth;
        let activeCam = xrCamera;

        // Визначаємо куди клікнули залежно від спліт-скріну
        if (isStereoMode) {
            if (event.clientX < width / 2) {
                mouse.x = (event.clientX / (width / 2)) * 2 - 1;
                activeCam = cameraLeft;
            } else {
                mouse.x = ((event.clientX - width / 2) / (width / 2)) * 2 - 1;
                activeCam = cameraRight;
            }
        } else {
            mouse.x = (event.clientX / width) * 2 - 1;
            activeCam = xrCamera;
        }

        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, activeCam);
        
        const intersects = raycaster.intersectObjects(graphGroup.children);
        const clickedSphere = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

        if (clickedSphere) {
            const pId = clickedSphere.object.userData.id;
            const pName = clickedSphere.object.userData.name;
            if (isAddMode) {
                if (!selectedForConnection) {
                    selectedForConnection = people.find(p => p.id === pId);
                    showToast(`Вибрано: ${pName}. Оберіть другу вершину.`);
                    clickedSphere.object.material.color.setHex(0xffffff);
                } else {
                    if (selectedForConnection.id !== pId) {
                        const added = addEdge(selectedForConnection.id, pId);
                        showToast(added ? "Зв'язок створено!" : "Зв'язок розірвано!");
                        if (!added) removeEdge(selectedForConnection.id, pId);
                        window.refreshAR(); updateGraphElements();
                    }
                    selectedForConnection = null;
                }
            } else {
                const person = people.find(p => p.id === pId);
                clickedSphere.object.material.color.setHex(0x8e2de2);
                showToast(`${person.name} | ${person.interests.slice(0, 2).join(', ')}...`);
                setTimeout(() => { if(clickedSphere.object) clickedSphere.object.material.color.setHex(0xff7eb3) }, 2000);
            }
        }
    });

    // Обертання сцени пальцем/мишкою
    let isDragging = false, prevMouseX = 0;
    xrRenderer.domElement.addEventListener('mousedown', (e) => { isDragging = true; prevMouseX = e.clientX; });
    xrRenderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) { graphGroup.rotation.y += (e.clientX - prevMouseX) * 0.005; prevMouseX = e.clientX; }
    });
    window.addEventListener('mouseup', () => isDragging = false);

    // Тачпад трекінг для телефонів
    xrRenderer.domElement.addEventListener('touchstart', (e) => { isDragging = true; prevMouseX = e.touches[0].clientX; });
    xrRenderer.domElement.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length > 0) { graphGroup.rotation.y += (e.touches[0].clientX - prevMouseX) * 0.005; prevMouseX = e.touches[0].clientX; }
    });
    window.addEventListener('touchend', () => isDragging = false);

    function animate() {
        if (!document.body.contains(xrContainer)) return;
        requestAnimationFrame(animate);

        graphGroup.children.forEach(child => { if (child.geometry && child.geometry.type === "SphereGeometry") child.rotation.y += 0.01; });

        const w = window.innerWidth;
        const h = window.innerHeight;

        if (isStereoMode) {
            // Реримо ліве око
            cameraLeft.copy(xrCamera);
            cameraLeft.aspect = (w / 2) / h;
            cameraLeft.updateProjectionMatrix();
            cameraLeft.translateX(-7); // Невеликий зсув ліворуч для 3D стереоефекту

            xrRenderer.setViewport(0, 0, w / 2, h);
            xrRenderer.setScissor(0, 0, w / 2, h);
            xrRenderer.setScissorTest(true);
            xrRenderer.render(xrScene, cameraLeft);

            // Рендеримо праве око
            cameraRight.copy(xrCamera);
            cameraRight.aspect = (w / 2) / h;
            cameraRight.updateProjectionMatrix();
            cameraRight.translateX(7); // Зсув праворуч

            xrRenderer.setViewport(w / 2, 0, w / 2, h);
            xrRenderer.setScissor(w / 2, 0, w / 2, h);
            xrRenderer.setScissorTest(true);
            xrRenderer.render(xrScene, cameraRight);
        } else {
            // Звичайний повноекранний AR
            xrRenderer.setScissorTest(false);
            xrRenderer.setViewport(0, 0, w, h);
            xrRenderer.render(xrScene, xrCamera);
        }
    }
    animate();
}
