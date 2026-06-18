// xr.js
function initARMode() {
    // Запобігаємо подвійному запуску
    if (document.getElementById('ar-overlay-container')) {
        if(typeof showToast === 'function') showToast("AR-режим вже відкрито.");
        return;
    }

    // Створюємо контейнер-оверлей поверх усього UI
    const container = document.createElement('div');
    container.id = 'ar-overlay-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.zIndex = '9998'; 
    container.style.background = 'rgba(0,0,0,0.8)'; // Темний фон до ввімкнення камери
    document.body.appendChild(container);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Додаємо освітлення, щоб сфери не були чорними
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const pointLight = new THREE.PointLight(0xff7eb3, 2, 100);
    pointLight.position.set(0, 2, 0);
    scene.add(pointLight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Активація WebXR
    container.appendChild(renderer.domElement);

    // Створюємо і стилізуємо AR-кнопку Three.js
    const arButton = THREE.ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
    arButton.style.zIndex = '9999'; // Важливо! Кнопка має бути вище за оверлей
    document.body.appendChild(arButton);

    // Кнопка для закриття режиму
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Закрити AR';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.left = "20px";
    closeBtn.style.zIndex = "10000";
    closeBtn.onclick = () => {
        renderer.setAnimationLoop(null);
        document.body.removeChild(container);
        if (document.body.contains(arButton)) document.body.removeChild(arButton);
    };
    container.appendChild(closeBtn);

    // Група для графа
    const graphGroup = new THREE.Group();
    graphGroup.position.set(0, 0, -1.5); // 1.5 метра ПЕРЕД користувачем
    graphGroup.scale.set(0.002, 0.002, 0.002); // Сильне зменшення масштабу для кімнати
    scene.add(graphGroup);

    // Переносимо вершини з data.js у 3D простір
    people.forEach(p => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(14, 16, 16),
            new THREE.MeshPhongMaterial({ color: 0xff7eb3, emissive: 0x2a0815 })
        );
        sphere.position.set(p.x - 400, -(p.y - 300), p.z || 0);
        graphGroup.add(sphere);
    });

    // Переносимо ребра (зв'язки) у 3D простір
    edges.forEach(([u, v]) => {
        const p1 = people.find(p => p.id === u);
        const p2 = people.find(p => p.id === v);
        if (p1 && p2) {
            const points = [
                new THREE.Vector3(p1.x - 400, -(p1.y - 300), p1.z || 0),
                new THREE.Vector3(p2.x - 400, -(p2.y - 300), p2.z || 0)
            ];
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                new THREE.LineBasicMaterial({ color: 0x8e2de2, linewidth: 2 })
            );
            graphGroup.add(line);
        }
    });

    // Запускаємо цикл анімації
    renderer.setAnimationLoop(() => {
        graphGroup.rotation.y += 0.002; // Граф буде повільно обертатися перед очима
        renderer.render(scene, camera);
    });
}
