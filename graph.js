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

    simulation = d3.forceSimulation(people)
        .force("link", d3.forceLink().id(d => d.id).distance(120).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(35));

    linksGroup = svg.append("g").attr("class", "links");
    nodesGroup = svg.append("g").attr("class", "nodes");

    updateGraphElements();

    simulation.on("tick", ticked);
    
    // Примусове перше оновлення
    setTimeout(() => simulation.alpha(1).restart(), 50);

    d3.select("body").on("click", () => {
        document.getElementById("context-menu").classList.add("hidden");
    });
}

function updateGraphElements() {
    const linkData = edges.map(([source, target]) => {
        const sNode = people.find(p => p.id === source);
        const tNode = people.find(p => p.id === target);
        const sharedCount = sNode && tNode ? getSharedInterests(sNode.id, tNode.id).length : 0;
        return { source: sNode, target: tNode, sharedCount };
    });

    // === LINKS ===
    let links = linksGroup.selectAll("line")
        .data(linkData, d => `${d.source.id}-${d.target.id}`);

    links.exit().remove();

    const linksEnter = links.enter().append("line")
        .attr("class", "link")
        .attr("stroke", "var(--edge-color)")
        .attr("stroke-width", d => 1.5 + (d.sharedCount * 1.5))
        .attr("stroke-opacity", 0.6)
        .on("contextmenu", handleContextMenu);

    links = linksEnter.merge(links);   // ← важливо

    // === NODES ===
    let nodes = nodesGroup.selectAll("g.node")
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

    nodes = nodesEnter.merge(nodes);   // ← важливо

    // Оновлення симуляції
    simulation.nodes(people);
    simulation.force("link").links(linkData);
    simulation.alpha(0.3).restart();
    
    updateStats();
}

// graph.js

// ... (початок файлу без змін до функції ticked)

function ticked() {
    // 1. Оновлюємо координати ліній зв'язків
    // Ми звертаємось до даних об'єктів, які D3 автоматично оновлює під час симуляції
    linksGroup.selectAll(".link")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    // 2. Оновлюємо позицію груп (коло + текст) через transform
    // Це забезпечує, що текст ніколи не "відстає" від кола
    nodesGroup.selectAll("g.node")
        .attr("transform", d => `translate(${d.x},${d.y})`);
}

function updateGraphElements() {
    // ВАЖЛИВО: Перетворюємо масив зв'язків на об'єкти з посиланнями на вузли
    const linkData = edges.map(([sourceId, targetId]) => {
        const sNode = people.find(p => p.id === sourceId);
        const tNode = people.find(p => p.id === targetId);
        const sharedCount = sNode && tNode ? getSharedInterests(sNode.id, tNode.id).length : 0;
        return { source: sNode, target: tNode, sharedCount: sharedCount };
    });

    // Оновлення ліній
    const links = linksGroup.selectAll("line.link")
        .data(linkData, d => `${d.source.id}-${d.target.id}`);

    links.exit().remove();

    const linksEnter = links.enter().append("line")
        .attr("class", "link")
        .attr("stroke", "var(--edge-color)")
        .attr("stroke-width", d => 1.5 + (d.sharedCount * 1.5))
        .on("contextmenu", handleContextMenu);

    linksEnter.merge(links);

    // Оновлення вузлів
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

    // Додаємо коло
    nodesEnter.append("circle")
        .attr("r", 22)
        .attr("fill", "var(--glass-bg)")
        .attr("stroke", "var(--accent-pink)")
        .attr("stroke-width", 2);

    // Додаємо текст (він всередині групи g, тому рухається синхронно з колом)
    nodesEnter.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", 5)
        .attr("fill", "var(--text-main)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("pointer-events", "none")
        .text(d => d.name.split(" ")[0]);

    const allNodes = nodesEnter.merge(nodes);

    // Оновлюємо симуляцію
    simulation.nodes(people);
    simulation.force("link").links(linkData);
    
    // Перезапускаємо симуляцію для застосування змін
    simulation.alpha(0.3).restart();
    
    updateStats();
}

// ... (решта функцій файлу)
function handleNodeClick(event, d) {
    event.stopPropagation();
    
    if (isAddMode) {
        if (!selectedForConnection) {
            selectedForConnection = d;
            showToast(`Вибрано: ${d.name}. Клікніть на іншу людину.`);
            d3.select(this).select("circle").attr("stroke", "#fff").attr("stroke-width", 4);
        } else {
            if (selectedForConnection.id !== d.id) {
                const added = addEdge(selectedForConnection.id, d.id);
                if (added) {
                    showToast(`Зв'язок створено!`);
                } else {
                    removeEdge(selectedForConnection.id, d.id);
                    showToast(`Зв'язок розірвано.`);
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
        showToast("Зв'язок розірвано");
    };
}

function animateSearch(targetNodeId) {
    const node = people.find(p => p.id === targetNodeId);
    if (!node) return;
    
    nodesGroup.selectAll(".node").classed("dimmed", true).classed("highlighted", false);
    linksGroup.selectAll(".link").classed("dimmed", true).classed("highlighted", false);
    
    nodesGroup.selectAll(".node").filter(d => d.id === targetNodeId)
        .classed("dimmed", false).classed("highlighted", true)
        .select("circle")
        .transition().duration(500).attr("r", 30)
        .transition().duration(500).attr("r", 22);
        
    const recs = getRecommendations(targetNodeId).slice(0, 3);
    const recIds = recs.map(r => r.id);
    
    nodesGroup.selectAll(".node").filter(d => recIds.includes(d.id))
        .classed("dimmed", false)
        .select("circle")
        .transition().duration(800)
        .attr("stroke", "var(--accent-purple)");
}

function resetHighlights() {
    nodesGroup.selectAll(".node")
        .classed("dimmed", false).classed("highlighted", false)
        .select("circle")
        .attr("stroke", "var(--accent-pink)")
        .attr("r", 22);
        
    linksGroup.selectAll(".link")
        .classed("dimmed", false).classed("highlighted", false);
}

// Drag
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
