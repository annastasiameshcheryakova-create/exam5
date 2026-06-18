// xr.js
async function initARMode() {
    if (!navigator.xr) {
        alert("Ваш пристрій або браузер не підтримує WebXR (AR/VR). Переконайтеся, що ви відкриваєте сайт через HTTPS або localhost.");
        return;
    }

    // Тимчасово ховаємо основний інтерфейс сайту, щоб він не заважав на мобільному
    const mainApp = document.querySelector('.app');
    if (mainApp) mainApp.style.display = 'none';

    // Створюємо контейнер для WebXR
    const xrContainer = document.createElement('div');
    xrContainer.id = 'xr-space-container';
    xrContainer.style.position = 'fixed';
    xrContainer.style.top = '0';
    xrContainer.style.left = '0';
    xrContainer.style.width = '100vw';
    xrContainer.style.height = '100vh';
    xrContainer.style.zIndex = '99999';
    xrContainer.style.background = '#0a0812';
    document.body.appendChild(xrContainer);

    // Створюємо інтерфейс керування режимами
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'fixed';
    uiContainer.style.bottom = '40px';
    uiContainer.style.left = '50%';
    uiContainer.style.transform = 'translateX(-50%)';
    uiContainer.style.display = 'flex';
    uiContainer.style.gap = '15px';
    uiContainer.style.zIndex = '100000';
    document.body.appendChild(uiContainer);

    // Додаємо стилі для кнопок перемикання режимів
    const style = document.createElement('style');
    style.innerHTML = `
        .xr-control-btn {
            padding: 12px 24px;
            border-radius: 10px;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 90px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .xr-control-btn.ar-mode {
            background: transparent;
            border: 2px solid #ffffff;
            color: #ffffff;
        }
        .xr-control-btn.vr-mode {
            background: #ffffff;
            border: 2px solid #ffffff;
            color: #1a1025;
        }
        .xr-control-btn.active-session {
            background: #ff4b4b !important;
            border-color: #ff4b4b !important;
            color: #ffffff !important;
        }
        .xr-close-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100001;
            padding: 10px 20px;
            background: #ff4b4b;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // Кнопка повного виходу з XR режиму
    const closeBtn = document.createElement("button");
    closeBtn.className = "xr-close-btn";
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти';
    document.body.appendChild(closeBtn);

    // Ініціалізація Three.js сцени
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    xrContainer.appendChild(renderer.domElement);

    // Освітлення
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xff7eb3, 1.5);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    // Головна група для графа
    const graphGroup = new THREE.Group();
    // Ставимо граф приблизно на рівні очей (0.2м нижче камери) та на відстані 1.2 метра від користувача
    graphGroup.position.set(0, -0.2, -1.2); 
    scene.add(graphGroup);

    // --- ПОБУДОВА РЕАЛЬНОГО ГРАФА З ДАНИХ (people та edges) ---
    if (typeof people !== 'undefined' && people.length > 0) {
        // Знаходимо середні координати (центр мас) D3 графа, щоб посунути його в центр 3D простору
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        
        people.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            const zCoord = p.z || 0;
            if (zCoord < minZ) minZ = zCoord; if (zCoord > maxZ) maxZ = zCoord;
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        // Коефіцієнт масштабування, щоб весь граф вписувався в куб ~60см (комфортно для AR/VR)
        const maxSpan = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
        const targetSize = 0.6; 
        const scaleFactor = targetSize / maxSpan;

        const nodeObjects = {};

        // Малюємо вузли (Spheres)
        people.forEach(person => {
            const sphereGeo = new THREE.SphereGeometry(0.02, 16, 16); // Радіус вузла 2 см
            const sphereMat = new THREE.MeshPhongMaterial({
                color: 0xff7eb3, // Твій фірмовий рожевий колір
                shininess: 80,
                emissive: 0x3a0c20
            });
            const mesh = new THREE.Mesh(sphereGeo, sphereMat);

            // Вираховуємо відносні координати вузла
            const localX = ((person.x || 0) - centerX) * scaleFactor;
            const localY = -((person.y || 0) - centerY) * scaleFactor; // Інвертуємо Y, бо в 2D D3 він йде вниз
            const localZ = ((person.z || 0) - centerZ) * scaleFactor;

            mesh.position.set(localX, localY, localZ);
            graphGroup.add(mesh);

            // Зберігаємо посилання для малювання ліній зв'язку
            nodeObjects[person.id] = mesh.position;
        });

        // Малюємо зв'язки між вузлами (Lines)
        if (typeof edges !== 'undefined') {
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x8e2de2, // Фіолетовий колір зв'язків
                transparent: true,
                opacity: 0.6,
                linewidth: 2 // На мобільних товщина лінії зазвичай ігнорується, але нехай буде
            });

            edges.forEach(([sourceId, targetId]) => {
                const startPos = nodeObjects[sourceId];
                const endPos = nodeObjects[targetId];

                if (startPos && endPos) {
                    const points = [startPos, endPos];
                    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(lineGeo, lineMat);
                    graphGroup.add(line);
                }
            });
        }
    }

    // Перемикання станів та фонів при зміні сесій
    let currentSession = null;

    function onSessionStarted(session) {
        currentSession = session;
        if (session.mode === 'immersive-ar') {
            xrContainer.style.background = 'transparent'; // Прозорість для камери телефону
            renderer.setClearAlpha(0);
        } else {
            xrContainer.style.background = '#0a0812'; // Темний космос для VR
            renderer.setClearAlpha(1);
        }
    }

    function onSessionEnded() {
        currentSession = null;
        xrContainer.style.background = '#0a0812';
        renderer.setClearAlpha(1);
        // Скидаємо активні класи з кнопок
        document.querySelectorAll('.xr-control-btn').forEach(b => {
            b.classList.remove('active-session');
            b.textContent = b.dataset.modeName;
        });
    }

    // Функція запуску/зупинки конкретної сесії
    async function toggleXRSession(mode, button) {
        if (currentSession) {
            await currentSession.end();
            return;
        }

        try {
            // Використовуємо optionalFeatures замість requiredFeatures, щоб AR не падало на смартфонах без підтримки лідарів/hit-test
            const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hit-test'] };
            const session = await navigator.xr.requestSession(mode, sessionInit);
            
            button.classList.add('active-session');
            button.textContent = 'Стоп';
            
            renderer.xr.setSession(session);
            onSessionStarted(session);
            session.addEventListener('end', onSessionEnded);
        } catch (err) {
            alert(`Не вдалося запустити ${mode.toUpperCase()} режим. Можливо, потрібно надати дозвіл на камеру або ваш девайс несумісний.`);
            console.error(err);
        }
    }

    // --- Перевірка доступності та генерація кнопок ---
    const modesToCheck = [
        { mode: 'immersive-ar', label: 'AR', className: 'ar-mode' },
        { mode: 'immersive-vr', label: 'VR', className: 'vr-mode' }
    ];

    for (const item of modesToCheck) {
        const supported = await navigator.xr.isSessionSupported(item.mode);
        if (supported) {
            const btn = document.createElement('button');
            btn.className = `xr-control-btn ${item.className}`;
            btn.textContent = item.label;
            btn.dataset.modeName = item.label;
            uiContainer.appendChild(btn);

            btn.onclick = () => toggleXRSession(item.mode, btn);
        }
    }

    // Якщо жоден режим не підтримується системою
    if (uiContainer.children.length === 0) {
        uiContainer.innerHTML = '<span style="color:#ff4b4b; background:rgba(30,25,45,0.8); padding:10px 20px; border-radius:8px; font-weight:600;">Пристрій не підтримує AR чи VR</span>';
    }

    // Логіка кнопки "Вийти"
    closeBtn.onclick = async () => {
        if (currentSession) {
            await currentSession.end();
        }
        renderer.setAnimationLoop(null);
        xrContainer.remove();
        uiContainer.remove();
        closeBtn.remove();
        style.remove();
        if (mainApp) mainApp.style.display = 'flex'; // Повертаємо інтерфейс сайту назад
    };

    // Головний цикл оновлення кадру WebXR
    renderer.setAnimationLoop(() => {
        // Повільне обертання всього графа навколо власної осі для краси
        graphGroup.rotation.y += 0.003;
        renderer.render(scene, camera);
    });
}
