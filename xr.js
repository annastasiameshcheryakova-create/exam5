// xr.js
function initARMode() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Активуємо WebXR
    container.appendChild(renderer.domElement);

    // Додаємо кнопку AR
    document.body.appendChild(THREE.ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

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
