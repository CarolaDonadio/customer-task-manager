document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "helpdesk.local.v1";
    const LEGACY_KEY = "historialTickets";
    const PAGE_SIZE = 25;
    const STATUSES = ["Abierto", "En progreso", "En espera", "Resuelto", "Cerrado"];
    const PRIORITIES = ["Crítica", "Alta", "Media", "Baja"];
    const PRIORITY_ORDER = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
    const ACTIVE_STATUSES = new Set(["Abierto", "En progreso", "En espera"]);
    const CATEGORIES = [
        {
            id: "contrasenas",
            name: "Contraseñas y accesos",
            steps: ["Verificá que Bloq Mayús esté desactivado.", "Probá el portal de autoservicio de restablecimiento.", "Si la cuenta está bloqueada, documentá el incidente para su desbloqueo."]
        },
        {
            id: "red",
            name: "Red e internet",
            steps: ["Comprobá la conexión Wi-Fi o el cable de red.", "Verificá si otras personas tienen el mismo problema.", "Anotá la ubicación y el mensaje de error antes de escalar."]
        },
        {
            id: "hardware",
            name: "Hardware y periféricos",
            steps: ["Revisá los cables de alimentación y conexión.", "Probá el periférico en otro puerto o equipo.", "Registrá el modelo y el número de inventario."]
        },
        {
            id: "software",
            name: "Software y aplicaciones",
            steps: ["Cerrá y volvé a abrir la aplicación.", "Anotá la versión y el mensaje de error.", "Verificá si hay actualizaciones pendientes."]
        }
    ];
    const ticketList = document.getElementById("ticket-list");
    const queueMessage = document.getElementById("queue-message");
    const ticketDialog = document.getElementById("ticket-dialog");
    const detailDialog = document.getElementById("detail-dialog");
    const ticketForm = document.getElementById("ticket-form");
    const updateForm = document.getElementById("ticket-update-form");
    const agentForm = document.getElementById("agent-form");
    const filters = {
        q: document.getElementById("filter-search"),
        status: document.getElementById("filter-status"),
        priority: document.getElementById("filter-priority"),
        category: document.getElementById("filter-category"),
        assignee: document.getElementById("filter-assignee"),
        sort: document.getElementById("filter-sort")
    };
    let tickets = [];
    let agents = [];
    let activeAgent = "";
    let selectedTicketId = null;
    let currentPage = 1;
    let searchTimer = null;

    function showToast(message, isError = false) {
        const toast = document.getElementById("toast");
        toast.textContent = message;
        toast.classList.toggle("toast-error", isError);
        toast.classList.remove("hidden");
        clearTimeout(showToast.timeout);
        showToast.timeout = setTimeout(() => toast.classList.add("hidden"), 4500);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("es-AR", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function localId(prefix) {
        return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }

    function loadState() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const state = JSON.parse(stored);
            if (state.version !== 1 || !Array.isArray(state.tickets) || !Array.isArray(state.agents)) {
                throw new Error("Los datos guardados no tienen un formato compatible. Exportá una copia antes de intentar restaurarla.");
            }
            validateBackup(state);
            tickets = state.tickets;
            agents = [...new Set(state.agents.filter(agent => typeof agent === "string" && agent.trim()).map(agent => agent.trim()))];
            activeAgent = typeof state.activeAgent === "string" ? state.activeAgent : "";
        } else {
            agents = ["Agente local"];
            activeAgent = agents[0];
            migrateLegacyTickets();
            saveState();
        }
        if (!agents.length) agents = ["Agente local"];
        if (!agents.includes(activeAgent)) activeAgent = agents[0];
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: 1,
                tickets,
                agents,
                activeAgent,
                updatedAt: new Date().toISOString()
            }));
            return true;
        } catch (error) {
            console.error("No se pudieron guardar los tickets localmente:", error);
            showToast("No se pudieron guardar los cambios. Revisá el espacio disponible y los permisos del navegador.", true);
            return false;
        }
    }

    function migrateLegacyTickets() {
        const legacyData = localStorage.getItem(LEGACY_KEY);
        if (!legacyData) return;
        const oldTickets = JSON.parse(legacyData);
        if (!Array.isArray(oldTickets)) throw new Error("El historial anterior está dañado y no se pudo migrar.");
        tickets = oldTickets.map(ticket => {
            const oldStatus = String(ticket.estado || "");
            const status = oldStatus.includes("Cerrado") ? "Resuelto" : oldStatus.includes("Escalado") ? "En espera" : "Abierto";
            const category = CATEGORIES.find(item => ticket.categoria && ticket.categoria.toLowerCase().includes(item.id === "contrasenas" ? "contrase" : item.id));
            const timestamp = new Date().toISOString();
            return {
                id: localId("T"),
                publicId: typeof ticket.id === "string" ? ticket.id : localId("INC"),
                requesterName: String(ticket.usuario || "Usuario sin nombre"),
                requesterId: String(ticket.legajo || "—"),
                requesterEmail: "",
                department: "",
                categoryId: category?.id || "software",
                category: category?.name || String(ticket.categoria || "Software y aplicaciones"),
                description: String(ticket.descripcion || "Ticket migrado del historial anterior."),
                priority: PRIORITIES.includes(ticket.prioridad) ? ticket.prioridad : "Media",
                status,
                assignee: "",
                createdBy: "Agente local",
                resolution: status === "Resuelto" ? "Migrado como resuelto desde el historial anterior." : "",
                createdAt: timestamp,
                updatedAt: timestamp,
                resolvedAt: status === "Resuelto" ? timestamp : null,
                dueAt: timestamp,
                comments: [],
                activity: [{ action: "Migrado del historial anterior", actor: "Sistema local", date: timestamp }]
            };
        });
        if (tickets.length) showToast(`Se importaron ${tickets.length} tickets del historial anterior.`);
    }

    function populateSelects() {
        const currentAgentSelect = document.getElementById("active-agent");
        currentAgentSelect.replaceChildren(...agents.map(agent => new Option(agent, agent)));
        currentAgentSelect.value = activeAgent;

        for (const id of ["ticket-assignee", "detail-assignee"]) {
            const select = document.getElementById(id);
            const previous = select.value;
            select.replaceChildren(new Option("Sin asignar", ""), ...agents.map(agent => new Option(agent, agent)));
            if (agents.includes(previous)) select.value = previous;
        }

        const categoryFilter = filters.category;
        const selectedCategory = categoryFilter.value;
        categoryFilter.replaceChildren(new Option("Todas las categorías", ""), ...CATEGORIES.map(category => new Option(category.name, category.id)));
        if (CATEGORIES.some(category => category.id === selectedCategory)) categoryFilter.value = selectedCategory;

        const categorySelect = document.getElementById("ticket-category");
        categorySelect.replaceChildren(new Option("Seleccioná una categoría...", ""), ...CATEGORIES.map(category => new Option(category.name, category.id)));
        const detailCategory = document.getElementById("detail-category");
        detailCategory.replaceChildren(...CATEGORIES.map(category => new Option(category.name, category.id)));
        renderAgents();
    }

    function renderAgents() {
        const team = document.getElementById("team-list");
        team.replaceChildren();
        for (const agent of agents) {
            const row = document.createElement("div");
            row.className = "team-row";
            const name = document.createElement("strong");
            name.textContent = agent;
            const select = document.createElement("button");
            select.type = "button";
            select.className = "team-select";
            select.textContent = activeAgent === agent ? "Agente actual" : "Usar";
            select.disabled = activeAgent === agent;
            select.addEventListener("click", () => {
                activeAgent = agent;
                saveState();
                populateSelects();
                renderAll();
            });
            row.append(name, select);
            if (agents.length > 1) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "team-deactivate";
                remove.textContent = "Quitar";
                remove.setAttribute("aria-label", `Quitar agente ${agent}`);
                remove.addEventListener("click", () => removeAgent(agent));
                row.append(remove);
            }
            team.append(row);
        }
    }

    function removeAgent(agent) {
        if (tickets.some(ticket => ticket.assignee === agent)) {
            showToast("Reasigná primero los tickets pendientes de este agente.", true);
            return;
        }
        if (!confirm(`¿Quitar a ${agent} de la lista local de agentes?`)) return;
        agents = agents.filter(item => item !== agent);
        if (activeAgent === agent) activeAgent = agents[0];
        if (!saveState()) return;
        populateSelects();
        renderAll();
        showToast("Agente quitado de la lista.");
    }

    function renderTriage() {
        const category = CATEGORIES.find(item => item.id === document.getElementById("ticket-category").value);
        const box = document.getElementById("triage-box");
        const list = document.getElementById("triage-steps");
        list.replaceChildren();
        if (!category) {
            box.classList.add("hidden");
            return;
        }
        for (const step of category.steps) {
            const item = document.createElement("li");
            item.textContent = step;
            list.append(item);
        }
        box.classList.remove("hidden");
    }

    function getFilteredTickets() {
        const term = filters.q.value.trim().toLocaleLowerCase("es");
        const result = tickets.filter(ticket => {
            if (filters.status.value && ticket.status !== filters.status.value) return false;
            if (filters.priority.value && ticket.priority !== filters.priority.value) return false;
            if (filters.category.value && ticket.categoryId !== filters.category.value) return false;
            if (filters.assignee.value === "me" && ticket.assignee !== activeAgent) return false;
            if (filters.assignee.value === "unassigned" && ticket.assignee) return false;
            if (term) {
                const haystack = [
                    ticket.publicId, ticket.requesterName, ticket.requesterId, ticket.requesterEmail,
                    ticket.department, ticket.category, ticket.description, ticket.assignee,
                    ...(ticket.comments || []).map(comment => comment.body)
                ].join(" ").toLocaleLowerCase("es");
                if (!haystack.includes(term)) return false;
            }
            return true;
        });
        result.sort((left, right) => {
            switch (filters.sort.value) {
                case "newest":
                    return new Date(right.createdAt) - new Date(left.createdAt);
                case "oldest":
                    return new Date(left.createdAt) - new Date(right.createdAt);
                case "sla":
                    return new Date(left.dueAt) - new Date(right.dueAt);
                default:
                    return Number(!ACTIVE_STATUSES.has(left.status)) - Number(!ACTIVE_STATUSES.has(right.status)) ||
                        PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
                        new Date(right.updatedAt) - new Date(left.updatedAt);
            }

        });
        return result;
    }

    function statusClass(status) {
        return ({
            "Abierto": "status-open",
            "En progreso": "status-progress",
            "En espera": "status-waiting",
            "Resuelto": "status-resolved",
            "Cerrado": "status-closed"
        })[status] || "status-open";
    }

    function priorityClass(priority) {
        return ({
            "Baja": "priority-low",
            "Media": "priority-medium",
            "Alta": "priority-high",
            "Crítica": "priority-critical"
        })[priority] || "priority-medium";
    }

    function isOverdue(ticket) {
        return ACTIVE_STATUSES.has(ticket.status) && ticket.dueAt && new Date(ticket.dueAt).getTime() < Date.now();
    }

    function renderTickets() {
        const filtered = getFilteredTickets();
        const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        currentPage = Math.min(currentPage, pageCount);
        const start = (currentPage - 1) * PAGE_SIZE;
        const visible = filtered.slice(start, start + PAGE_SIZE);
        ticketList.replaceChildren();

        document.getElementById("ticket-count").textContent = filtered.length
            ? `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? "solicitud" : "solicitudes"}`
            : `${tickets.length} ${tickets.length === 1 ? "ticket guardado" : "tickets guardados"}`;
        const pagination = document.getElementById("ticket-pagination");
        pagination.classList.toggle("hidden", filtered.length <= PAGE_SIZE);
        document.getElementById("page-label").textContent = `Página ${currentPage} de ${pageCount}`;
        document.getElementById("previous-page").disabled = currentPage <= 1;
        document.getElementById("next-page").disabled = currentPage >= pageCount;
        queueMessage.classList.toggle("hidden", visible.length > 0);
        queueMessage.textContent = tickets.length && (filters.q.value || filters.status.value || filters.priority.value || filters.category.value || filters.assignee.value)
            ? "No encontramos tickets que coincidan con esos filtros."
            : "Todavía no hay tickets. Creá el primero para comenzar.";

        for (const ticket of visible) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "ticket-row";
            item.dataset.ticketId = ticket.id;
            const sla = isOverdue(ticket)
                ? '<span class="sla-label sla-overdue"><i class="fas fa-clock" aria-hidden="true"></i> Vencido</span>'
                : ACTIVE_STATUSES.has(ticket.status)
                    ? `<span class="sla-label"><i class="fas fa-clock" aria-hidden="true"></i> Límite ${escapeHtml(formatDate(ticket.dueAt))}</span>`
                    : "";
            item.innerHTML = `
                <span class="ticket-row-main">
                    <span class="ticket-row-top"><strong>${escapeHtml(ticket.publicId)}</strong><span class="ticket-badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span>${sla}</span>
                    <span class="ticket-subject">${escapeHtml(ticket.description)}</span>
                    <span class="ticket-requester">${escapeHtml(ticket.requesterName)} · ${escapeHtml(ticket.requesterId)}${ticket.department ? ` · ${escapeHtml(ticket.department)}` : ""}</span>
                    <span class="ticket-row-meta"><span>${escapeHtml(ticket.category)}</span><span class="priority-label ${priorityClass(ticket.priority)}">${escapeHtml(ticket.priority)}</span><span><i class="fas fa-user" aria-hidden="true"></i> ${escapeHtml(ticket.assignee || "Sin asignar")}</span><span><i class="fas fa-comment" aria-hidden="true"></i> ${ticket.comments?.length || 0}</span><span>${escapeHtml(formatDate(ticket.updatedAt))}</span></span>
                </span>
                <span class="ticket-row-arrow"><i class="fas fa-chevron-right" aria-hidden="true"></i></span>`;
            ticketList.append(item);
        }
    }

    function renderDashboard() {
        const active = tickets.filter(ticket => ACTIVE_STATUSES.has(ticket.status));
        const resolved = tickets.filter(ticket => ticket.status === "Resuelto").length;
        document.getElementById("metric-active").textContent = active.length;
        document.getElementById("metric-urgent").textContent = active.filter(ticket => ["Alta", "Crítica"].includes(ticket.priority)).length;
        document.getElementById("metric-unassigned").textContent = active.filter(ticket => !ticket.assignee).length;
        document.getElementById("metric-resolved").textContent = resolved;
        document.getElementById("metric-overdue").textContent = active.filter(isOverdue).length;

        const counts = CATEGORIES.map(category => ({
            name: category.name,
            count: active.filter(ticket => ticket.categoryId === category.id).length
        }));
        const max = Math.max(...counts.map(item => item.count), 1);
        const chart = document.getElementById("category-chart");
        chart.replaceChildren();
        for (const category of counts) {
            const row = document.createElement("div");
            row.className = "category-row";
            row.innerHTML = `<div class="category-label"><span>${escapeHtml(category.name)}</span><strong>${category.count}</strong></div>
                <div class="category-track"><span style="width:${Math.max(category.count ? 4 : 0, category.count / max * 100)}%"></span></div>`;
            chart.append(row);
        }
    }

    function renderAll() {
        document.getElementById("active-agent").value = activeAgent;
        renderAgents();
        renderTickets();
        renderDashboard();
    }

    function logActivity(ticket, action, field = "", previous = "", next = "") {
        ticket.activity = ticket.activity || [];
        ticket.activity.unshift({
            action,
            field,
            previous,
            next,
            actor: activeAgent,
            date: new Date().toISOString()
        });
    }

    function getSelectedTicket() {
        return tickets.find(ticket => ticket.id === selectedTicketId);
    }

    function renderDetail(ticket) {
        document.getElementById("detail-id").textContent = ticket.publicId;
        document.getElementById("detail-title").textContent = ticket.requesterName;
        document.getElementById("detail-content").innerHTML = `
            <div class="detail-grid">
                <div><span>Solicitante</span><strong>${escapeHtml(ticket.requesterName)} · ${escapeHtml(ticket.requesterId)}</strong></div>
                <div><span>Contacto</span><strong>${escapeHtml(ticket.requesterEmail || "Sin correo")}</strong></div>
                <div><span>Departamento</span><strong>${escapeHtml(ticket.department || "Sin especificar")}</strong></div>
                <div><span>Categoría</span><strong>${escapeHtml(ticket.category)}</strong></div>
                <div><span>Creado por</span><strong>${escapeHtml(ticket.createdBy)}</strong></div>
                <div><span>Creado</span><strong>${escapeHtml(formatDate(ticket.createdAt))}</strong></div>
                <div><span>Vencimiento objetivo</span><strong>${escapeHtml(formatDate(ticket.dueAt))}${isOverdue(ticket) ? " · Vencido" : ""}</strong></div>
                <div><span>Última actualización</span><strong>${escapeHtml(formatDate(ticket.updatedAt))}</strong></div>
            </div>
            <div class="detail-description"><span>Descripción</span><p>${escapeHtml(ticket.description).replace(/\n/g, "<br>")}</p></div>
            ${ticket.resolution ? `<div class="resolution-box"><span>Resolución</span><p>${escapeHtml(ticket.resolution).replace(/\n/g, "<br>")}</p></div>` : ""}`;
        document.getElementById("detail-status").value = ticket.status;
        document.getElementById("detail-priority").value = ticket.priority;
        document.getElementById("detail-assignee").value = ticket.assignee || "";
        document.getElementById("detail-resolution").value = ticket.resolution || "";
        document.getElementById("detail-requester-name").value = ticket.requesterName;
        document.getElementById("detail-requester-id").value = ticket.requesterId;
        document.getElementById("detail-requester-email").value = ticket.requesterEmail || "";
        document.getElementById("detail-department").value = ticket.department || "";
        document.getElementById("detail-category").value = ticket.categoryId;
        document.getElementById("detail-description").value = ticket.description;
        renderComments(ticket.comments || []);
        renderActivity(ticket.activity || []);
    }

    function openTicket(ticketId) {
        const ticket = tickets.find(item => item.id === ticketId);
        if (!ticket) {
            showToast("Este ticket ya no existe.", true);
            return;
        }
        selectedTicketId = ticket.id;
        renderDetail(ticket);
        detailDialog.showModal();
    }

    function renderComments(comments) {
        const list = document.getElementById("comment-list");
        list.replaceChildren();
        if (!comments.length) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "Todavía no hay notas para este ticket.";
            list.append(empty);
            return;
        }
        for (const comment of comments) {
            const item = document.createElement("article");
            item.className = "comment-item";
            item.innerHTML = `<div><strong>${escapeHtml(comment.author)}</strong><time>${escapeHtml(formatDate(comment.date))}</time></div><p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>`;
            list.append(item);
        }
    }

    function renderActivity(events) {
        const list = document.getElementById("activity-list");
        list.replaceChildren();
        for (const event of events) {
            const item = document.createElement("li");
            let change = event.action;
            if (event.field) change = `${event.field}: ${event.previous || "—"} → ${event.next || "—"}`;
            item.innerHTML = `<strong>${escapeHtml(event.actor)}</strong> ${escapeHtml(change)} <time>${escapeHtml(formatDate(event.date))}</time>`;
            list.append(item);
        }
    }

    function createTicketId() {
        let id;
        do {
            id = `INC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        } while (tickets.some(ticket => ticket.publicId === id));
        return id;
    }

    function slaHours(priority) {
        return ({ "Crítica": 4, "Alta": 8, "Media": 24, "Baja": 72 })[priority] || 24;
    }

    function createTicket(data) {
        const category = CATEGORIES.find(item => item.id === data.categoria);
        if (!data.usuario.trim() || !data.legajo.trim() || !category || !data.descripcion.trim()) {
            showToast("Completá los datos obligatorios, la categoría y la descripción.", true);
            return false;
        }
        if (!PRIORITIES.includes(data.prioridad)) {
            showToast("Elegí una prioridad válida.", true);
            return false;
        }
        const createdAt = new Date();
        const dueAt = new Date(createdAt.getTime() + slaHours(data.prioridad) * 60 * 60 * 1000);
        const ticket = {
            id: localId("T"),
            publicId: createTicketId(),
            requesterName: data.usuario.trim(),
            requesterId: data.legajo.trim(),
            requesterEmail: data.email.trim(),
            department: data.departamento.trim(),
            categoryId: category.id,
            category: category.name,
            description: data.descripcion.trim(),
            priority: data.prioridad,
            status: "Abierto",
            assignee: data.asignado_a || "",
            createdBy: activeAgent,
            resolution: "",
            createdAt: createdAt.toISOString(),
            updatedAt: createdAt.toISOString(),
            resolvedAt: null,
            dueAt: dueAt.toISOString(),
            comments: [],
            activity: [{ action: "Creó el ticket", actor: activeAgent, date: createdAt.toISOString() }]
        };
        tickets.unshift(ticket);
        if (!saveState()) {
            tickets.shift();
            return false;
        }
        return true;
    }

    function updateTicket(data) {
        const ticket = getSelectedTicket();
        if (!ticket) return false;
        const category = CATEGORIES.find(item => item.id === data.categoria);
        const requesterName = data.usuario.trim();
        const requesterId = data.legajo.trim();
        const requesterEmail = data.email.trim();
        const department = data.departamento.trim();
        const description = data.descripcion.trim();
        if (!requesterName || !requesterId || !category || !description ||
            (requesterEmail && !document.getElementById("detail-requester-email").validity.valid)) {
            showToast("Revisá el nombre, legajo, correo, categoría y descripción del ticket.", true);
            return false;
        }
        if (!STATUSES.includes(data.estado) || !PRIORITIES.includes(data.prioridad)) {
            showToast("Elegí un estado y una prioridad válidos.", true);
            return false;
        }
        if (data.asignado_a && !agents.includes(data.asignado_a)) {
            showToast("El agente asignado ya no está disponible.", true);
            return false;
        }
        const resolution = data.resolucion.trim();
        if (["Resuelto", "Cerrado"].includes(data.estado) && !resolution) {
            showToast("Agregá una resolución antes de resolver o cerrar el ticket.", true);
            document.getElementById("detail-resolution").focus();
            return false;
        }
        const before = JSON.parse(JSON.stringify(ticket));
        const updates = [
            ["Solicitante", "requesterName", requesterName],
            ["Legajo", "requesterId", requesterId],
            ["Correo", "requesterEmail", requesterEmail],
            ["Departamento", "department", department],
            ["Descripción", "description", description],
            ["Estado", "status", data.estado],
            ["Prioridad", "priority", data.prioridad],
            ["Agente", "assignee", data.asignado_a || ""],
            ["Resolución", "resolution", resolution]
        ];
        if (ticket.categoryId !== category.id) {
            logActivity(ticket, "Actualizó el ticket", "Categoría", ticket.category, category.name);
            ticket.categoryId = category.id;
            ticket.category = category.name;
        }
        for (const [label, key, value] of updates) {
            if ((ticket[key] || "") === value) continue;
            logActivity(ticket, "Actualizó el ticket", label, ticket[key] || "", value);
            ticket[key] = value;
        }
        if (ticket.priority !== before.priority) {
            const dueAt = new Date(new Date(ticket.createdAt).getTime() + slaHours(ticket.priority) * 60 * 60 * 1000).toISOString();
            if (ticket.dueAt !== dueAt) {
                logActivity(ticket, "Actualizó el ticket", "Vencimiento objetivo", ticket.dueAt, dueAt);
                ticket.dueAt = dueAt;
            }
        }
        if (["Resuelto", "Cerrado"].includes(ticket.status)) {
            ticket.resolvedAt = ticket.resolvedAt || new Date().toISOString();
        } else {
            ticket.resolvedAt = null;
        }
        ticket.updatedAt = new Date().toISOString();
        if (!saveState()) {
            Object.assign(ticket, before);
            return false;
        }
        return true;
    }

    function addComment(body) {
        const ticket = getSelectedTicket();
        const text = body.trim();
        if (!ticket || !text) return false;
        const previousUpdated = ticket.updatedAt;
        const comment = { id: localId("N"), body: text, author: activeAgent, date: new Date().toISOString() };
        ticket.comments = ticket.comments || [];
        ticket.comments.unshift(comment);
        ticket.updatedAt = comment.date;
        logActivity(ticket, "Agregó una nota");
        if (!saveState()) {
            ticket.comments.shift();
            ticket.updatedAt = previousUpdated;
            ticket.activity.shift();
            return false;
        }
        return true;
    }

    function csvCell(value) {
        let text = String(value == null ? "" : value);
        if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    function downloadFile(name, content, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportCsv() {
        const visible = getFilteredTickets();
        const headers = ["ID", "Fecha de creación", "Última actualización", "Vencimiento", "Solicitante", "Legajo", "Correo", "Departamento", "Categoría", "Prioridad", "Estado", "Agente", "Descripción", "Resolución", "Notas"];
        const rows = visible.map(ticket => [
            ticket.publicId, ticket.createdAt, ticket.updatedAt, ticket.dueAt, ticket.requesterName,
            ticket.requesterId, ticket.requesterEmail, ticket.department, ticket.category,
            ticket.priority, ticket.status, ticket.assignee, ticket.description, ticket.resolution,
            (ticket.comments || []).map(comment => `${comment.author}: ${comment.body}`).join(" | ")
        ]);
        downloadFile(`tickets_${new Date().toISOString().slice(0, 10)}.csv`,
            `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}`,
            "text/csv;charset=utf-8");
        showToast(`Se exportaron ${visible.length} tickets.`);
    }

    function exportBackup() {
        downloadFile(`helpdesk_backup_${new Date().toISOString().slice(0, 10)}.json`,
            JSON.stringify({ product: "HelpDesk Local", version: 1, exportedAt: new Date().toISOString(), tickets, agents, activeAgent }, null, 2),
            "application/json");
        showToast("Copia de seguridad descargada.");
    }

    function validateBackup(data) {
        if (!data || data.version !== 1 || !Array.isArray(data.tickets) || !Array.isArray(data.agents)) {
            throw new Error("El archivo no es una copia de HelpDesk compatible.");
        }
        if (data.tickets.length > 50000 || data.agents.length > 500) {
            throw new Error("La copia supera el límite de importación.");
        }
        const ids = new Set();
        const publicIds = new Set();
        for (const ticket of data.tickets) {
            if (!ticket || typeof ticket.id !== "string" || ids.has(ticket.id) ||
                typeof ticket.publicId !== "string" || !ticket.publicId.trim() || publicIds.has(ticket.publicId) ||
                typeof ticket.requesterName !== "string" || ticket.requesterName.length > 120 ||
                typeof ticket.requesterId !== "string" || ticket.requesterId.length > 40 ||
                typeof ticket.requesterEmail !== "string" || ticket.requesterEmail.length > 254 ||
                typeof ticket.department !== "string" || ticket.department.length > 100 ||
                typeof ticket.description !== "string" || ticket.description.length > 10000 ||
                !ticket.description.trim() || !STATUSES.includes(ticket.status) ||
                !PRIORITIES.includes(ticket.priority) || !CATEGORIES.some(category => category.id === ticket.categoryId) ||
                !Number.isFinite(Date.parse(ticket.createdAt)) || !Number.isFinite(Date.parse(ticket.updatedAt)) ||
                !Number.isFinite(Date.parse(ticket.dueAt)) ||
                !Array.isArray(ticket.comments) || ticket.comments.length > 10000 ||
                !ticket.comments.every(comment => comment && typeof comment.body === "string" &&
                    comment.body.length <= 5000 && typeof comment.author === "string" &&
                    typeof comment.date === "string" && Number.isFinite(Date.parse(comment.date))) ||
                !Array.isArray(ticket.activity) || ticket.activity.length > 20000 ||
                !ticket.activity.every(entry => entry &&
                    typeof entry.action === "string" && typeof entry.actor === "string" &&
                    typeof entry.date === "string" && Number.isFinite(Date.parse(entry.date)))) {
                throw new Error("La copia contiene un ticket inválido o duplicado.");
            }
            ids.add(ticket.id);
            publicIds.add(ticket.publicId);
        }
        if (!data.agents.every(agent => typeof agent === "string" && agent.trim().length <= 80)) {
            throw new Error("La copia contiene un nombre de agente inválido.");
        }
    }

    async function importBackup(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast("La copia supera el límite de 10 MB.", true);
            return;
        }
        try {
            const data = JSON.parse(await file.text());
            validateBackup(data);
            if (!confirm(`La copia contiene ${data.tickets.length} tickets y ${data.agents.length} agentes. Reemplazará los datos locales actuales. ¿Continuar?`)) return;
            const previous = { tickets, agents, activeAgent };
            tickets = data.tickets;
            agents = [...new Set(data.agents.map(agent => agent.trim()).filter(Boolean))];
            if (!agents.length) agents = ["Agente local"];
            activeAgent = agents.includes(data.activeAgent) ? data.activeAgent : agents[0];
            if (!saveState()) {
                tickets = previous.tickets;
                agents = previous.agents;
                activeAgent = previous.activeAgent;
                return;
            }
            currentPage = 1;
            populateSelects();
            renderAll();
            showToast("Copia restaurada.");
        } catch (error) {
            showToast(`No se pudo restaurar la copia: ${error.message}`, true);
        } finally {
            document.getElementById("restore-file").value = "";
        }
    }

    document.getElementById("new-ticket-button").addEventListener("click", () => ticketDialog.showModal());
    document.getElementById("refresh-button").addEventListener("click", () => {
        try {
            const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (state) {
                validateBackup(state);
                tickets = state.tickets;
                agents = state.agents;
                activeAgent = state.activeAgent;
                populateSelects();
            }
            renderAll();
            showToast("Vista actualizada.");
        } catch (error) {
            showToast(`No se pudieron leer los datos locales: ${error.message}`, true);
        }
    });
    document.getElementById("export-button").addEventListener("click", exportCsv);
    document.getElementById("backup-button").addEventListener("click", exportBackup);
    document.getElementById("restore-button").addEventListener("click", () => document.getElementById("restore-file").click());
    document.getElementById("restore-file").addEventListener("change", event => importBackup(event.target.files[0]));
    document.getElementById("ticket-category").addEventListener("change", renderTriage);
    document.getElementById("active-agent").addEventListener("change", event => {
        const previousAgent = activeAgent;
        activeAgent = event.target.value;
        if (saveState()) {
            renderAll();
        } else {
            activeAgent = previousAgent;
            event.target.value = previousAgent;
        }
    });

    for (const select of [filters.status, filters.priority, filters.category, filters.assignee, filters.sort]) {
        select.addEventListener("change", () => {
            currentPage = 1;
            renderTickets();
        });
    }
    filters.q.addEventListener("input", () => {
        clearTimeout(searchTimer);
        currentPage = 1;
        searchTimer = setTimeout(renderTickets, 150);
    });
    document.getElementById("previous-page").addEventListener("click", () => {
        currentPage = Math.max(1, currentPage - 1);
        renderTickets();
    });
    document.getElementById("next-page").addEventListener("click", () => {
        currentPage += 1;
        renderTickets();
    });

    ticketList.addEventListener("click", event => {
        const ticket = event.target.closest("[data-ticket-id]");
        if (ticket) openTicket(ticket.dataset.ticketId);
    });

    ticketForm.addEventListener("submit", event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(ticketForm));
        if (!createTicket(data)) return;
        ticketForm.reset();
        renderTriage();
        ticketDialog.close();
        currentPage = 1;
        renderAll();
        showToast("Ticket guardado en este dispositivo.");
    });

    updateForm.addEventListener("submit", event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(updateForm));
        if (!updateTicket(data)) return;
        renderDetail(getSelectedTicket());
        renderAll();
        showToast("Cambios guardados.");
    });

    document.getElementById("comment-form").addEventListener("submit", event => {
        event.preventDefault();
        const textarea = document.getElementById("comment-body");
        if (!addComment(textarea.value)) return;
        textarea.value = "";
        renderDetail(getSelectedTicket());
        renderAll();
        showToast("Nota agregada al historial.");
    });

    agentForm.addEventListener("submit", event => {
        event.preventDefault();
        const input = document.getElementById("agent-name");
        const name = input.value.trim().replace(/\s+/g, " ");
        if (!name || name.length > 80) {
            showToast("Ingresá un nombre de agente de hasta 80 caracteres.", true);
            return;
        }
        if (agents.some(agent => agent.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
            showToast("Ese agente ya está en la lista.", true);
            return;
        }
        agents.push(name);
        if (!saveState()) {
            agents.pop();
            return;
        }
        input.value = "";
        populateSelects();
        renderAll();
        showToast("Agente local agregado.");
    });

    document.getElementById("delete-ticket-button").addEventListener("click", () => {
        const ticket = getSelectedTicket();
        if (!ticket || !confirm(`¿Eliminar permanentemente el ticket ${ticket.publicId} y sus notas? Esta acción no se puede deshacer.`)) return;
        const index = tickets.findIndex(item => item.id === selectedTicketId);
        const [deleted] = tickets.splice(index, 1);
        if (!saveState()) {
            tickets.splice(index, 0, deleted);
            return;
        }
        selectedTicketId = null;
        detailDialog.close();
        renderAll();
        showToast("Ticket eliminado.");
    });

    document.getElementById("clear-tickets-button").addEventListener("click", () => {
        if (!tickets.length) {
            showToast("No hay tickets para borrar.");
            return;
        }
        if (!confirm(`¿Borrar los ${tickets.length} tickets guardados, incluidas todas las notas y actividad? Descargá una copia antes si necesitás conservarlos.`)) return;
        const previous = tickets;
        tickets = [];
        if (!saveState()) {
            tickets = previous;
            return;
        }
        currentPage = 1;
        renderAll();
        showToast("Se borraron los tickets locales.");
    });

    document.querySelectorAll("[data-close-dialog]").forEach(button => {
        button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close());
    });
    for (const dialog of [ticketDialog, detailDialog]) {
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });
    }

    window.addEventListener("storage", event => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        try {
            const state = JSON.parse(event.newValue);
            validateBackup(state);
            tickets = state.tickets;
            agents = state.agents;
            activeAgent = state.activeAgent;
            populateSelects();
            renderAll();
            showToast("Los datos se actualizaron desde otra pestaña de este navegador.");
        } catch (error) {
            showToast(`No se pudo sincronizar la otra pestaña: ${error.message}`, true);
        }
    });

    try {
        loadState();
        populateSelects();
        renderAll();
    } catch (error) {
        showToast(`No se pudieron cargar los datos locales: ${error.message}`, true);
        console.error("Error al iniciar HelpDesk Local:", error);
    }

    window.setInterval(() => {
        if (!document.hidden) {
            renderTickets();
            renderDashboard();
        }
    }, 60 * 1000);
});
