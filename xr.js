// xr.js

// Головна функція ініціалізації AR-режиму
function initARMode() {
    // Перевірка на дублікати контейнера
    if (document.getElementById('xr-ar-container')) return;

    // 1. Створюємо ізольований контейнер для AR-елементів
    const container = document.createElement('div');
    container.id = 'xr-ar-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.zIndex = '99999';
    document.body.appendChild(container);

    // 2. Ініціалізація сцени, камери та рендерера
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Обов'язково активуємо XR-двигун
    container.appendChild(renderer.domElement);

    // 3. Додаємо освітлення, щоб моделька була об'ємною та яскравою
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xff7eb3, 1.5);
    directionalLight.position.set(1, 2, 1);
    scene.add(directionalLight);

    // 4. Створення та стилізація офіційної кнопки запуску WebXR
    const arButton = THREE.ARButton.createButton(renderer, { 
        requiredFeatures: ['local'] 
    });
    
    // Стилізуємо кнопку під дизайн вашого додатка
    arButton.style.position = 'absolute';
    arButton.style.bottom = '40px';
    arButton.style.left = '50%';
    arButton.style.transform = 'translateX(-50%)';
    arButton.style.background = 'linear-gradient(135deg, #8e2de2, #ff7eb3)';
    arButton.style.border = 'none';
    arButton.style.borderRadius = '12px';
    arButton.style.color = '#fff';
    arButton.style.padding = '14px 28px';
    arButton.style.fontSize = '16px';
    arButton.style.fontWeight = '600';
    arButton.style.boxShadow = '0 8px 24px rgba(255, 126, 179, 0.4)';
    arButton.style.zIndex = '100000';
    container.appendChild(arButton);

    // 5. Кнопка "Вийти", якщо користувач хоче повернутися до 2D-інтерфейсу
    const exitButton = document.createElement('button');
    exitButton.innerHTML = '<i class="fas fa-arrow-left"></i> Назад';
    exitButton.style.position = 'absolute';
    exitButton.style.top = '25px';
    exitButton.style.left = '25px';
    exitButton.style.padding = '10px 20px';
    exitButton.style.background = 'rgba(30, 25, 45, 0.8)';
    exitButton.style.border = '1px solid rgba(255, 126, 179, 0.3)';
    exitButton.style.borderRadius = '8px';
    exitButton.style.color = '#f0e6f5';
    exitButton.style.cursor = 'pointer';
    exitButton.style.zIndex = '100000';
    
    exitButton.addEventListener('click', () => {
        // Зупиняємо цикл рендерингу та повністю очищуємо AR-контейнер
        renderer.setAnimationLoop(null);
        if (renderer.xr.isPresenting) {
            renderer.xr.getSession().end();
        }
        document.body.removeChild(container);
    });
    container.appendChild(exitButton);

    // 6. Побудова вашої моделі графа (Вузли та Ребра)
    const graphGroup = new THREE.Group();
    // Робимо зміщення: на 1.2 метра від камери (-1.2 по Z) і трохи нижче очей (-0.2 по Y)
    graphGroup.position.set(0, -0.2, -1.2); 
    
    // Перевод з екранних пікселів (~800px) у метрові координати AR реальності
    const scaleFactor = 0.0015; 
    graphGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
    scene.add(graphGroup);

    // Центрування графа (приблизний центр вашого полотна 2D сцени)
    const centerX = 400;
    const centerY = 300;

    // Створюємо 3D-сфери для кожної людини з вашої бази даних
    people.forEach(person => {
        const geometry = new THREE.SphereGeometry(12, 24, 24);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff7eb3,       // Рожевий колір з вашої палітри CSS
            emissive: 0x4a0e2e,   // Легке внутрішнє свічення
            roughness: 0.2,
            metalness: 0.5
        });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Встановлюємо координати (інвертуємо Y, бо в WebGL вісь Y йде вгору)
        sphere.position.set(
            person.x - centerX, 
            -(person.y - centerY), 
            person.z || (Math.random() - 0.5) * 150
        );
        
        // Зберігаємо ID для можливих майбутніх кліків всередині AR
        sphere.userData = { id: person.id };
        graphGroup.add(sphere);
    });

    // Створюємо лінії зв'язків між вузлами
    edges.forEach(([sourceId, targetId]) => {
        const p1 = people.find(p => p.id === sourceId);
        const p2 = people.find(p => p.id === targetId);

        if (p1 && p2) {
            const points = [];
            points.push(new THREE.Vector3(p1.x - centerX, -(p1.y - centerY), p1.z || 0));
            points.push(new THREE.Vector3(p2.x - centerX, -(p2.y - centerY), p2.z || 0));

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0x8e2de2, // Фіолетовий колір ліній
                transparent: true,
                opacity: 0.6,
                linewidth: 2 // Примітка: товщина ліній підтримується не всіма мобільними пристроями
            });

            const line = new THREE.Line(geometry, material);
            graphGroup.add(line);
        }
    });

    // 7. Головний цикл оновлення кадрів для AR-сесії
    renderer.setAnimationLoop((timestamp, frame) => {
        // Граф буде плавно і красиво обертатися навколо власної осі в повітрі
        graphGroup.rotation.y += 0.003;
        
        renderer.render(scene, camera);
    });

    // Обробка зміни розмірів екрана смартфона/пристрою
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
