<script>
// xr.js — ВИПРАВЛЕНА ВЕРСІЯ (кнопка повинна працювати)
let arScene, arCamera, arRenderer, arContainer;
let arMeshes = {};
let arGraphGroup;
let arHitTestSource = null;
let arReticle;

function initARMode() {
    showToast("Запуск AR...");

    // Повноекранний контейнер
    arContainer = document.createElement("div");
    arContainer.id = "ar-container";
    arContainer.style.position = "fixed";
    arContainer.style.top = "0";
    arContainer.style.left = "0";
    arContainer.style.width = "100vw";
    arContainer.style.height = "100vh";
    arContainer.style.zIndex = "99999";
    arContainer.style.background = "#000";
    arContainer.style.overflow = "hidden";
    document.body.appendChild(arContainer);

    // Кнопка "Вийти"
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з AR';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "100001";
    closeBtn.onclick = exitAR;
    arContainer.appendChild(closeBtn);

    arScene = new THREE.Scene();
    arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    arRenderer.setPixelRatio(window.devicePixelRatio);
    arRenderer.setSize(window.innerWidth, window.innerHeight);
    arRenderer.xr.enabled = true;
    arContainer.appendChild(arRenderer.domElement);

    // Освітлення
    arScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xff7eb3, 1.1);
    dirLight.position.set(3, 8, 5);
    arScene.add(dirLight);

    // Reticle
    arReticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32),
        new THREE.MeshBasicMaterial({ color: 0xff7eb3, side: THREE.DoubleSide })
    );
    arReticle.rotation.x = -Math.PI / 2;
    arReticle.visible = false;
    arScene.add(arReticle);

    arGraphGroup = new THREE.Group();
    arScene.add(arGraphGroup);

    // === AR КНОПКА (дуже важливо розмістити правильно) ===
    const arButton = THREE.ARButton.createButton(arRenderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar']
    });

    arButton.style.position = "absolute";
    arButton.style.bottom = "40px";
    arButton.style.left = "50%";
    arButton.style.transform = "translateX(-50%)";
    arButton.style.zIndex = "100002";
    arButton.style.opacity = "1";
    arContainer.appendChild(arButton);

    // Події сесії
    arRenderer.xr.addEventListener('sessionstart', onARSessionStart);
    arRenderer.xr.addEventListener('sessionend', exitAR);

    arRenderer.setAnimationLoop(renderAR);
    setupARInteraction();
}

function onARSessionStart() {
    const session = arRenderer.xr.getSession();
    session.requestReferenceSpace('local-floor').then(refSpace => {
        session.requestHitTestSource({ space: refSpace }).then(source => {
            arHitTestSource = source;
        }).catch(console.warn);
    });

    setTimeout(refreshARGraph, 700);
}

function renderAR(timestamp, frame) {
    if (frame && arHitTestSource) {
        const hits = frame.getHitTestResults(arHitTestSource);
        if (hits.length > 0) {
            const pose = hits[0].getPose(arRenderer.xr.getReferenceSpace());
            if (pose) {
                arReticle.visible = true;
                arReticle.position.fromMatrixPosition(pose.transform.matrix);
            }
        } else {
            arReticle.visible = false;
        }
    }
    arRenderer.render(arScene, arCamera);
}

function refreshARGraph() {
    while (arGraphGroup.children.length) arGraphGroup.remove(arGraphGroup.children[0]);
    arMeshes = {};

    const scale = 0.017;

    people.forEach(p => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 32, 32),
            new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815, shininess: 50 })
        );
        sphere.position.set((p.x - 400) * scale, 0.2, (p.y - 300) * scale * -1);
        sphere.userData = { id: p.id, name: p.name, type: 'node' };
        arGraphGroup.add(sphere);
        arMeshes[p.id] = sphere;

        // Лейбл
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.split(" ")[0], 128, 45);

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.position.set(sphere.position.x, sphere.position.y + 0.1, sphere.position.z);
        sprite.scale.set(0.14, 0.04, 1);
        arGraphGroup.add(sprite);
    });

    // Ребра
    edges.forEach(([u, v]) => {
        if (arMeshes[u] && arMeshes[v]) {
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([arMeshes[u].position, arMeshes[v].position]),
                new THREE.LineBasicMaterial({ 
                    color: getSharedInterests(u, v).length ? 0xff7eb3 : 0x8e2de2,
                    linewidth: 6, 
                    transparent: true, 
                    opacity: 0.85 
                })
            );
            arGraphGroup.add(line);
        }
    });

    arGraphGroup.position.set(0, 0.3, -1.2);
}

function setupARInteraction() {
    const raycaster = new THREE.Raycaster();

    arRenderer.domElement.addEventListener('touchend', (e) => {
        if (!arRenderer.xr.isPresenting()) return;

        raycaster.setFromCamera(new THREE.Vector2(0, -0.15), arCamera);

        const intersects = raycaster.intersectObjects(arGraphGroup.children, true);
        const hitNode = intersects.find(i => i.object.userData?.type === 'node');

        if (hitNode) {
            const mesh = hitNode.object;
            const person = people.find(p => p.id === mesh.userData.id);

            if (isAddMode && selectedForConnection) {
                if (selectedForConnection.id !== person.id) {
                    const added = addEdge(selectedForConnection.id, person.id);
                    showToast(added ? "Зв'язок створено!" : "Зв'язок видалено");
                    refreshARGraph();
                    updateGraphElements();
                }
                selectedForConnection = null;
            } else if (isAddMode) {
                selectedForConnection = person;
                mesh.material.color.setHex(0x00ffcc);
                showToast(`Обрано: ${person.name}`);
            } else {
                openNodePanel(person);
            }
        }
    });
}

function exitAR() {
    if (arRenderer) arRenderer.xr.getSession()?.end();
    if (arContainer && arContainer.parentNode) arContainer.parentNode.removeChild(arContainer);
    arHitTestSource = null;
}

window.initARMode = initARMode;
</script>
