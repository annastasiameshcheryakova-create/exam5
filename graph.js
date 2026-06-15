// graph.js
let svg, simulation, nodesGroup, linksGroup;
let isAddMode = false;
let selectedForConnection = null;
let currentHighlightedNode = null;

function initGraph() {
    svg = d3.select("#graph-svg");
    svg.selectAll("*").remove();

    const container = document.querySelector('.graph-container');
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Симуляция физических сил D3
    simulation = d3.forceSimulation(people)
        .force("link", d3.forceLink().id(d => d.id).distance(120).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(35));

    linksGroup = svg.append("g").attr("class", "links");
    nodesGroup = svg.append("g").attr("class", "nodes");

    updateGraphElements();

    simulation.on("tick", ticked);
    
    d3.select("body").on("click", () => {
        document.getElementById("context-menu").classList.add("hidden");
    });
}

function updateGraphElements() {
    const linkData = edges.map(([source, target]) => {
        const sNode = people.find(p => p.id === source);
        const tNode = people.find(p => p.id === target);
        const sharedCount = sNode && tNode ? getSharedInterests(sNode.id, tNode.id).length : 0;
        return { source: sNode, target: tNode, sharedCount: sharedCount };
    });

    const links = linksGroup.selectAll("line")
        .data(linkData, d => `${d.source.id}-${d.target.id}`);

    links.exit().remove();

    const linksEnter = links.enter().append("line")
        .attr("class", "link")
        .attr("stroke", "var(--edge-color)")
        .attr("stroke-width", d => 1.5 + (d.sharedCount * 1.5))
        .attr("stroke-opacity", 0.6)
        .on("contextmenu", handleContextMenu);

    linksEnter.merge(links);

    const nodes = nodesGroup.selectAll("g.node")
        .data(people, d => d.id);

    nodes.exit().remove();

    const nodesEnter = nodes.enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", handleNodeClick);

    nodesEnter.append("circle")
        .attr("r", 22)
        .attr("fill", "var(--glass-bg)")
        .attr("stroke", "var(--accent-pink)")
        .attr("stroke-width", 2);

    nodesEnter.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", 5)
        .attr("fill", "var(--text-main)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("pointer-events", "none")
        .text(d => d.name.split(" ")[0]);

    nodesEnter.merge(nodes);

    simulation.nodes(people);
    simulation.force("link").links(linkData);
    simulation.alpha(0.3).restart();
    
    updateStats();
}

function ticked() {
    linksGroup.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    nodesGroup.selectAll("g")
        .attr("transform", d => `translate(${d.x},${d.y})`);
}

function handleNodeClick(event, d) {
    event.stopPropagation();
    
    if (isAddMode) {
        if (!selectedForConnection) {
            selectedForConnection = d;
            showToast(`Вибрано: ${d.name}. Клікніть на наступного вузла.`);
            d3.select(this).select("circle").attr("stroke", "#fff").attr("stroke-width", 4);
        } else {
            if (selectedForConnection.id !== d.id) {
                const added = addEdge(selectedForConnection.id, d.id);
                if (added) {
                    showToast(`Транспортний зв'язок створено!`);
                } else {
                    removeEdge(selectedForConnection.id, d.id);
                    showToast(`Зв'язок успішно розірвано.`);
                }
                updateGraphElements();
            }
            selectedForConnection = null;
            nodesGroup.selectAll("circle").attr("stroke", "var(--accent-pink)").attr("stroke-width", 2);
        }
    } else {
        openNodePanel(d);
    }
}

function handleContextMenu(event, d) {
    event.preventDefault();
    event.stopPropagation();
    
    const menu = document.getElementById("context-menu");
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.classList.remove("hidden");
    
    const btn = document.getElementById("delete-edge-btn");
    btn.onclick = () => {
        removeEdge(d.source.id, d.target.id);
        updateGraphElements();
        menu.classList.add("hidden");
        showToast("Маршрут видалено із системи.");
    };
}

function animateSearch(targetNodeId) {
    const node = people.find(p => p.id === targetNodeId);
    if (!node) return;
    
    currentHighlightedNode = node;
    
    nodesGroup.selectAll(".node").classed("dimmed", true).classed("highlighted", false);
    linksGroup.selectAll(".link").classed("dimmed", true).classed("highlighted", false);
    
    nodesGroup.selectAll(".node").filter(d => d.id === targetNodeId)
        .classed("dimmed", false)
        .classed("highlighted", true)
        .select("circle")
        .transition().duration(500)
        .attr("r", 30)
        .transition().duration(500)
        .attr("r", 22);
        
    const recs = getRecommendations(targetNodeId).slice(0, 3);
    const recIds = recs.map(r => r.id);
    
    nodesGroup.selectAll(".node").filter(d => recIds.includes(d.id))
        .classed("dimmed", false)
        .select("circle")
        .transition().duration(800)
        .attr("stroke", "var(--accent-purple)");
}

function resetHighlights() {
    currentHighlightedNode = null;
    nodesGroup.selectAll(".node")
        .classed("dimmed", false)
        .classed("highlighted", false)
        .select("circle")
        .attr("stroke", "var(--accent-pink)")
        .attr("r", 22);
        
    linksGroup.selectAll(".link")
        .classed("dimmed", false)
        .classed("highlighted", false);
}

function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}
function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}
function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
}

// --- РЕАЛИЗАЦИЯ ПОЛНОЦЕННОГО WEBXR / AR СЦЕНАРИЯ НА СТРУКТУРЕ A-FRAME ---
let selectedArSourceNode = null;

function initARScene() {
    const placeholder = document.getElementById("ar-placeholder");
    if(placeholder) placeholder.style.display = "none";

    const container = document.getElementById("ar-container");
    container.innerHTML = ""; // Сброс сцены

    // Создаем трехмерную сцену
    const scene = document.createElement("a-scene");
    scene.setAttribute("embedded", "");
    scene.setAttribute("xr-mode-ui", "enabled: true");
    
    const sky = document.createElement("a-sky");
    sky.setAttribute("color", "#080610");
    scene.appendChild(sky);

    // Добавляем камеру со встроенным рейкастом-курсором для симуляции тач-кликов в AR/VR
    const cameraEntity = document.createElement("a-entity");
    cameraEntity.setAttribute("position", "0 0 18");
    
    const camera = document.createElement("a-camera");
    const cursor = document.createElement("a-cursor");
    cursor.setAttribute("color", "#ff7eb3");
    cursor.setAttribute("fuse", "false");
    camera.appendChild(cursor);
    cameraEntity.appendChild(camera);
    scene.appendChild(cameraEntity);

    // Масштабируем планарные 2D D3-координаты в трехмерные метрические величины AR
    const scaleX = d3.scaleLinear().domain([0, 800]).range([-12, 12]);
    const scaleY = d3.scaleLinear().domain([0, 600]).range([-8, 8]);

    // Рендерим вершины графа в виде объемных 3D-сфер
    people.forEach((person, index) => {
        // Добавляем случайную координату глубины Z для достижения 3D объема структуры
        if(!person.z3d) person.z3d = (Math.random() - 0.5) * 10;
        person.x3d = scaleX(person.x || Math.random() * 800);
        person.y3d = scaleY(person.y || Math.random() * 600);

        const sphere = document.createElement("a-sphere");
        sphere.setAttribute("position", `${person.x3d} ${person.y3d} ${person.z3d}`);
        sphere.setAttribute("radius", "0.5");
        sphere.setAttribute("color", "#ff7eb3");
        sphere.setAttribute("id", `ar-node-${person.id}`);
        sphere.setAttribute("class", "interactive");

        // 3D Текст над каждым логистическим элементом
        const label = document.createElement("a-text");
        label.setAttribute("value", person.name.split(" ")[0]);
        label.setAttribute("align", "center");
        label.setAttribute("position", "0 0.8 0");
        label.setAttribute("scale", "0.7 0.7 0.7");
        label.setAttribute("color", "#ffffff");
        sphere.appendChild(label);

        // Интерактивные клики / триггеры внутри AR среды
        sphere.addEventListener("click", function() {
            showToast(`AR Інфо: ${person.name} [ID: ${person.id}]. Інтереси: ${person.interests.join(', ')}`);
            
            if (!selectedArSourceNode) {
                selectedArSourceNode = person;
                sphere.setAttribute("color", "#ffffff"); // Подсветка выбранного узла
                showToast(`AR Редактор: Выбрано ${person.name}. Кликните на другую сферу для изменения ребра.`);
            } else {
                if (selectedArSourceNode.id !== person.id) {
                    const added = addEdge(selectedArSourceNode.id, person.id);
                    if (added) {
                        showToast(`AR Простір: Создан новый путь.`);
                    } else {
                        removeEdge(selectedArSourceNode.id, person.id);
                        showToast(`AR Простір: Путь успешно удален.`);
                    }
                    // Обновляем геометрию линий в AR и перерисовываем D3 граф
                    updateARLines(scene);
                    updateGraphElements();
                }
                const oldSphere = document.getElementById(`ar-node-${selectedArSourceNode.id}`);
                if (oldSphere) oldSphere.setAttribute("color", "#ff7eb3");
                selectedArSourceNode = null;
            }
        });

        scene.appendChild(sphere);
    });

    // Отрисовка ребер графа в 3D пространстве
    updateARLines(scene);
    container.appendChild(scene);
    showToast("WebXR Сцена развернута! Нажмите 'VR' в углу для перехода в режим AR гарнитуры.");
}

function updateARLines(scene) {
    const oldLines = scene.querySelectorAll(".ar-line");
    oldLines.forEach(l => l.remove());

    edges.forEach(([source, target]) => {
        const sNode = people.find(p => p.id === source);
        const tNode = people.find(p => p.id === target);
        if (!sNode || !tNode) return;

        const lineEntity = document.createElement("a-entity");
        lineEntity.setAttribute("class", "ar-line");
        lineEntity.setAttribute("line", {
            start: `${sNode.x3d} ${sNode.y3d} ${sNode.z3d}`,
            end: `${tNode.x3d} ${tNode.y3d} ${tNode.z3d}`,
            color: "#8e2de2",
            opacity: 0.6
        });
        scene.appendChild(lineEntity);
    });
}
