// visual3d.js
// =========================================================
// ДОПОВНЕНА РЕАЛЬНІСТЬ (AR) ТА 3D ВІЗУАЛІЗАЦІЯ
// =========================================================

let graphGroup; // Група для збереження об'єктів графа
let meshes = {};
let xrContainer, xrScene, xrCamera, xrRenderer;

// Головна точка входу для кнопки "3-D візуалізація" та "включити AR"
function start3DVisualization() {
    // Перевіряємо наявність WebXR пристрою, інакше запускаємо 3D-симуляцію
    if (navigator.xr) {
        initARMode();
    } else {
        startVideoAR();
    }
}

// Додатковий аліас для кнопки AR, якщо вона веде на інший пресет
function startRealAR() {
    initARMode();
}

function initARMode() {
    showToast("Ініціалізація WebXR через A-Frame...");
    startAFrameAR();
}

function startAFrameAR() {
    // 1. Створюємо контейнер-оверлей
    const xrContainer = document.createElement("div");
    xrContainer.id = "xr-overlay";
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0"; xrContainer.style.left = "0";
    xrContainer.style.width = "100vw"; xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999";
    document.body.appendChild(xrContainer);

    // 2. Структура A-Frame сцени всередині оверлея
    xrContainer.innerHTML = `
        <a-scene embedded xr-mode-ui="enabled: true; enterARElement: #custom-enter-ar" raycaster="objects: .clickable">
            <a-sky color="#07050d" material="opacity: 0.5"></a-sky>
            <a-plane position="0 -1.5 0" rotation="-90 0 0" width="30" height="30" color="#110d21" opacity="0.3"></a-plane>
            
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

    // Кнопка виходу
    document.getElementById('exit-ar-btn').onclick = () => {
        isAddMode = false;
        xrContainer.remove();
        showToast("Вихід з WebXR сцени");
    };

    // Перемикач режимів зв'язків
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

    // 3. Очікування завантаження A-Frame сцени
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
                const material = new THREE.MeshPhongMaterial({ 
                    color: 0xff7eb3, 
                    emissive: 0x2a0815, 
                    shininess: 40 
                });
                const sphere = new THREE.Mesh(geometry, material);
                
                sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
                sphere.userData = { id: p.id, name: p.name };
                sphere.el = holderEl; 
                
                graphGroup.add(sphere);
                meshes[p.id] = sphere;

                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.font = 'Bold 24px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(p.name, 128, 40);

                const texture = new THREE.CanvasTexture(canvas);
                const spriteMat = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.set(sphere.position.x, sphere.position.y + 35, sphere.position.z);
                sprite.scale.set(70, 17, 1);
                graphGroup.add(sprite);
            });

            edges.forEach(([u, v]) => {
                const nodeA = meshes[u];
                const nodeB = meshes[v];
                if (nodeA && nodeB) {
                    const points = [nodeA.position, nodeB.position];
                    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const shared = getSharedInterests(u, v).length;
                    const lineColor = shared > 0 ? 0xff7eb3 : 0x8e2de2;

                    const lineMat = new THREE.LineBasicMaterial({ 
                        color: lineColor, 
                        linewidth: 4, 
                        transparent: true,
                        opacity: 0.5 + (shared * 0.15)
                    });
                    const line = new THREE.Line(lineGeo, lineMat);
                    graphGroup.add(line);
                }
            });
        };

        window.refreshAR();

        // 4. Обробка кліків по сферах
        sceneEl.addEventListener('click', (evt) => {
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
                            window.refreshAR();
                            updateGraphElements();
                        }
                        selectedForConnection = null;
                    }
                } else {
                    const person = people.find(p => p.id === pId);
                    clickedSphere.object.material.color.setHex(0x8e2de2); 
                    showToast(`${person.name} | Інтереси: ${person.interests.join(', ')}`);
                    setTimeout(() => { 
                        if (clickedSphere.object && clickedSphere.object.material) {
                            clickedSphere.object.material.color.setHex(0xff7eb3); 
                        }
                    }, 3000);
                }
            }
        });

        // 5. Анімаційний такт A-Frame
        function animateAFrame() {
            if (!document.getElementById("xr-overlay")) return; 
            
            graphGroup.children.forEach(child => {
                if (child.geometry && child.geometry.type === "SphereGeometry") {
                    child.rotation.y += 0.01;
                }
            });
            requestAnimationFrame(animateAFrame);
        }
        animateAFrame();
    });
}

// СИМУЛЯЦІЯ (ДЛЯ ПК) З ORBIT CONTROLS ДЛЯ ВІЛЬНОГО РУХУ В 3D
function startVideoAR() {
    showToast("WebXR недоступний. Ініціалізація 3D-симуляції.");
    
    xrContainer = document.createElement("div");
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
            .catch(err => { xrContainer.style.background = "#07050d"; });
    }

    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з 3D';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute"; closeBtn.style.top = "20px"; closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1000";
    closeBtn.onclick = () => { 
        if (videoBg.srcObject) videoBg.srcObject.getTracks().forEach(track => track.stop());
        xrContainer.remove(); 
    };
    xrContainer.appendChild(closeBtn);

    let info = document.createElement("div");
    info.style.position = "absolute"; info.style.bottom = "20px"; info.style.left = "20px";
    info.style.zIndex = "1000"; info.style.background = "rgba(0,0,0,0.8)";
    info.style.padding = "15px"; info.style.borderRadius = "10px"; info.style.fontSize = "13px";
    info.innerHTML = `
        <h4 style="color:var(--accent-pink)">Симуляція 3D / AR</h4>
        <p style="margin-top:4px;">ЛКМ - обертання, Коліщатко - наближення, ПКМ - рух.</p>
        <p style="margin-top:4px;">Клікніть на 3D-сферу для керування зв'язками.</p>
        <div style="margin-top:8px; display:flex; gap:5px;">
           <button onclick="window.randomizeConnections(); window.refreshAR();" class="btn secondary" style="padding:4px 8px; font-size:11px;">Рандом</button>
        </div>
    `;
    xrContainer.appendChild(info);

    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    xrCamera.position.set(0, 0, 500);

    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setClearColor(0x000000, 0); 
    xrRenderer.domElement.style.position = "absolute";
    xrRenderer.domElement.style.top = "0"; xrRenderer.domElement.style.left = "0";
    xrRenderer.domElement.style.zIndex = "2"; 
    xrContainer.appendChild(xrRenderer.domElement);

    const controls = new THREE.OrbitControls(xrCamera, xrRenderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;

    xrScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const pointLight = new THREE.PointLight(0xff7eb3, 1.2, 1000);
    pointLight.position.set(0, 200, 200);
    xrScene.add(pointLight);

    window.refreshAR = function() {
        while(xrScene.children.length > 2) { xrScene.remove(xrScene.children[xrScene.children.length - 1]); }
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
            if (isAddMode) {
                if (!selectedForConnection) {
                    selectedForConnection = people.find(p => p.id === pId);
                    showToast(`Оберіть другу вершину.`);
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
                clickedSphere.object.material.color.setHex(0x8e2de2);
                setTimeout(() => clickedSphere.object.material.color.setHex(0xff7eb3), 3000);
            }
        }
    });

    function animate() {
        if (!document.body.contains(xrContainer)) {
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
