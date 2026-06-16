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
// WEBXR AR MODE
// =========================================================

let xrScene;
let xrCamera;
let xrRenderer;
let xrContainer;
let graphGroup;

let meshes = {};

let hitTestSource = null;
let hitTestSourceRequested = false;

let graphPlaced = false;

function initARMode() {

    if (!navigator.xr) {
        startDesktop3D();
        return;
    }

    navigator.xr.isSessionSupported("immersive-ar")
        .then(supported => {

            if (supported) {
                startTrueWebXR();
            } else {
                startDesktop3D();
            }

        })
        .catch(() => {
            startDesktop3D();
        });
}

// =========================================================
// TRUE WEBXR
// =========================================================

function startTrueWebXR() {

    showToast("Запуск WebXR...");

    xrContainer = document.createElement("div");

    xrContainer.style.position = "fixed";
    xrContainer.style.left = "0";
    xrContainer.style.top = "0";
    xrContainer.style.width = "100vw";
    xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "9999";

    document.body.appendChild(xrContainer);

    xrScene = new THREE.Scene();

    xrCamera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );

    xrRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });

    xrRenderer.xr.enabled = true;

    xrRenderer.setPixelRatio(
        window.devicePixelRatio
    );

    xrRenderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    xrContainer.appendChild(
        xrRenderer.domElement
    );

    xrScene.add(
        new THREE.AmbientLight(
            0xffffff,
            1.2
        )
    );

    const light = new THREE.DirectionalLight(
        0xffffff,
        1
    );

    light.position.set(
        5,
        10,
        5
    );

    xrScene.add(light);

    graphGroup = new THREE.Group();

    graphGroup.visible = false;

    graphGroup.scale.set(
        0.0015,
        0.0015,
        0.0015
    );

    xrScene.add(graphGroup);

    refreshARGraph();

    const controller =
        xrRenderer.xr.getController(0);

    controller.addEventListener(
        "select",
        onXRSelect
    );

    xrScene.add(controller);

    navigator.xr.requestSession(
        "immersive-ar",
        {
            requiredFeatures: ["hit-test"],
            optionalFeatures: ["dom-overlay"],
            domOverlay: {
                root: document.body
            }
        }
    )
    .then(session => {

        xrRenderer.xr.setSession(
            session
        );

        session.addEventListener(
            "end",
            endXRSession
        );

        xrRenderer.setAnimationLoop(
            renderXR
        );

    })
    .catch(err => {

        console.error(err);

        showToast(
            "WebXR помилка"
        );

        xrContainer.remove();

    });
}

// =========================================================
// GRAPH RENDER
// =========================================================

function refreshARGraph() {

    while (graphGroup.children.length > 0) {

        graphGroup.remove(
            graphGroup.children[0]
        );

    }

    meshes = {};

    people.forEach(person => {

        const sphere =
            new THREE.Mesh(

                new THREE.SphereGeometry(
                    18,
                    32,
                    32
                ),

                new THREE.MeshStandardMaterial({

                    color: 0xff7eb3,
                    emissive: 0x220011

                })
            );

        sphere.position.set(
            person.x - 400,
            -(person.y - 300),
            person.z || 0
        );

        sphere.userData = {
            id: person.id
        };

        graphGroup.add(
            sphere
        );

        meshes[person.id] =
            sphere;

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width = 256;
        canvas.height = 64;

        const ctx =
            canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";

        ctx.font =
            "bold 26px Arial";

        ctx.textAlign =
            "center";

        ctx.fillText(
            person.name,
            128,
            42
        );

        const sprite =
            new THREE.Sprite(

                new THREE.SpriteMaterial({

                    map:
                        new THREE.CanvasTexture(
                            canvas
                        )

                })

            );

        sprite.position.set(
            sphere.position.x,
            sphere.position.y + 35,
            sphere.position.z
        );

        sprite.scale.set(
            70,
            18,
            1
        );

        graphGroup.add(
            sprite
        );
    });

    edges.forEach(edge => {

        const nodeA =
            meshes[edge[0]];

        const nodeB =
            meshes[edge[1]];

        if (!nodeA || !nodeB)
            return;

        const points = [
            nodeA.position,
            nodeB.position
        ];

        const geometry =
            new THREE.BufferGeometry()
            .setFromPoints(
                points
            );

        const material =
            new THREE.LineBasicMaterial({

                color: 0x8e2de2,

                transparent: true,

                opacity: 0.8

            });

        const line =
            new THREE.Line(
                geometry,
                material
            );

        graphGroup.add(
            line
        );
    });
}

// =========================================================
// XR SELECT
// =========================================================

function onXRSelect() {

    if (!graphPlaced) {

        graphPlaced = true;

        showToast(
            "Граф закріплено"
        );

        return;
    }

    const controller =
        xrRenderer.xr.getController(
            0
        );

    const matrix =
        new THREE.Matrix4();

    matrix.extractRotation(
        controller.matrixWorld
    );

    const raycaster =
        new THREE.Raycaster();

    raycaster.ray.origin
        .setFromMatrixPosition(
            controller.matrixWorld
        );

    raycaster.ray.direction
        .set(0, 0, -1)
        .applyMatrix4(matrix);

    const hits =
        raycaster.intersectObjects(
            Object.values(meshes)
        );

    if (!hits.length)
        return;

    const id =
        hits[0].object.userData.id;

    const person =
        people.find(
            p => p.id === id
        );

    if (!person)
        return;

    showToast(
        person.name +
        " | " +
        person.interests.join(", ")
    );
}

// =========================================================
// XR LOOP
// =========================================================

function renderXR(timestamp, frame) {

    if (frame) {

        const session =
            xrRenderer.xr.getSession();

        const referenceSpace =
            xrRenderer.xr
            .getReferenceSpace();

        if (
            !hitTestSourceRequested
        ) {

            session
                .requestReferenceSpace(
                    "viewer"
                )
                .then(space => {

                    session
                        .requestHitTestSource({
                            space
                        })
                        .then(source => {

                            hitTestSource =
                                source;

                        });

                });

            hitTestSourceRequested =
                true;
        }

        if (
            hitTestSource &&
            !graphPlaced
        ) {

            const results =
                frame.getHitTestResults(
                    hitTestSource
                );

            if (results.length) {

                const hit =
                    results[0];

                const pose =
                    hit.getPose(
                        referenceSpace
                    );

                graphGroup.visible =
                    true;

                graphGroup.position.set(
                    pose.transform.position.x,
                    pose.transform.position.y,
                    pose.transform.position.z
                );
            }
        }
    }

    graphGroup.children.forEach(obj => {

        if (
            obj.geometry &&
            obj.geometry.type ===
                "SphereGeometry"
        ) {

            obj.rotation.y +=
                0.01;

        }

    });

    xrRenderer.render(
        xrScene,
        xrCamera
    );
}

// =========================================================
// END SESSION
// =========================================================

function endXRSession() {

    graphPlaced = false;

    hitTestSource = null;

    hitTestSourceRequested =
        false;

    xrRenderer.setAnimationLoop(
        null
    );

    xrRenderer.dispose();

    if (
        xrContainer &&
        xrContainer.parentNode
    ) {
        xrContainer.remove();
    }

    showToast(
        "AR завершено"
    );
}
