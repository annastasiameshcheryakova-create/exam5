// xr.js
async function initARMode() {
    // Перевірка підтримки WebXR
    if (!navigator.xr) {
        alert("Ваш браузер або пристрій не підтримує WebXR.");
        return;
    }

    // Створюємо контейнер для 3D/XR сцени, щоб він перекривав основний сайт
    const xrContainer = document.createElement('div');
    xrContainer.style.position = 'fixed';
    xrContainer.style.top = '0';
    xrContainer.style.left = '0';
    xrContainer.style.width = '100vw';
    xrContainer.style.height = '100vh';
    xrContainer.style.zIndex = '9998';
    xrContainer.style.background = '#0a0812'; // Темний фон для VR
    document.body.appendChild(xrContainer);

    // Контейнер для кнопок AR / VR
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'fixed';
    uiContainer.style.bottom = '30px';
    uiContainer.style.left = '50%';
    uiContainer.style.transform = 'translateX(-50%)';
    uiContainer.style.display = 'flex';
    uiContainer.style.gap = '12px';
    uiContainer.style.zIndex = '9999';
    document.body.appendChild(uiContainer);

    // Стилі для кнопок (як на скріншоті)
    const style = document.createElement('style');
    style.innerHTML = `
        .webxr-btn {
            padding: 8px 18px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 70px;
        }
        .webxr-btn.ar {
            background: transparent;
            border: 2px solid #ffffff;
            color: #ffffff;
        }
        .webxr-btn.vr {
            background: #ffffff;
            border: 2px solid #ffffff;
            color: #8bbfa3; /* Колір тексту підлаштований під фон з картинки */
        }
        .webxr-btn:active { transform: scale(0.95); }
        .close-xr {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
        }
    `;
    document.head.appendChild(style);

    // Кнопка виходу
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Закрити';
    closeBtn.className = "btn danger close-xr";
    closeBtn.onclick = () => {
        renderer.setAnimationLoop(null);
        xrContainer.remove();
        uiContainer.remove();
        closeBtn.remove();
    };
    document.body.appendChild(closeBtn);

    // Ініціалізація Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Важливо для WebXR
    xrContainer.appendChild(renderer.domElement);

    // Освітлення
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const pointLight = new THREE.PointLight(0xff7eb3, 1.2, 1000);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);

    // Група для графа
    const graphGroup = new THREE.Group();
    graphGroup.position.set(0, 0, -1); // 1 метр перед користувачем
    graphGroup.scale.set(0.005, 0.005, 0.005);
    scene.add(graphGroup);

    // Додаємо тестову сферу, щоб було видно, що сцена працює (заміни на свої вузли/ребра)
    const testSphere = new THREE.Mesh(
        new THREE.SphereGeometry(20, 32, 32),
        new THREE.MeshPhongMaterial({ color: 0xff7eb3 })
    );
    graphGroup.add(testSphere);

    // --- Перевірка підтримки та створення кнопок ---
    
    // AR Кнопка
    const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (arSupported) {
        const arButton = document.createElement('button');
        arButton.textContent = 'AR';
        arButton.className = 'webxr-btn ar';
        uiContainer.appendChild(arButton);
        
        arButton.onclick = async () => {
            try {
                const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'] });
                renderer.xr.setSession(session);
                xrContainer.style.background = 'transparent'; // Прозорий фон для AR
            } catch (e) {
                alert("Помилка запуску AR: " + e.message);
            }
        };
    }

    // VR Кнопка
    const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    if (vrSupported) {
        const vrButton = document.createElement('button');
        vrButton.textContent = 'VR';
        vrButton.className = 'webxr-btn vr';
        uiContainer.appendChild(vrButton);
        
        vrButton.onclick = async () => {
            try {
                const session = await navigator.xr.requestSession('immersive-vr');
                renderer.xr.setSession(session);
                xrContainer.style.background = '#0a0812'; // Темний фон для VR
            } catch (e) {
                alert("Помилка запуску VR: " + e.message);
            }
        };
    }

    if (!arSupported && !vrSupported) {
        uiContainer.innerHTML = '<span style="color:var(--text-muted); background:var(--glass-bg); padding:8px; border-radius:8px;">Ваш пристрій не підтримує AR/VR</span>';
    }

    // Головний цикл рендеру
    renderer.setAnimationLoop(() => {
        testSphere.rotation.y += 0.01; // Обертання тестової сфери
        renderer.render(scene, camera);
    });
}
