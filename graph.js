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

    // Force Simulation with topology analysis in mind
    simulation = d3.forceSimulation(people)
        .force("link", d3.forceLink().id(d => d.id).distance(120).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(35));

    linksGroup = svg.append("g").attr("class", "links");
    nodesGroup = svg.append("g").attr("class", "nodes");

    updateGraphElements();

    simulation.on("tick", ticked);
    
    // Global click to close context menu
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

    // Links update
    const links = linksGroup.selectAll("line")
        .data(linkData, d => `${d.source.id}-${d.target.id}`);

    links.exit().remove();

    const linksEnter = links.enter().append("line")
        .attr("class", "link")
        .attr("stroke", "var(--edge-color)")
        // Feature: Weight dependent on shared interests
        .attr("stroke-width", d => 1.5 + (d.sharedCount * 1.5))
        .attr("stroke-opacity", 0.6)
        .on("contextmenu", handleContextMenu);

    linksEnter.merge(links);

    // Nodes update
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
        .attr("stroke-width", 2)
        .style("backdrop-filter", "blur(4px)");

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

// Search Animation Feature
function animateSearch(targetNodeId) {
    const node = people.find(p => p.id === targetNodeId);
    if (!node) return;
    
    currentHighlightedNode = node;
    
    // Dim all
    nodesGroup.selectAll(".node").classed("dimmed", true).classed("highlighted", false);
    linksGroup.selectAll(".link").classed("dimmed", true).classed("highlighted", false);
    
    // Highlight target
    nodesGroup.selectAll(".node").filter(d => d.id === targetNodeId)
        .classed("dimmed", false)
        .classed("highlighted", true)
        .select("circle")
        .transition().duration(500)
        .attr("r", 30)
        .transition().duration(500)
        .attr("r", 22);
        
    // Find recommendations and highlight them slightly
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

// Drag functionality
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
