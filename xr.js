// xr.js
async function initXRMode() { // Перейменовано функцію для загального XR
    // Контейнер для UI
    const uiContainer = document.createElement('div');
    uiContainer.id = 'webxr-ui-container';
    // Налаштування контейнера для розміщення внизу праворуч
    uiContainer.style.position = 'absolute';
    uiContainer.style.bottom = '20px';
    uiContainer.style.right = '20px';
    uiContainer.style.display = 'flex';
    uiContainer.style.gap = '10px';
    uiContainer.style.zIndex = '1000';
    document.body.appendChild(uiContainer);

    const scene = new THREE.Scene();
    // Використовуємо існуючі параметри камери, але з меншим zoom
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Активуємо WebXR
    
    // Контейнер для рендерера, щоб він не конфліктував із UI
    const xrRendererContainer = document.createElement('div');
    xrRendererContainer.id = 'xr-renderer-container';
    document.body.appendChild(xrRendererContainer);
    xrRendererContainer.appendChild(renderer.domElement);

    // Додаємо стилі для кнопок WebXR
    const style = document.createElement('style');
    style.innerHTML = `
        .webxr-btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .webxr-btn.ar {
            background: transparent;
            border: 2px solid rgba(142, 45, 226, 0.4);
            color: #e0d4fc;
        }
        
        .webxr-btn.vr {
            background: white;
            border: none;
            color: #0a0812;
        }

        .webxr-btn:hover {
            opacity: 0.8;
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);

    // Перевірити підтримку AR та додати кнопку, якщо підтримується
    const arSupported = await renderer.xr.isSessionSupported('immersive-ar');
    if (arSupported) {
        const arButton = document.createElement('button');
        arButton.textContent = 'AR';
        arButton.classList.add('webxr-btn', 'ar'); // Додаємо класи для стилізації
        uiContainer.appendChild(arButton);
        arButton.onclick = async () => {
            const sessionInit = { requiredFeatures: ['hit-test'] };
            const session = await renderer.xr.requestSession('immersive-ar', sessionInit);
            renderer.xr.setSession(session);
        };
    }

    // Перевірити підтримку VR та додати кнопку, якщо підтримується
    const vrSupported = await renderer.xr.isSessionSupported('immersive-vr');
    if (vrSupported) {
        const vrButton = document.createElement('button');
        vrButton.textContent = 'VR';
        vrButton.classList.add('webxr-btn', 'vr'); // Додаємо класи для стилізації
        uiContainer.appendChild(vrButton);
        vrButton.onclick = async () => {
            const session = await renderer.xr.requestSession('immersive-vr');
            renderer.xr.setSession(session);
        };
    }

    // Група для графа (зменшуємо масштаб, щоб граф не був величезним)
    const graphGroup = new THREE.Group();
    graphGroup.position.set(0, 0, -0.5); // 0.5 метра перед користувачем
    graphGroup.scale.set(0.001, 0.001, 0.001);
    scene.add(graphGroup);

    // Додайте тут логіку додавання ваших вузлів (people) та ребер (edges)
    // у graphGroup, аналогічно вашій функції start3DMode

    renderer.setAnimationLoop((timestamp, frame) => {
        renderer.render(scene, camera);
    });
}
