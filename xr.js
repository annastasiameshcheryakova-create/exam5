// xr.js
let arScene, arCamera, arRenderer;
let arMeshes = {};
let arController;
let arGraphGroup;

function initARMode() {
    // Перевіряємо, чи кнопка AR вже створена
    if (document.getElementById('ARButton')) {
        showToast("AR сесія вже доступна. Натисніть 'ENTER AR' внизу екрана.");
        return;
    }

    showToast("Підготовка AR-середовища...");

    const container = document.createElement('div');
    document.body.appendChild(container);

    arScene = new THREE.Scene();

    arCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    arScene.add(light);

    arRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    arRenderer.setPixelRatio(window.devicePixelRatio);
    arRenderer.setSize(window.innerWidth, window.innerHeight);
    // Вмикаємо WebXR
    arRenderer.xr.enabled = true;
    container.appendChild(arRenderer.domElement);

    // Додаємо стандартну кнопку WebXR в DOM
    const arButton = THREE.ARButton.createButton(arRenderer);
    document.body.appendChild(arButton);
    
    // Імітуємо клік по кнопці, щоб одразу запропонувати користувачу увійти в AR
    setTimeout(() => { arButton.click(); }, 500);

    arGraphGroup = new THREE.Group();
    // Розміщуємо граф перед користувачем (z = -2 метра) і трохи нижче рівня очей
    arGraphGroup.position.set(0, -0.5, -2);
    // Масштабуємо координати: 3D координати 0-800 конвертуємо в метри
    arGraphGroup.scale.set(0.003, 0.003, 0.003); 
    arScene.add(arGraphGroup);

    window.refreshAR = function() {
        // Очищаємо попередній граф
        while(arGraphGroup.children.length > 0) { 
            arGraphGroup.remove(arGraphGroup.children[arGraphGroup.children.length - 1]); 
        }
        arMeshes = {};

        const nodeMaterial = new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815, shininess: 40 });
        const sphereGeo = new THREE.SphereGeometry(14, 32, 32);

        people.forEach(p => {
            const sphere = new THREE.Mesh(sphereGeo, nodeMaterial.clone());
            // Центруємо координати відносно (400, 300) для коректного обертання
            sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
            sphere.userData = { id: p.id, name: p.name };
            arGraphGroup.add(sphere);
            arMeshes[p.id] = sphere;

            // Текстові підписи
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; 
            ctx.font = 'Bold 24px Inter, sans-serif'; 
            ctx.textAlign = 'center'; 
            ctx.fillText(p.name, 128, 40);
            
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.position.set(sphere.position.x, sphere.position.y + 25, sphere.position.z);
            sprite.scale.set(60, 15, 1);
            arGraphGroup.add(sprite);
        });

        // Ребра
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

    // Взаємодія через AR-контролер (тап по екрану)
    arController = arRenderer.xr.getController(0);
    arController.addEventListener('select', onSelect);
    arScene.add(arController);

    // Візуальний промінь від телефону
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
                        updateGraphElements();
                    }
                    selectedForConnection = null;
                }
            } else {
                // Анімація при тапі
                clickedSphere.object.material.color.setHex(0x8e2de2);
                setTimeout(() => clickedSphere.object.material.color.setHex(0xff7eb3), 1500);
            }
        }
    }

    arRenderer.setAnimationLoop(render);

    function render() {
        // Легке обертання всієї структури для ефекту паріння
        arGraphGroup.rotation.y += 0.001;
        
        // Обертання самих вузлів навколо своєї осі
        arGraphGroup.children.forEach(child => { 
            if (child.geometry && child.geometry.type === "SphereGeometry") child.rotation.y += 0.01; 
        });

        arRenderer.render(arScene, arCamera);
    }
}
