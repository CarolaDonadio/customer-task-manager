// Espera a que el contenido del DOM esté completamente cargado antes de ejecutar el script.
document.addEventListener('DOMContentLoaded', () => {
    // --- Almacenamiento de elementos del DOM para mayor eficiencia ---
    const nombreInput = document.getElementById("nombre");
    const legajoInput = document.getElementById("legajo");
    const categoriaSelect = document.getElementById("categoria");
    const prioridadSelect = document.getElementById("prioridad");
    const seccionTriage = document.getElementById("seccion-triage");
    const pasosLista = document.getElementById("pasos-lista");
    const descripcionTextarea = document.getElementById("descripcion");
    const solucionSiRadio = document.getElementById("sol-si");
    const solucionNoRadio = document.getElementById("sol-no");
    const resultadoTicketDiv = document.getElementById("resultado-ticket");
    const seccionHistorial = document.getElementById("seccion-historial");
    const seccionDashboard = document.getElementById("seccion-dashboard");
    const graficoCategoriasDiv = document.getElementById("grafico-categorias");
    const generarTicketBtn = document.getElementById("btn-generar-ticket");
    const historialTicketsDiv = document.getElementById("historial-tickets");
    const limpiarHistorialBtn = document.getElementById("btn-limpiar-historial");
    const exportarCsvBtn = document.getElementById("btn-exportar-csv");
    const historialSearchInput = document.getElementById("historial-search");

    // --- Base de conocimiento ---
    const baseConocimiento = {
        contrasenas: [
            "Verifica que el Bloq Mayús esté desactivado.",
            "Intenta ingresar al portal de autoservicio de restablecimiento.",
            "Si el usuario está bloqueado en AD, genera ticket de desbloqueo."
        ],
        red: [
            "Desconecta y vuelve a conectar el cable de red o reinicia el Wi-Fi.",
            "Ejecuta el comando 'ipconfig /renew' en la terminal.",
            "Verifica si el proxy de la empresa está activo."
        ],
        hardware: [
            "Asegúrate de que los cables de alimentación y video estén firmes.",
            "Prueba el periférico en otro puerto USB.",
            "Reinicia el equipo para cargar los controladores nuevamente."
        ],
        software: [
            "Cierra y vuelve a abrir la aplicación afectada.",
            "Verifica si hay actualizaciones pendientes para el software o el sistema operativo.",
            "Intenta reiniciar la computadora para resolver conflictos temporales."
        ]
    };

    // --- Funciones de la aplicación ---

    /**
     * Muestra los pasos de resolución según la categoría seleccionada.
     */
    function actualizarTriage() {
        const categoriaSeleccionada = categoriaSelect.value;
        
        // Limpiamos la lista anterior de forma segura y eficiente.
        pasosLista.innerHTML = "";

        if (categoriaSeleccionada && baseConocimiento[categoriaSeleccionada]) {
            // Usamos un fragmento de documento para mejorar el rendimiento al añadir elementos.
            const fragment = document.createDocumentFragment();
            baseConocimiento[categoriaSeleccionada].forEach(paso => {
                const li = document.createElement("li");
                li.textContent = paso;
                fragment.appendChild(li);
            });
            pasosLista.appendChild(fragment);
            seccionTriage.classList.remove("hidden");
        } else {
            seccionTriage.classList.add("hidden");
        }
        // Ocultar ticket anterior si se cambia la categoría.
        resultadoTicketDiv.classList.add("hidden");
    }

    /**
     * Limpia todos los campos del formulario y lo restablece a su estado inicial.
     */
    function limpiarFormulario() {
        nombreInput.value = '';
        legajoInput.value = '';
        categoriaSelect.value = '';
        prioridadSelect.value = 'Baja'; // Restablecer al valor por defecto
        descripcionTextarea.value = '';
        solucionSiRadio.checked = true;

        seccionTriage.classList.add('hidden');
        pasosLista.innerHTML = '';
        nombreInput.focus(); // Pone el foco en el primer campo para el siguiente ticket.
    }

    /**
     * Renderiza el dashboard, incluyendo el gráfico de categorías.
     */
    function renderizarDashboard() {
        const historial = JSON.parse(localStorage.getItem('historialTickets')) || [];

        if (historial.length === 0) {
            seccionDashboard.classList.add('hidden');
            return;
        }

        seccionDashboard.classList.remove('hidden');

        // Contar tickets por categoría
        const conteoCategorias = historial.reduce((acc, ticket) => {
            const categoria = ticket.categoria.split(' ')[0]; // Tomar la primera palabra como clave (Ej. "Problemas" -> "Problemas")
            acc[categoria] = (acc[categoria] || 0) + 1;
            return acc;
        }, {});

        const categorias = Object.keys(conteoCategorias);
        const valores = Object.values(conteoCategorias);
        const maxValor = Math.max(...valores, 1); // Evitar división por cero

        graficoCategoriasDiv.innerHTML = '';
        const fragment = document.createDocumentFragment();

        categorias.forEach((categoria, index) => {
            const valor = valores[index];
            const alturaPorcentaje = (valor / maxValor) * 100;

            const grupoBarra = document.createElement('div');
            grupoBarra.className = 'grafico-barra-grupo';
            grupoBarra.innerHTML = `
                <div class="grafico-barra" style="height: ${alturaPorcentaje}%;" title="${categoria}: ${valor} tickets">
                    ${valor}
                </div>
                <div class="grafico-barra-etiqueta">${categoria}</div>
            `;
            fragment.appendChild(grupoBarra);
        });

        graficoCategoriasDiv.appendChild(fragment);
    }

    /**
     * Renderiza la lista de tickets guardados en localStorage.
     */
    function renderizarHistorial() {
        const historialCompleto = JSON.parse(localStorage.getItem('historialTickets')) || [];
        const searchTerm = historialSearchInput.value.toLowerCase().trim();

        const historialFiltrado = historialCompleto.filter(ticket => {
            if (!searchTerm) return true; // Si no hay búsqueda, mostrar todo.

            // Comprobar si el término de búsqueda está en alguno de los campos relevantes.
            return (
                ticket.id.toLowerCase().includes(searchTerm) ||
                ticket.usuario.toLowerCase().includes(searchTerm) ||
                ticket.legajo.toLowerCase().includes(searchTerm) ||
                ticket.categoria.toLowerCase().includes(searchTerm)
            );
        });

        historialTicketsDiv.innerHTML = '';

        if (historialCompleto.length > 0) { // Mostrar la sección si hay CUALQUIER ticket, incluso si no coincide con la búsqueda.
            seccionHistorial.classList.remove('hidden');
            const fragment = document.createDocumentFragment();
            // Iterar en orden inverso para mostrar los más nuevos primero.
            historialFiltrado.slice().reverse().forEach(ticket => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'historial-item';
                const estadoClass = ticket.estado.includes('Cerrado') ? 'estado-cerrado' : 'estado-escalado';

                itemDiv.innerHTML = `
                    <strong>ID:</strong> ${ticket.id} | <strong>Usuario:</strong> ${ticket.usuario} (Legajo: ${ticket.legajo})<br>
                    <strong>Categoría:</strong> ${ticket.categoria}<br>
                    <strong>Estado:</strong> <span class="${estadoClass}">${ticket.estado}</span>
                    <div class="historial-item-footer">Registrado el: ${ticket.fecha}</div>
                `;
                fragment.appendChild(itemDiv);
            });
            historialTicketsDiv.appendChild(fragment);

            // Mostrar un mensaje si no hay resultados para la búsqueda actual.
            if (historialFiltrado.length === 0 && searchTerm) {
                historialTicketsDiv.innerHTML = '<p>No se encontraron tickets que coincidan con la búsqueda.</p>';
            }
        } else {
            seccionHistorial.classList.add('hidden');
        }
        renderizarDashboard(); // Actualizar el dashboard cada vez que el historial cambie.
    }

    /**
     * Guarda un ticket en localStorage y actualiza la UI.
     * @param {object} ticketData - El objeto del ticket a guardar.
     */
    function guardarTicketEnHistorial(ticketData) {
        const historial = JSON.parse(localStorage.getItem('historialTickets')) || [];
        historial.push(ticketData);
        localStorage.setItem('historialTickets', JSON.stringify(historial));
        renderizarHistorial();
    }

    /**
     * Limpia el historial de tickets del localStorage y de la vista.
     */
    function limpiarHistorial() {
        if (confirm('¿Estás seguro de que deseas borrar todo el historial de tickets? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('historialTickets');
            renderizarHistorial();
            resultadoTicketDiv.classList.add('hidden'); // Oculta también el último ticket generado
        }
    }

    /**
     * Exporta el historial de tickets a un archivo CSV.
     */
    function exportarHistorialACsv() {
        const historial = JSON.parse(localStorage.getItem('historialTickets')) || [];
        if (historial.length === 0) {
            alert("No hay historial para exportar.");
            return;
        }

        // Función para escapar comillas y manejar comas en los campos
        const escaparCampo = (campo) => {
            let campoStr = String(campo || '');
            campoStr = campoStr.replace(/"/g, '""'); // Escapar comillas dobles
            if (campoStr.includes(',') || campoStr.includes('\n') || campoStr.includes('"')) {
                campoStr = `"${campoStr}"`; // Envolver en comillas
            }
            return campoStr;
        };

        const headers = ['ID Ticket', 'Fecha', 'Usuario', 'Legajo', 'Categoría', 'Prioridad', 'Descripción', 'Estado'];
        const csvRows = [headers.join(',')];

        historial.forEach(ticket => {
            const row = [
                escaparCampo(ticket.id),
                escaparCampo(ticket.fecha),
                escaparCampo(ticket.usuario),
                escaparCampo(ticket.legajo),
                escaparCampo(ticket.categoria),
                escaparCampo(ticket.prioridad),
                escaparCampo(ticket.descripcion),
                escaparCampo(ticket.estado)
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `historial_tickets_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Crea el objeto de datos del ticket.
     */
    function crearDatosTicket(id, fecha, nombre, legajo, categoria, prioridad, descripcion, estado) {
        return {
            id,
            fecha,
            usuario: nombre,
            legajo,
            categoria,
            prioridad,
            descripcion,
            estado
        };
    }

    /**
     * Valida los datos y genera el ticket en la interfaz.
     */
    function generarTicket() {
        const nombre = nombreInput.value.trim();
        const legajo = legajoInput.value.trim();

        if (!nombre || !legajo) {
            alert("⚠️ Por favor, completa los datos del usuario primero.");
            return;
        }

        // Validación para asegurar que el legajo contenga solo números.
        if (!/^\d+$/.test(legajo)) {
            alert("⚠️ El campo 'ID de Empleado' solo debe contener números.");
            legajoInput.focus(); // Opcional: Pone el foco en el campo para facilitar la corrección.
            return;
        }

        const categoriaTexto = categoriaSelect.options[categoriaSelect.selectedIndex].text;
        const prioridad = prioridadSelect.value;
        const descripcion = descripcionTextarea.value.trim();
        const seSoluciono = solucionSiRadio.checked;

        // Validación condicional: si el problema no se solucionó, la descripción es obligatoria.
        if (!seSoluciono && !descripcion) {
            alert("⚠️ Para escalar el ticket, la descripción detallada es obligatoria.");
            descripcionTextarea.focus();
            return;
        }

        const idTicket = `INC-${Math.floor(10000 + Math.random() * 90000)}`;
        const fecha = new Date().toLocaleString('es-ES');
        const estado = seSoluciono ? "Cerrado - Resuelto en N1" : "Escalado - Requiere N2";

        // Crear el objeto del ticket
        const ticketData = crearDatosTicket(idTicket, fecha, nombre, legajo, categoriaTexto, prioridad, descripcion, estado);

        // Guardar en el historial
        guardarTicketEnHistorial(ticketData);

        const ticketHTML = `
            <h3><i class="fas fa-file-alt"></i> TICKET GENERADO</h3>
            <strong>TICKET ID:</strong> ${idTicket} <button class="btn-copy" data-ticket-id="${idTicket}">Copiar</button><br>
            <strong>FECHA:</strong> ${fecha}<br>
            <strong>USUARIO:</strong> ${nombre} (Legajo: ${legajo})<br>
            <strong>CATEGORÍA:</strong> ${categoriaTexto}<br>
            <strong>PRIORIDAD:</strong> ${prioridad}<br>
            <strong>DESCRIPCIÓN:</strong> ${ticketData.descripcion || 'No se proporcionó descripción.'}<br>
            <strong>ESTADO FINAL:</strong> ${estado}
        `;

        resultadoTicketDiv.innerHTML = ticketHTML;
        resultadoTicketDiv.classList.remove("hidden");

        // Scroll suave hacia el ticket generado.
        resultadoTicketDiv.scrollIntoView({ behavior: 'smooth' });

        // Limpiar el formulario para el siguiente ticket.
        limpiarFormulario();
    }


    // --- Inicialización ---
    renderizarHistorial(); // Cargar el historial al iniciar la página.

    // --- Asignación de Eventos ---
    categoriaSelect.addEventListener('change', actualizarTriage);
    generarTicketBtn.addEventListener('click', generarTicket);
    limpiarHistorialBtn.addEventListener('click', limpiarHistorial);
    exportarCsvBtn.addEventListener('click', exportarHistorialACsv);
    historialSearchInput.addEventListener('input', renderizarHistorial); // Filtrar al escribir.

    // Usar delegación de eventos para el botón de copiar que se crea dinámicamente.
    resultadoTicketDiv.addEventListener('click', (e) => {
        // Comprobar si el elemento clickeado es el botón de copiar.
        if (e.target.classList.contains('btn-copy')) {
            const ticketId = e.target.dataset.ticketId;
            navigator.clipboard.writeText(ticketId).then(() => {
                // Feedback visual para el usuario.
                e.target.textContent = '¡Copiado!';
                e.target.classList.add('copiado');
                setTimeout(() => {
                    e.target.textContent = 'Copiar';
                    e.target.classList.remove('copiado');
                }, 2000); // Restablecer después de 2 segundos.
            }).catch(err => {
                console.error('Error al copiar el ID del ticket: ', err);
                alert('No se pudo copiar el ID.');
            });
        }
    });
});