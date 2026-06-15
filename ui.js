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
        showToast("Режим зв'язків: Клікайте послідовно на двох людей.");
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
                <span style="color:var(--accent-pink)">${Math.round(topRec.similarity * 100)}% GNN</span>
            </div>
            <div style="font-size:11px; margin-top:4px; opacity:0.8">Спільні інтереси: <strong style="color:var(--accent-pink)">${shared.join(', ')}</strong></div>
            <button onclick="quickAddFriend(${person.id}, ${topRec.id})" class="btn outline-pink full-width mt-4" style="padding: 6px;">
                <i class="fas fa-user-plus"></i> Додати друга
            </button>
        `;
    } else {
        recContainer.innerHTML = "<div style='opacity:0.6'>Немає людей зі спільними інтересами</div>";
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
            const shared = getSharedInterests(centerPerson.id, p.id).length;
            return { ...p, distance: parseFloat(dist), sharedCount: shared };
        });

    distances.sort((a, b) => b.sharedCount - a.sharedCount || a.distance - b.distance);

    container.innerHTML = distances.slice(0, 3).map(p => `
        <div class="nearby-item" style="display:flex; justify-content:space-between; margin-top:6px; font-size:12px; background:rgba(255,255,255,0.05); padding:6px; border-radius:6px;">
            <span>🤝 <strong>${p.name}</strong> (${p.sharedCount} спільних)</span>
            <span style="color:var(--text-muted)">відстань: ${p.distance}м</span>
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
    if (!name) { showToast("Введіть ім'я користувача!"); return; }

    const checkedBoxes = document.querySelectorAll("#interests-selector input:checked");
    const selectedInts = Array.from(checkedBoxes).map(cb => cb.value);

    if (selectedInts.length === 0) { showToast("Оберіть хоча б один інтерес!"); return; }

    const added = addCustomPerson(name, selectedInts);
    updateGraphElements();
    nameInput.value = "";
    document.querySelectorAll("#interests-selector input:checked").forEach(cb => cb.checked = false);
    
    switchTab(0);
    openNodePanel(added);
    animateSearch(added.id);
    showToast(`Користувача ${name} додано до системи!`);
}

function closeFloatingPanel() {
    document.getElementById("floating-panel").classList.add("hidden");
    resetHighlights();
}

function quickAddFriend(id1, id2) {
    addEdge(id1, id2);
    updateGraphElements();
    showToast("Зв'язок створено!");
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
        showToast(`Хаб знайдено: ${people.find(p => p.id === hubId).name}`);
    }
}

function randomizeConnections() {
    edges = [];
    const count = people.length;
    for (let i = 0; i < 45; i++) {
        let a = Math.floor(Math.random() * count);
        let b = Math.floor(Math.random() * count);
        if (a !== b) addEdge(a, b);
    }
    updateGraphElements();
    showToast("Зв'язки графа випадково змінено.");
}

// Изменено название функции во избежание конфликтов
function resetGraph() {
    edges = [];
    updateGraphElements();
    showToast("Всі зв'язки видалено.");
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
                Кількість друзів: ${degree}
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
                <div class="rec-card" style="margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; background:var(--glass-bg); padding:12px; border-radius:10px; border:1px solid var(--glass-border)">
                    <div>
                        <strong style="color:white; font-size:15px;">${person.name}</strong> 
                        <i class="fas fa-arrow-right" style="color:var(--text-muted); margin:0 10px; font-size:12px;"></i> 
                        <span style="color:var(--accent-pink); font-weight:600;">${recs[0].name}</span>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">
                            Спільні інтереси: <strong style="color:white">${recs[0].shared.join(', ')}</strong> | Валідність структури: ${Math.round(recs[0].similarity * 100)}%
                        </div>
                    </div>
                    <button onclick="quickAddFriend(${person.id}, ${recs[0].id}); switchTab(0)" class="btn outline-pink" style="padding:6px 12px;">
                        <i class="fas fa-plus"></i> Додати друга
                    </button>
                </div>
            `;
        }
    });
    container.innerHTML = html || "<div style='opacity:0.6'>Додайте більше унікальних інтересів для точного розрахунку моделей</div>";
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
// НАСТОЯЩЕЕ WEBXR & CAMERA PASS-THROUGH AR СЕРЕДОВИЩЕ
// ==========================================
let xrScene, xrCamera, xrRenderer, xrContainer;
let meshes = {};

async function initARMode() {
    showToast("Ініціалізація AR/VR камери...");
    
    xrContainer = document.createElement("div");
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0"; xrContainer.style.left = "0";
    xrContainer.style.width = "100vw"; xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "9999";
    document.body.appendChild(xrContainer);

    // Стриминг видео с камеры на задний фон (True AR)
    const videoBg = document.createElement("video");
    videoBg.style.position = "absolute";
    videoBg.style.top = "0"; videoBg.style.left = "0";
    videoBg.style.width = "100%"; videoBg.style.height = "100%";
    videoBg.style.objectFit = "cover";
    videoBg.style.zIndex = "-1";
    videoBg.autoplay = true;
    videoBg.playsInline = true;
    xrContainer.appendChild(videoBg);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoBg.srcObject = stream;
    } catch (err) {
        console.warn("Камера пассру недоступна:", err);
    }

    // Кнопка выхода
    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з AR';
    closeBtn.style.position = "absolute"; closeBtn.style.top = "20px"; closeBtn.style.right = "20px";
    closeBtn.style.padding = "10px 20px"; closeBtn.style.background = "#ff4b4b"; closeBtn.style.color = "white";
    closeBtn.style.border = "none"; closeBtn.style.borderRadius = "8px"; closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => { 
        if (videoBg.srcObject) videoBg.srcObject.getTracks().forEach(t => t.stop());
        xrContainer.remove(); 
    };
    xrContainer.appendChild(closeBtn);

    // Сцена Three.js (прозрачный альфа-канал)
    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    xrCamera.position.set(0, 0, 400);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setPixelRatio(window.devicePixelRatio);

    // Нативная WebXR сессия для VR шлемов/смартфонов
    if (navigator.xr) {
        xrRenderer.xr.enabled = true;
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        if (supported) {
            let xrBtn = document.createElement("button");
            xrBtn.innerHTML = '<i class="fas fa-vr-cardboard"></i> Увійти у VR Режим гарнітури';
            xrBtn.style.position = "absolute"; xrBtn.style.bottom = "20px"; xrBtn.style.right = "20px";
            xrBtn.style.padding = "12px"; xrBtn.style.borderRadius = "8px";
            xrBtn.onclick = () => {
                navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['local-floor'] }).then(s => xrRenderer.xr.setSession(s));
            };
            xrContainer.appendChild(xrBtn);
        }
    }

    xrContainer.appendChild(xrRenderer.domElement);
    xrScene.add(new THREE.AmbientLight(0xffffff, 0.9));

    window.refreshAR = function() {
        while(xrScene.children.length > 1) { 
            xrScene.remove(xrScene.children[xrScene.children.length - 1]); 
        }
        meshes = {};

        // Отрисовка 3D Сфер (Люди)
        people.forEach(p => {
            const geo = new THREE.SphereGeometry(14, 32, 32);
            const mat = new THREE.MeshPhongMaterial({ color: 0xff7eb3, shininess: 50 });
            const sphere = new THREE.Mesh(geo, mat);
            
            sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            sphere.userData = { id: p.id, name: p.name, interests: p.interests };
            xrScene.add(sphere);
            meshes[p.id] = sphere;

            // Текстовые билборды с именами в 3D
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'Bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 128, 40);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set(sphere.position.x, sphere.position.y + 24, sphere.position.z);
            sprite.scale.set(60, 15, 1);
            xrScene.add(sprite);
        });

        // Отрисовка связей графа
        edges.forEach(([u, v]) => {
            const nodeA = meshes[u]; const nodeB = meshes[v];
            if (nodeA && nodeB) {
                const pts = [nodeA.position, nodeB.position];
                const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
                const lineMat = new THREE.LineBasicMaterial({ color: 0x8e2de2, transparent: true, opacity: 0.7 });
                xrScene.add(new THREE.Line(lineGeo, lineMat));
            }
        });
    };

    window.refreshAR();

    // Клики по сферам в AR пространстве
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    xrRenderer.domElement.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, xrCamera);
        
        const intersects = raycaster.intersectObjects(xrScene.children);
        const clicked = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

        if (clicked) {
            const person = clicked.object.userData;
            showToast(`Користувач: ${person.name} | Інтереси: ${person.interests.join(', ')}`);
        }
    });

    xrRenderer.setAnimationLoop(() => {
        xrRenderer.render(xrScene, xrCamera);
    });
}
