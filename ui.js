```javascript
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
    showToast("Зв'язок успешно додано!");
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

// ====================================================================
// ДОПОВНЕНА РЕАЛЬНІСТЬ (AR) З ВИКОРИСТАННЯМ A-FRAME АБО З 3D СИМУЛЯЦІЇ
// ====================================================================
let graphGroup; 
let meshes = {};
let xrContainer = null;
let xrScene, xrCamera, xrRenderer;

function initARMode() {
    // Перевірка підтримки WebXR для пристроїв AR
    if (navigator.xr && navigator.xr.isSessionSupported) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                showToast("Ініціалізація WebXR через A-Frame...");
                startAFrameAR();
            } else {
                startVideoAR();
            }
        }).catch(() => startVideoAR());
    } else {
        startVideoAR();
    }
}

function startAFrameAR() {
    xrContainer = document.createElement("div");
    xrContainer.id = "xr-overlay";
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0"; xrContainer.style.left = "0";
    xrContainer.style.width = "100vw"; xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999";
    document.body.appendChild(xrContainer);

    xrContainer.innerHTML = `
        <a-scene embedded xr-mode-ui="enabled: true;" raycaster="objects: .clickable">
            <a-sky color="#07050d" material="opacity: 0.4"></a-sky>
            <a-plane position="0 -1.5 0" rotation="-90 0 0" width="30" height="30" color="#110d21" opacity="0.2"></a-plane>
            
            <a-entity id="graph-holder" position="0 0 -1.5" scale="0.0015 0.0015 0.0015"></a-entity>
            
            <a-entity camera look-controls position="0 0 0">
                <a-cursor id="cursor" animation__click="property: scale; startEvents: click; from: 0.1 0.1 0.1; to: 1 1 1; dur: 150"
                          geometry="primitive: ring; radiusInner: 0.02; radiusOuter: 0.03"
                          material="color: #ff7eb3; shader: flat"
                          raycaster="objects: .clickable"></a-cursor>
            </a-entity>
            
            <a-entity laser-controls="hand: right" raycaster="objects: .clickable; far: 50"></a-entity>
        </a-scene>

        <div id="ar-controls-panel" style="position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 10px; z-index: 1000; font-family: sans-serif; color: white;">
            <h4 style="color:var(--accent-pink); margin: 0 0 5px 0;">A-Frame WebXR Мережа</h4>
            <p style="margin:0 0 10px 0; font-size:12px;">Наведіть курсор/промінь та клікніть на сферу</p>
            <div style="display:flex; gap:8px;">
               <button onclick="window.toggleARAddMode()" class="btn outline-pink" id="ar-add-btn" style="padding:6px 12px; font-size:11px; background: transparent; border: 1px solid var(--accent-pink); color: var(--accent-pink); border-radius:4px; cursor:pointer;">Режим зв'язків: ВИМК</button>
               <button id="exit-ar-btn" class="btn danger" style="padding:6px 12px; font-size:11px; background:#ff4a5a; color:white; border:none; border-radius:4px; cursor:pointer;">Вийти з 3D</button>
            </div>
        </div>
    `;

    document.getElementById('exit-ar-btn').onclick = () => {
        isAddMode = false;
        xrContainer.remove();
        showToast("Вихід з WebXR сцени");
    };

    window.toggleARAddMode = function() {
        isAddMode = !isAddMode;
        selectedForConnection = null;
        const btn = document.getElementById('ar-add-btn');
        if (isAddMode) {
            btn.style.background = "var(--accent-pink)";
            btn.style.color = "white";
            btn.textContent = "Режим зв'язків: УВІМК";
            showToast("Оберіть дві вершини для з'єднання.");
        } else {
            btn.style.background = "transparent";
            btn.style.color = "var(--accent-pink)";
            btn.textContent = "Режим зв'язків: ВИМК";
            showToast("Режим перегляду інтересів.");
        }
    };

    const sceneEl = xrContainer.querySelector('a-scene');
    sceneEl.addEventListener('loaded', () => {
        const holderEl = document.getElementById('graph-holder');
        graphGroup = holderEl.object3D; 

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        graphGroup.add(ambientLight);

        window.refreshAR = function() {
            for (let i = graphGroup.children.length - 1; i >= 0; i--) {
                if (graphGroup.children[i].type !== "AmbientLight") {
                    graphGroup.remove(graphGroup.children[i]);
                }
            }
            meshes = {};

            people.forEach(p => {
                const geometry = new THREE.SphereGeometry(18, 32, 32);
                const material = new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815, shininess: 40 });
                const sphere = new THREE.Mesh(geometry, material);
                
                sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
                sphere.userData = { id: p.id, name: p.name };
                sphere.el = holderEl; 
                
                graphGroup.add(sphere);
                meshes[p.id] = sphere;

                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.font = 'Bold 24px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, 128, 40);

                const texture = new THREE.CanvasTexture(canvas);
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
                sprite.position.set(sphere.position.x, sphere.position.y + 35, sphere.position.z);
                sprite.scale.set(70, 17, 1);
                graphGroup.add(sprite);
            });

            edges.forEach(([u, v]) => {
                const nodeA = meshes[u]; const nodeB = meshes[v];
                if (nodeA && nodeB) {
                    const points = [nodeA.position, nodeB.position];
                    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const shared = getSharedInterests(u, v).length;
                    
                    const lineMat = new THREE.LineBasicMaterial({ 
                        color: shared > 0 ? 0xff7eb3 : 0x8e2de2, 
                        linewidth: 4, transparent: true, opacity: 0.5 + (shared * 0.15)
                    });
                    graphGroup.add(new THREE.Line(lineGeo, lineMat));
                }
            });
        };

        window.refreshAR();

        sceneEl.addEventListener('click', () => {
            const raycaster = sceneEl.components.raycaster.raycaster;
            const intersects = raycaster.intersectObjects(graphGroup.children, true);
            const clickedSphere = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

            if (clickedSphere) {
                const pId = clickedSphere.object.userData.id;
                const pName = clickedSphere.object.userData.name;
                
                if (isAddMode) {
                    if (!selectedForConnection) {
                        selectedForConnection = people.find(p => p.id === pId);
                        showToast(`Вибір: ${pName}. Клікніть на другу вершину.`);
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
                    showToast(`${person.name} | Інтереси: ${person.interests.join(', ')}`);
                    setTimeout(() => { if (clickedSphere.object?.material) clickedSphere.object.material.color.setHex(0xff7eb3); }, 3000);
                }
            }
        });

        function animateAFrame() {
            if (!document.getElementById("xr-overlay")) return;
            graphGroup.children.forEach(child => {
                if (child.geometry && child.geometry.type === "SphereGeometry") child.rotation.y += 0.01;
            });
            requestAnimationFrame(animateAFrame);
        }
        animateAFrame();
    });
}

function startVideoAR() {
    showToast("WebXR недоступний. Ініціалізація 3D-симуляції.");
    
    xrContainer = document.createElement("div");
    xrContainer.id = "xr-overlay";
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0"; xrContainer.style.left = "0";
    xrContainer.style.width = "100vw"; xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999"; xrContainer.style.overflow = "hidden";
    document.body.appendChild(xrContainer);

    let videoBg = document.createElement("video");
    videoBg.style.position = "absolute"; videoBg.style.top = "50%"; videoBg.style.left = "50%";
    videoBg.style.width = "100%"; videoBg.style.height = "100%";
    videoBg.style.objectFit = "cover"; videoBg.style.transform = "translate(-50%, -50%)";
    videoBg.style.zIndex = "1"; videoBg.autoplay = true; videoBg.playsInline = true;
    xrContainer.appendChild(videoBg);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => { videoBg.srcObject = stream; })
            .catch(() => { xrContainer.style.background = "#07050d"; });
    }

    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з 3D';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute"; closeBtn.style.top = "20px"; closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1000";
    closeBtn.onclick = () => { 
        if (videoBg.srcObject) videoBg.srcObject.getTracks().forEach(track => track.stop());
        isAddMode = false;
        xrContainer.remove(); 
    };
    xrContainer.appendChild(closeBtn);

    let infoPanel = document.createElement("div");
    infoPanel.style.position = "absolute"; infoPanel.style.bottom = "20px"; infoPanel.style.left = "20px";
    infoPanel.style.zIndex = "1000"; infoPanel.style.background = "rgba(0,0,0,0.8)";
    infoPanel.style.padding = "15px"; infoPanel.style.borderRadius = "10px"; infoPanel.style.color = "white"; infoPanel.style.fontFamily = "sans-serif";
    infoPanel.innerHTML = `
        <h4 style="color:var(--accent-pink); margin:0 0 5px 0;">Симуляція 3D / AR</h4>
        <p style="margin:0 0 8px 0; font-size:12px;">ЛКМ - обертання, Коліщатко - зум, ПКМ - зміщення.</p>
        <div style="display:flex; gap:5px;">
           <button onclick="window.toggleARAddModeSim()" class="btn outline-pink" id="sim-add-btn" style="padding:4px 8px; font-size:11px; background:transparent; border:1px solid var(--accent-pink); color:var(--accent-pink); cursor:pointer;">Режим зв'язків: ВИМК</button>
           <button onclick="window.randomizeConnections(); window.refreshAR();" class="btn secondary" style="padding:4px 8px; font-size:11px; cursor:pointer;">Рандом</button>
        </div>
    `;
    xrContainer.appendChild(infoPanel);

    window.toggleARAddModeSim = function() {
        isAddMode = !isAddMode;
        selectedForConnection = null;
        const btn = document.getElementById('sim-add-btn');
        if (isAddMode) {
            btn.style.background = "var(--accent-pink)"; btn.style.color = "white";
            btn.textContent = "Режим зв'язків: УВІМК";
        } else {
            btn.style.background = "transparent"; btn.style.color = "var(--accent-pink)";
            btn.textContent = "Режим зв'язків: ВИМК";
        }
    };

    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    xrCamera.position.set(0, 0, 500);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.domElement.style.position = "absolute";
    xrRenderer.domElement.style.top = "0"; xrRenderer.domElement.style.left = "0";
    xrRenderer.domElement.style.zIndex = "2"; 
    xrContainer.appendChild(xrRenderer.domElement);

    const controls = new THREE.OrbitControls(xrCamera, xrRenderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;

    xrScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const pointLight = new THREE.PointLight(0xff7eb3, 1.2, 1000);
    pointLight.position.set(0, 200, 200);
    xrScene.add(pointLight);

    window.refreshAR = function() {
        for (let i = xrScene.children.length - 1; i >= 0; i--) {
            if (xrScene.children[i].type !== "AmbientLight" && xrScene.children[i].type !== "PointLight") {
                xrScene.remove(xrScene.children[i]);
            }
        }
        meshes = {};

        people.forEach(p => {
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 32), new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815, shininess: 40 }));
            sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            sphere.userData = { id: p.id, name: p.name };
            xrScene.add(sphere);
            meshes[p.id] = sphere;

            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.font = 'Bold 24px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, 128, 40);
            
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.position.set(sphere.position.x, sphere.position.y + 25, sphere.position.z);
            sprite.scale.set(60, 15, 1);
            xrScene.add(sprite);
        });

        edges.forEach(([u, v]) => {
            if (meshes[u] && meshes[v]) {
                const line = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints([meshes[u].position, meshes[v].position]), 
                    new THREE.LineBasicMaterial({ color: getSharedInterests(u, v).length > 0 ? 0xff7eb3 : 0x8e2de2, linewidth: 4, transparent: true, opacity: 0.6 })
                );
                xrScene.add(line);
            }
        });
    };
    window.refreshAR();

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
            if (isAddMode) {
                if (!selectedForConnection) {
                    selectedForConnection = people.find(p => p.id === pId);
                    showToast(`Вибір: ${pName}. Оберіть другу вершину.`);
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
                showToast(`${person.name} | Інтереси: ${person.interests.join(', ')}`);
                setTimeout(() => { if (clickedSphere.object?.material) clickedSphere.object.material.color.setHex(0xff7eb3); }, 3000);
            }
        }
    });

    function animate() {
        if (!document.getElementById("xr-overlay")) {
            xrRenderer.setAnimationLoop(null);
            return;
        }
        controls.update();
        xrScene.children.forEach(child => { 
            if (child.geometry && child.geometry.type === "SphereGeometry") child.rotation.y += 0.01; 
        });
        xrRenderer.render(xrScene, xrCamera);
    }
    xrRenderer.setAnimationLoop(animate);
}

```
