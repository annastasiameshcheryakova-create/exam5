<script>
// xr.js - FIXED AR MODE (кнопка працює)
let arScene, arCamera, arRenderer, arContainer;
let arMeshes = {};
let arGraphGroup;
let arHitTestSource = null;
let arReticle;

function initARMode() {
    showToast("Запуск AR...");

    arContainer = document.createElement("div");
    arContainer.style.position = "fixed";
    arContainer.style.top = "0";
    arContainer.style.left = "0";
    arContainer.style.width = "100vw";
    arContainer.style.height = "100vh";
    arContainer.style.zIndex = "10000";
    arContainer.style.background = "#000";
    arContainer.style.overflow = "hidden";
    document.body.appendChild(arContainer);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з AR';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "10001";
    closeBtn.onclick = exitAR;
    arContainer.appendChild(closeBtn);

    arScene = new THREE.Scene();
    arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    
    arRenderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true 
    });
    arRenderer.setPixelRatio(window.devicePixelRatio);
    arRenderer.setSize(window.innerWidth, window.innerHeight);
    arRenderer.xr.enabled = true;
    arContainer.appendChild(arRenderer.domElement);

    // Lights
    arScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xff7eb3, 1);
    dirLight.position.set(2, 5, 3);
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

    // === КНОПКА AR (правильне розміщення) ===
    const arButton = THREE.ARButton.createButton(arRenderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay']
    });
    
    arButton.style.position = "absolute";
    arButton.style.bottom = "30px";
    arButton.style.left = "50%";
    arButton.style.transform = "translateX(-50%)";
    arButton.style.zIndex = "10002";
    arContainer.appendChild(arButton);

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
        });
    });

    setTimeout(refreshARGraph, 600);
}

function renderAR(timestamp, frame) {
    if (frame && arHitTestSource) {
        const hitTestResults = frame.getHitTestResults(arHitTestSource);
        if (hitTestResults.length > 0) {
            const pose = hitTestResults[0].getPose(arRenderer.xr.getReferenceSpace());
            if (pose) {
                arReticle.visible = true;
                arReticle.position.fromMatrixPosition(pose.transform.matrix);
            }
        } else {
            arReticle.visible = false;
        }
    }
    if (arRenderer) arRenderer.render(arScene, arCamera);
}

function refreshARGraph() {
    while (arGraphGroup.children.length > 0) arGraphGroup.remove(arGraphGroup.children[0]);
    arMeshes = {};

    const scale = 0.018;

    people.forEach(p => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 32, 32),
            new THREE.MeshPhongMaterial({ 
                color: 0xff7eb3, 
                emissive: 0x2a0815,
                shininess: 40 
            })
        );
        
        sphere.position.set(
            (p.x - 400) * scale,
            0.15,
            (p.y - 300) * scale * -1
        );
        sphere.userData = { id: p.id, name: p.name, type: 'node' };
        arGraphGroup.add(sphere);
        arMeshes[p.id] = sphere;

        // Name label
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 34px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.split(" ")[0], 128, 42);

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas) 
        }));
        sprite.position.set(sphere.position.x, sphere.position.y + 0.09, sphere.position.z);
        sprite.scale.set(0.13, 0.035, 1);
        arGraphGroup.add(sprite);
    });

    // Edges
    edges.forEach(([u, v]) => {
        if (arMeshes[u] && arMeshes[v]) {
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([arMeshes[u].position, arMeshes[v].position]),
                new THREE.LineBasicMaterial({ 
                    color: getSharedInterests(u, v).length > 0 ? 0xff7eb3 : 0x8e2de2, 
                    linewidth: 5,
                    transparent: true,
                    opacity: 0.8
                })
            );
            arGraphGroup.add(line);
        }
    });

    arGraphGroup.position.set(0, 0.3, -1.0);
}

function setupARInteraction() {
    const raycaster = new THREE.Raycaster();

    arRenderer.domElement.addEventListener('touchend', () => {
        if (!arRenderer.xr.isPresenting()) return;

        raycaster.setFromCamera(new THREE.Vector2(0, -0.1), arCamera); // slightly above center

        const intersects = raycaster.intersectObjects(arGraphGroup.children, true);
        const hit = intersects.find(i => i.object.userData?.type === 'node');

        if (hit) {
            const mesh = hit.object;
            const person = people.find(p => p.id === mesh.userData.id);

            if (isAddMode) {
                if (!selectedForConnection) {
                    selectedForConnection = person;
                    mesh.material.color.setHex(0xffffff);
                    showToast(`Обрано: ${person.name}`);
                } else if (selectedForConnection.id !== person.id) {
                    const added = addEdge(selectedForConnection.id, person.id);
                    showToast(added ? "Зв'язок створено!" : "Зв'язок видалено");
                    refreshARGraph();
                    updateGraphElements();
                    selectedForConnection = null;
                }
            } else {
                openNodePanel(person);
                mesh.material.emissive?.setHex(0x552233);
                setTimeout(() => mesh.material.emissive?.setHex(0x2a0815), 1200);
            }
        }
    });
}

function exitAR() {
    if (arRenderer?.xr) arRenderer.xr.getSession()?.end();
    if (arContainer?.parentNode) arContainer.parentNode.removeChild(arContainer);
    arHitTestSource = null;
}

window.initARMode = initARMode;
</script>
