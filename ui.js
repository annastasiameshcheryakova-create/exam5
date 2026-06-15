// ui.js (Фрагмент WebXR AR Режиму)

let xrScene, xrCamera, xrRenderer, xrContainer;
let meshes = {};
let xrController; // XR Контролер для відстеження дотиків на екрані телефону в AR

function initARMode() {
    // 1. Перевірка підтримки WebXR пристроєм
    if (!navigator.xr) {
        showToast("WebXR не підтримується цим браузером. Переконайтеся, що використовуєте HTTPS та сумісний смартфон.");
        return;
    }

    // Перевіряємо, чи доступний саме режим immersive-ar (доповнена реальність)
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (!supported) {
            showToast("Режим Immersive-AR недоступний на цьому пристрої.");
            return;
        }
        startXRWebSession();
    });
}

function startXRWebSession() {
    showToast("Запуск нативної WebXR AR сесії...");

    // Створюємо базовий прозорий контейнер під WebXR Canvas
    xrContainer = document.createElement("div");
    xrContainer.style.position = "fixed";
    xrContainer.style.top = "0";
    xrContainer.style.left = "0";
    xrContainer.style.width = "100vw";
    xrContainer.style.height = "100vh";
    xrContainer.style.zIndex = "999";
    document.body.appendChild(xrContainer);

    // Створюємо 3D сцену та камеру
    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Ініціалізуємо WebGLRenderer з параметрами прозорості (alpha) та підтримкою XR
    xrRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    xrRenderer.xr.enabled = true; // КРИТИЧНО: Вмикаємо внутрішній двигун WebXR у Three.js
    xrContainer.appendChild(xrRenderer.domElement);

    // Додаємо освітлення простору
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    xrScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xff7eb3, 1.5);
    directionalLight.position.set(2, 4, 5);
    xrScene.add(directionalLight);

    // Запит WebXR сесії у смартфона
    navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'], // прив'язка до площини підлоги вашої кімнати
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: xrContainer }  // дозволяє виводити HTML-кнопки поверх AR
    }).then((session) => {
        
        xrRenderer.xr.setReferenceSpaceType('local-floor');
        xrRenderer.xr.setSession(session);
        showToast("AR простір успішно синхронізовано з кімнатою!");

        // Налаштування XR контролера для взаємодії (дотиків до екрану)
        xrController = xrRenderer.xr.getController(0);
        xrController.addEventListener('select', onXRSelect); // Подія 'select' спрацьовує при тапі на екран в AR
        xrScene.add(xrController);

        // Будуємо інтерфейс керування поверх AR
        createARInterface(session);
        
        // Масштабуємо та переносимо координати людей з 2D (екранного) у 3D (метричний AR простір кімнати)
        window.refreshAR();

        // Запуск циклу анімації через WebXR-луп
        xrRenderer.setAnimationLoop(renderARFrame);
    }).catch(err => {
        console.error("Помилка WebXR сесії: ", err);
        showToast("Не вдалося ініціалізувати WebXR сесію.");
        if(xrContainer) xrContainer.remove();
    });
}

// Функція створення інтерфейсу поверх камерного стриму
function createARInterface(session) {
    let closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Вийти з WebXR';
    closeBtn.className = "btn danger";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.zIndex = "1000";
    closeBtn.onclick = () => { 
        session.end(); 
    };
    xrContainer.appendChild(closeBtn);

    session.addEventListener('end', () => {
        xrRenderer.setAnimationLoop(null); // Зупиняємо рендер
        if (xrContainer) xrContainer.remove();
        showToast("Сесію WebXR завершено.");
    });

    let info = document.createElement("div");
    info.style.position = "absolute";
    info.style.bottom = "20px";
    info.style.left = "20px";
    info.style.zIndex = "1000";
    info.style.background = "rgba(10, 8, 18, 0.85)";
    info.style.border = "1px solid rgba(255, 126, 179, 0.3)";
    info.style.padding = "12px";
    info.style.borderRadius = "12px";
    info.style.fontSize = "12px";
    info.style.color = "#f0e6f5";
    info.innerHTML = `
        <h4 style="color:var(--accent-pink); margin-bottom: 4px;"><i class="fas fa-vr-cardboard"></i> Нативний WebXR</h4>
        <p>Тапайте по сферах у кімнаті, щоб керувати лініями зв'язків.</p>
        <div style="margin-top:8px; display:flex; gap:6px;">
           <button onclick="window.randomizeConnections(); window.refreshAR();" class="btn secondary" style="padding:4px 8px; font-size:10px;">Рандом</button>
           <button onclick="window.resetGraph(); window.refreshAR();" class="btn danger" style="padding:4px 8px; font-size:10px;">Очистити</button>
        </div>
    `;
    xrContainer.appendChild(info);
}

// ПЕРЕПИСАНИЙ REFRESH AR: Масштабування під розміри реальної кімнати (в метрах)
window.refreshAR = function() {
    // Видаляємо старі об'єкти крім контролера
    while(xrScene.children.length > 3) { 
        xrScene.remove(xrScene.children[xrScene.children.length - 1]); 
    }
    meshes = {};

    people.forEach((p, index) => {
        // У WebXR координати йдуть в метрах. Зменшуємо 2D координати графа, щоб хмара помістилася в кімнаті.
        // Центруємо граф перед користувачем на відстані 1.5 метра від камери
        const arX = (p.x - 400) * 0.0035; 
        const arY = (-(p.y - 300) * 0.0035) + 1.2; // На висоті очей (1.2м від підлоги)
        const arZ = -1.5 + ((p.z || 0) * 0.002);   // Глибина перед камерою

        // Діаметр сфери людини в AR — приблизно 10 сантиметрів (0.05м радіус)
        const geometry = new THREE.SphereGeometry(0.05, 24, 24);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff7eb3,
            emissive: 0x2a0815,
            shininess: 30
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(arX, arY, arZ);
        sphere.userData = { id: p.id, name: p.name };
        
        xrScene.add(sphere);
        meshes[p.id] = sphere;

        // Створення текстової плашки (Ім'я над сферою людини)
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'Bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.split(" ")[0], 64, 20);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(sphere.position.x, sphere.position.y + 0.08, sphere.position.z);
        sprite.scale.set(0.25, 0.0625, 1);
        xrScene.add(sprite);
    });

    // Побудова сплошних товстих ліній зв'язків у AR кімнаті
    edges.forEach(([u, v]) => {
        const nodeA = meshes[u];
        const nodeB = meshes[v];
        if (nodeA && nodeB) {
            const points = [nodeA.position, nodeB.position];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            
            const shared = getSharedInterests(u, v).length;
            const lineColor = shared > 0 ? 0xff7eb3 : 0x8e2de2;

            // Створюємо видиму лінію з товщиною (через імітацію матеріалу)
            const lineMat = new THREE.LineBasicMaterial({ 
                color: lineColor, 
                transparent: true,
                opacity: 0.6 + (shared * 0.1)
            });
            const line = new THREE.Line(lineGeo, lineMat);
            xrScene.add(line);
        }
    });
};

// ВЗАЄМОДІЯ В AR: Обробка кліку (тапу по екрану) по тривимірних об'єктах у реальному часі
function onXRSelect(event) {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();

    // Отримуємо напрямок променя з віртуального контролера (напрямок погляду/наведення телефону)
    tempMatrix.identity().extractRotation(xrController.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(xrController.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(xrScene.children);
    const clickedSphere = intersects.find(i => i.object.geometry && i.object.geometry.type === "SphereGeometry");

    if (clickedSphere) {
        const pId = clickedSphere.object.userData.id;
        const pName = clickedSphere.object.userData.name;
        
        if (isAddMode) {
            if (!selectedForConnection) {
                // Вибираємо першу людину для зв'язку в AR
                selectedForConnection = people.find(p => p.id === pId);
                showToast(`AR Зв'язок: з ${pName}. Наведіть та тапніть на іншого.`);
                clickedSphere.object.material.color.setHex(0xffffff); // Світимо білим при виборі
            } else {
                // Вибираємо другу людину
                if (selectedForConnection.id !== pId) {
                    const added = addEdge(selectedForConnection.id, pId);
                    if (added) {
                        showToast("Зв'язок успішно побудовано в AR!");
                    } else {
                        removeEdge(selectedForConnection.id, pId);
                        showToast("Зв'язок розірвано в AR просторі.");
                    }
                    window.refreshAR();        // Оновлюємо 3D WebXR сцену
                    updateGraphElements();    // Синхронізуємо зі звичайним 2D D3-графом
                }
                selectedForConnection = null;
            }
        } else {
            // Звичайний клік у режимі перегляду: підсвічуємо фіолетовим та виводимо інформацію
            const person = people.find(p => p.id === pId);
            clickedSphere.object.material.color.setHex(0x8e2de2);
            showToast(`${person.name} | Інтереси: ${person.interests.join(', ')}`);
            setTimeout(() => {
                if(clickedSphere.object && clickedSphere.object.material) {
                    clickedSphere.object.material.color.setHex(0xff7eb3);
                }
            }, 2500);
        }
    }
}

// Цикл оновлення та рендерингу кадрів WebXR сесії
function renderARFrame(timestamp, frame) {
    if (!frame) return;

    // Анімаційне мікрообертання вузлів для ефекту "живого" графа у кімнаті
    xrScene.children.forEach(child => {
        if (child.geometry && child.geometry.type === "SphereGeometry") {
            child.rotation.y += 0.01;
        }
    });

    xrRenderer.render(xrScene, xrCamera);
}
