<script>
// xr.js - FIXED & IMPROVED AR MODE
let arScene, arCamera, arRenderer, arContainer;
let arMeshes = {};
let arGraphGroup;
let arHitTestSource = null;
let arReticle;

function initARMode() {
    showToast("Запуск AR... (потрібен підтримуючий браузер та пристрій з AR)");

    // Create fullscreen AR container
    arContainer = document.createElement("div");
    arContainer.style.position = "fixed";
    arContainer.style.top = "0";
    arContainer.style.left = "0";
    arContainer.style.width = "100vw";
    arContainer.style.height = "100vh";
    arContainer.style.zIndex = "9999";
    arContainer.style.background = "#000";
    document.body.appendChild(arContainer);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з AR';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "10000";
    closeBtn.onclick = exitAR;
    arContainer.appendChild(closeBtn);

    // Info panel
    const info = document.createElement("div");
    info.style.position = "absolute";
    info.style.bottom = "20px";
    info.style.left = "20px";
    info.style.zIndex = "10000";
    info.style.background = "rgba(0,0,0,0.7)";
    info.style.padding = "12px";
    info.style.borderRadius = "8px";
    info.style.fontSize = "13px";
    info.style.maxWidth = "280px";
    info.innerHTML = `
        <strong style="color:#ff7eb3">AR Граф</strong><br>
        • Переміщуйтеся в реальному світі<br>
        • Торкніться для виділення<br>
        • Увімкніть "Режим зв'язків" для редагування
    `;
    arContainer.appendChild(info);

    arScene = new THREE.Scene();
    arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    
    arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    arRenderer.setPixelRatio(window.devicePixelRatio);
    arRenderer.setSize(window.innerWidth, window.innerHeight);
    arRenderer.xr.enabled = true;
    arRenderer.shadowMap.enabled = true;
    arContainer.appendChild(arRenderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    arScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xff7eb3, 1.2);
    dirLight.position.set(5, 10, 7);
    arScene.add(dirLight);

    // Reticle for placement
    arReticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32),
        new THREE.MeshBasicMaterial({ color: 0xff7eb3, side: THREE.DoubleSide })
    );
    arReticle.rotation.x = -Math.PI / 2;
    arReticle.visible = false;
    arScene.add(arReticle);

    // Graph group - placed via hit test
    arGraphGroup = new THREE.Group();
    arScene.add(arGraphGroup);

    // Add AR Button
    const arButton = THREE.ARButton.createButton(arRenderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar']
    });
    arButton.style.position = 'absolute';
    arButton.style.bottom = '20px';
    arButton.style.left = '50%';
    arButton.style.transform = 'translateX(-50%)';
    arContainer.appendChild(arButton);

    // Session start handler
    arRenderer.xr.addEventListener('sessionstart', onARSessionStart);
    arRenderer.xr.addEventListener('sessionend', exitAR);

    // Animation loop
    arRenderer.setAnimationLoop(renderAR);

    // Mouse/touch interaction (for selection)
    setupARInteraction();
}

function onARSessionStart() {
    const session = arRenderer.xr.getSession();
    
    session.requestReferenceSpace('local-floor').then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
            arHitTestSource = source;
        });
    });

    // Initial graph build
    setTimeout(() => {
        refreshARGraph();
    }, 800);
}

function renderAR(timestamp, frame) {
    if (frame) {
        const session = arRenderer.xr.getSession();
        if (arHitTestSource && session) {
            const hitTestResults = frame.getHitTestResults(arHitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(arRenderer.xr.getReferenceSpace());
                if (pose) {
                    arReticle.visible = true;
                    arReticle.position.setFromMatrixPosition(pose.transform.matrix);
                    arReticle.updateMatrixWorld(true);
                }
            } else {
                arReticle.visible = false;
            }
        }
    }

    if (arRenderer) arRenderer.render(arScene, arCamera);
}

function refreshARGraph() {
    // Clear previous graph
    while (arGraphGroup.children.length > 0) {
        arGraphGroup.remove(arGraphGroup.children[0]);
    }
    arMeshes = {};

    const scale = 0.015; // AR scale (smaller for real world)

    people.forEach(p => {
        // Sphere node
        const geometry = new THREE.SphereGeometry(0.035, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff7eb3, 
            emissive: 0x2a0815,
            shininess: 30 
        });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Position using person's x/y/z, but scaled for AR
        sphere.position.set(
            (p.x - 400) * scale, 
            0.1, 
            (p.y - 300) * scale * -1
        );
        
        sphere.userData = { id: p.id, name: p.name, type: 'node' };
        arGraphGroup.add(sphere);
        arMeshes[p.id] = sphere;

        // Label sprite
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.split(' ')[0], 128, 45);

        const spriteMat = new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas),
            depthTest: false 
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(sphere.position.x, sphere.position.y + 0.08, sphere.position.z);
        sprite.scale.set(0.12, 0.03, 1);
        arGraphGroup.add(sprite);
    });

    // Edges
    edges.forEach(([u, v]) => {
        if (arMeshes[u] && arMeshes[v]) {
            const points = [arMeshes[u].position, arMeshes[v].position];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ 
                color: getSharedInterests(u, v).length > 0 ? 0xff7eb3 : 0x8e2de2,
                linewidth: 6,
                transparent: true,
                opacity: 0.75
            });
            const line = new THREE.Line(lineGeo, lineMat);
            arGraphGroup.add(line);
        }
    });

    // Center the group initially
    arGraphGroup.position.set(0, 0.2, -0.8);
}

function setupARInteraction() {
    // For mobile AR - use controller or screen tap
    let selectedARNode = null;

    const raycaster = new THREE.Raycaster();
    const tempVec = new THREE.Vector3();

    arRenderer.domElement.addEventListener('touchend', (event) => {
        if (!arRenderer.xr.isPresenting()) return;

        // Approximate screen center for AR tap (or use controller if available)
        raycaster.setFromCamera(new THREE.Vector2(0, 0), arCamera); // center tap approx

        const intersects = raycaster.intersectObjects(arGraphGroup.children, true);
        
        const hitNode = intersects.find(i => i.object.userData && i.object.userData.type === 'node');

        if (hitNode) {
            const nodeMesh = hitNode.object;
            const pId = nodeMesh.userData.id;
            const person = people.find(p => p.id === pId);

            if (isAddMode) {
                if (!selectedForConnection) {
                    selectedForConnection = person;
                    nodeMesh.material.color.setHex(0xffffff);
                    showToast(`Обрано: ${person.name}`);
                } else {
                    if (selectedForConnection.id !== pId) {
                        const added = addEdge(selectedForConnection.id, pId);
                        showToast(added ? "Зв'язок створено!" : "Зв'язок видалено!");
                        if (!added) removeEdge(selectedForConnection.id, pId);
                        refreshARGraph();
                        updateGraphElements();
                    }
                    selectedForConnection = null;
                }
            } else {
                // Show info (floating panel works in background)
                openNodePanel(person);
                nodeMesh.material.emissive.setHex(0x441122);
                setTimeout(() => {
                    if (nodeMesh.material) nodeMesh.material.emissive.setHex(0x2a0815);
                }, 1500);
            }
        }
    });
}

function exitAR() {
    if (arRenderer) {
        arRenderer.xr.getSession()?.end();
        if (arContainer && arContainer.parentNode) {
            arContainer.parentNode.removeChild(arContainer);
        }
        arHitTestSource = null;
    }
}

// Make available globally
window.initARMode = initARMode;
</script>
