# HelpDesk · Mesa de ayuda local

HelpDesk es una ticketera local para registrar y organizar el trabajo diario de soporte. No requiere instalar Node, configurar MySQL, crear cuentas ni conectarse a un servidor.

## Uso

1. Abrí `customer-task-manager/index.html` en un navegador actualizado.
2. Elegí el agente local activo en la parte superior. En **Agentes locales** podés agregar, seleccionar o quitar nombres.
3. Creá tickets y gestioná la cola desde esa misma pantalla.

## Funcionalidades

- Registro de solicitantes, categoría, prioridad, contacto, departamento y detalle del incidente.
- Guías de triage específicas por categoría.
- Estados **Abierto**, **En progreso**, **En espera**, **Resuelto** y **Cerrado**.
- Asignación local de responsables y registro obligatorio de resolución antes de resolver o cerrar.
- Notas internas, historial de cambios, reactivación y eliminación confirmada de tickets.
- Vencimientos orientativos según prioridad: crítica 4 h, alta 8 h, media 24 h y baja 72 h. Los plazos se pueden ajustar en `customer-task-manager/script.js`.
- Métricas de actividad, vencimientos, prioridades y categorías.
- Búsqueda, filtros combinables, ordenamiento, paginación y exportación CSV.
- Copia de seguridad JSON y restauración validada.
- Migración automática del historial del navegador del prototipo anterior.

## Datos y límites de uso

Los tickets, los agentes y las notas se guardan en `localStorage` del navegador. La información persiste después de cerrar la pestaña en el mismo perfil del mismo navegador. No se sincroniza entre computadoras o navegadores ni es una base compartida por varias personas. Para cambiar de dispositivo, descargá una copia JSON y restaurala allí.

Los nombres de agentes son etiquetas de trabajo, **no son cuentas ni autenticación**; cualquiera con acceso a este perfil del navegador puede ver y modificar los tickets. No ingreses información sensible si el dispositivo o el perfil del navegador no son de uso controlado.

Las copias de seguridad contienen todos los datos. Guardalas en un lugar autorizado y protegé el acceso a esos archivos.

## Archivos SQL

`customer-task-manager/helpdesk_db.sql` y `customer-task-manager/queries.sql` son referencias MySQL heredadas; la aplicación local no los utiliza.
