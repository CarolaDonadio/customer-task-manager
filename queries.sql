USE helpdesk_db;

-- Cola operativa: tickets activos, ordenados por prioridad y última actualización.
SELECT
    t.public_id AS ticket,
    t.requester_name AS solicitante,
    t.requester_identifier AS legajo,
    c.name AS categoria,
    t.priority AS prioridad,
    t.status AS estado,
    COALESCE(a.name, 'Sin asignar') AS agente,
    t.created_at AS creado,
    t.updated_at AS actualizado
FROM tickets t
JOIN categories c ON c.id = t.category_id
LEFT JOIN users a ON a.id = t.assigned_to
WHERE t.status NOT IN ('Resuelto', 'Cerrado')
ORDER BY FIELD(t.priority, 'Crítica', 'Alta', 'Media', 'Baja'), t.created_at;

-- Volumen y estado por categoría.
SELECT c.name AS categoria, t.status AS estado, COUNT(*) AS tickets
FROM tickets t
JOIN categories c ON c.id = t.category_id
GROUP BY c.id, c.name, t.status
ORDER BY c.name, t.status;

-- Carga de trabajo por agente.
SELECT u.name AS agente, t.status AS estado, COUNT(*) AS tickets
FROM users u
LEFT JOIN tickets t ON t.assigned_to = u.id
WHERE u.is_active = 1
GROUP BY u.id, u.name, t.status
ORDER BY u.name, t.status;

-- Historial de cambios y notas de un ticket.
SELECT e.created_at AS fecha, u.name AS agente, e.action AS accion,
       e.field_name AS campo, e.old_value AS valor_anterior, e.new_value AS valor_nuevo
FROM ticket_events e
JOIN users u ON u.id = e.actor_id
JOIN tickets t ON t.id = e.ticket_id
WHERE t.public_id = 'INC-2026-REEMPLAZAR';

-- Duración promedio de resolución, por prioridad.
SELECT priority AS prioridad,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at))) AS minutos_promedio,
       COUNT(*) AS tickets_resueltos
FROM tickets
WHERE resolved_at IS NOT NULL
GROUP BY priority
ORDER BY FIELD(priority, 'Crítica', 'Alta', 'Media', 'Baja');
