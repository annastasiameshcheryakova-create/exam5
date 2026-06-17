// xr.js
let arScene, arCamera, arRenderer;
let arMeshes = {};
let arController;
let arGraphGroup;

function initARMode() {
    // 1. Якщо відкрита звичайна 3D-версія з ui.js, видаляємо її контейнер, щоб звільнити WebGL context
    const old3dContainer = document.querySelector('div[style*="z-index: 999"]');
    if (old3dContainer) {
        old3dContainer.remove();
    }

    // Перевіряємо, чи кнопка AR вже створена
    if (document.getElementById('ARButton')) {
        showToast("AR сесія вже доступна. Натисніть 'ENTER AR' внизу екрана.");
        return;
    }

    showToast("Підготовка AR-середовища...");

    // Створюємо контейнер для AR-шару
    const container = document.createElement('div');
    container.id = "ar-renderer-container";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.zIndex = "1000";
    document.body.appendChild(container);

    // Додаємо кнопку виходу з AR режиму поверх екрана телефону
    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з AR';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute"; 
    closeBtn.style.top = "20px"; 
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1001";
    closeBtn.onclick = () => { 
        if (arRenderer && arRenderer.xr.isPresenting) {
            arRenderer.xr.getSession().end(); // Завершуємо XR сесію
        }
        container.remove();
        const btn = document.getElementById('ARButton');
        if (btn) btn.remove();
    };
    container.appendChild(closeBtn);

    arScene = new THREE.Scene();

    // Камера для AR (важливо поставити адекватний clipping planes для реального світу)
    arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Освітлення, щоб вузли графа відкидали тіні та виглядали об'ємно в кімнаті
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    arScene.add(light);

    // Альфа-канал (alpha: true) ОБОВ'ЯЗКОВИЙ, щоб бачити власну кімнату через камеру!
    arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    arRenderer.setPixelRatio(window.devicePixelRatio);
    arRenderer.setSize(window.innerWidth, window.innerHeight);
    arRenderer.xr.enabled = true;
    container.appendChild(arRenderer.domElement);

    // Створюємо стандартну кнопку WebXR з параметрами наскрізної AR (immersive-ar)
    const arButton = THREE.ARButton.createButton(arRenderer, { requiredFeatures: ['local-floor'] });
    document.body.appendChild(arButton);
    
    // Автоматичний клік для миттєвого входу в AR
    setTimeout(() => { arButton.click(); }, 500);

    arGraphGroup = new THREE.Group();
    // Розміщуємо граф перед користувачем (на 1.5 метра вперед і трохи нижче очей)
    arGraphGroup.position.set(0, -0.3, -1.5);
    // Масштабуємо: оскільки координати у вас 0-800, зменшуємо їх до метрів (0.0025)
    arGraphGroup.scale.set(0.0025, 0.0025, 0.0025); 
    arScene.add(arGraphGroup);

    window.refreshAR = function() {
        // Очищення сцени графа
        while(arGraphGroup.children.length > 0) { 
            arGraphGroup.remove(arGraphGroup.children[arGraphGroup.children.length - 1]); 
        }
        arMeshes = {};

        const nodeMaterial = new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815, shininess: 40 });
        const sphereGeo = new THREE.SphereGeometry(14, 32, 32);

        people.forEach(p => {
            const sphere = new THREE.Mesh(sphereGeo, nodeMaterial.clone());
            // Центрування та вирівнювання осей
            sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            sphere.userData = { id: p.id, name: p.name };
            arGraphGroup.add(sphere);
            arMeshes[p.id] = sphere;

            // Створення 2D-тексту для відображення імен у просторі кімнати
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; 
            ctx.font = 'Bold 24px Inter, sans-serif'; 
            ctx.textAlign = 'center'; 
            ctx.fillText(p.name, 128, 40);
            
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
            sprite.position.set(sphere.position.x, sphere.position.y + 25, sphere.position.z);
            sprite.scale.set(60, 15, 1);
            arGraphGroup.add(sprite);
        });

        // Побудова зв'язків (ребер)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x8e2de2, linewidth: 2, transparent: true, opacity: 0.6 });
        edges.forEach(([u, v]) => {
            if (arMeshes[u] && arMeshes[v]) {
                const isShared = getSharedInterests(u, v).length > 0;
                const mat = isShared ? new THREE.LineBasicMaterial({ color: 0xff7eb3, linewidth: 3, transparent: true, opacity: 0.8 }) : lineMaterial;
                
                const lineGeo = new THREE.BufferGeometry().setFromPoints([arMeshes[u].position, arMeshes[v].position]);
                const line = new THREE.Line(lineGeo, mat);
                arGraphGroup.add(line);
            }
        });
    };

    window.refreshAR();

    // Налаштування тач-взаємодії через екран смартфона в WebXR
    arController = arRenderer.xr.getController(0);
    arController.addEventListener('select', onSelect);
    arScene.add(arController);

    // Лазерний промінь-указка від смартфона для прицілювання у просторі
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geometry);
    line.name = 'line';
    line.scale.z = 5;
    arController.add(line);

    const raycaster = new THREE.Raycaster();

    function onSelect() {
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(arController.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(arController.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const intersects = raycaster.intersectObjects(arGraphGroup.children);
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
                        window.refreshAR(); 
                        if(typeof updateGraphElements === 'function') updateGraphElements();
                    }
                    selectedForConnection = null;
                }
            } else {
                // Анімація взаємодії з вузлом у кімнаті
                clickedSphere.object.material.color.setHex(0x8e2de2);
                setTimeout(() => clickedSphere.object.material.color.setHex(0xff7eb3), 1500);
            }
        }
    }

    // Запуск головного циклу рендерингу WebXR
    arRenderer.setAnimationLoop(render);

    function render() {
        // Повільне левітаційне обертання графа у кімнаті навколо своєї осі
        arGraphGroup.rotation.y += 0.0015;
        
        // Обертання кульок-вузлів
        arGraphGroup.children.forEach(child => { 
            if (child.geometry && child.geometry.type === "SphereGeometry") child.rotation.y += 0.01; 
        });

        arRenderer.render(arScene, arCamera);
    }
}
