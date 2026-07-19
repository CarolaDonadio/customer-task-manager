-- 1. Crear la base de datos (por si el hosting no te la da creada)
-- CREATE DATABASE IF NOT EXISTS helpdesk_db;
USE helpdesk_db;

-- ========================================================
-- 1. TABLA DE USUARIOS (Empleados)
-- ========================================================
CREATE TABLE usuarios (
    usuario_legajo VARCHAR(20) PRIMARY KEY, -- 'EMP-4421' (Clave Primaria)
    usuario_nombre VARCHAR(100) NOT NULL,
    departamento VARCHAR(50) NOT NULL      -- Ej: 'Finanzas', 'RRHH', 'IT'
);

-- ========================================================
-- 2. TABLA DE CATEGORÍAS (de Incidencias)
-- ========================================================
CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL,
    procedimiento_triage TEXT NOT NULL     -- Pasos de resolución rápida N1
);

-- ========================================================
-- 3. TABLA CENTRAL DE TICKETS
-- ========================================================
CREATE TABLE tickets (
    id_ticket VARCHAR(10) PRIMARY KEY,          -- 'INC-48219'[cite: 3]
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion DATETIME NULL,               -- Para métricas de SLA
    
    -- Claves Foráneas (Relaciones)
    usuario_legajo VARCHAR(20) NOT NULL,        -- Conecta con tabla 'usuarios'
    id_categoria INT NOT NULL,                  -- Conecta con tabla 'categorias'
    
    descripcion_problema TEXT NOT NULL,           -- Detalle del incidente
    prioridad VARCHAR(10) NOT NULL,             -- 'Alta', 'Media', 'Baja'[cite: 3]
    estado VARCHAR(50) NOT NULL,                -- 'Cerrado', 'Escalado', 'En Proceso'
    agente_asignado VARCHAR(100) NULL,            -- Técnico que atiende el caso
    grupo_resolutor VARCHAR(50) DEFAULT 'Nivel 1',-- Ruta de escalamiento
    resolucion_automatica TINYINT(1) DEFAULT 0,  -- 1 = Resuelto por bot, 0 = No[cite: 3]
    tiempo_resolucion_minutos INT NULL,          -- Métrica numérica para Data Science
    
    -- Definición explícita de las relaciones de integridad
    FOREIGN KEY (usuario_legajo) REFERENCES usuarios(usuario_legajo),
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
);


-- Insertar Usuarios de la empresa
INSERT INTO usuarios (usuario_legajo, usuario_nombre, departamento) VALUES 
('EMP-4421', 'Esteban Quito', 'Finanzas'),
('EMP-9022', 'Ana Conda', 'Recursos Humanos'),
('EMP-1102', 'Aquiles Baeza', 'Operaciones');

-- Insertar Categorías y sus guías automáticas
INSERT INTO categorias (nombre_categoria, procedimiento_triage) VALUES 
('Contraseñas y Accesos', '1. Verificar Bloq Mayús. 2. Usar portal de autoservicio. 3. Desbloquear en Active Directory.'),
('Red y Conectividad', '1. Recomendar reconexión de cable/Wi-Fi. 2. Comando ipconfig /renew. 3. Validar Proxy corporativo.'),
('Hardware y Periféricos', '1. Revisar cables de poder/video. 2. Probar en otro puerto USB. 3. Reiniciar equipo.');

-- Insertar los Tickets asociando los Legajos y los IDs de categoría correctos
INSERT INTO tickets 
(id_ticket, fecha_creacion, fecha_resolucion, usuario_legajo, id_categoria, descripcion_problema, prioridad, estado, agente_asignado, grupo_resolutor, resolucion_automatica, tiempo_resolucion_minutos)
VALUES 
('INC-48219', '2026-07-14 09:00:00', '2026-07-14 09:15:00', 'EMP-4421', 2, 'No puede navegar en páginas externas, intranet funciona.', 'Alta', 'Cerrado - Resuelto en N1', 'HelpDeskBot', 'Nivel 1', 1, 15),
('INC-10553', '2026-07-14 10:15:00', '2026-07-14 10:20:00', 'EMP-9022', 1, 'Usuario bloqueado tras ingresar mal la clave 3 veces.', 'Media', 'Cerrado - Resuelto en N1', 'HelpDeskBot', 'Nivel 1', 1, 5),
('INC-99281', '2026-07-14 11:00:00', NULL, 'EMP-1102', 3, 'El monitor parpadea y tiene líneas verticales.', 'Baja', 'En Proceso', 'Soporte Terreno Carlos', 'Nivel 2 - Hardware', 0, NULL);


-- MOSTRAR TODOS LOS DATOS DE TODAS LAS TABLAS
SELECT * FROM usuarios;
SELECT * FROM tickets;
SELECT * FROM categorias;

SELECT DISTINCT departamento FROM usuarios;
SELECT DISTINCT fecha_resolucion FROM tickets;
SELECT DISTINCT nombre_categoria FROM categorias;

SELECT * FROM usuarios WHERE departamento = 'Finanzas' AND departamento IS NOT NULL;
SELECT * FROM tickets WHERE id_ticket LIKE 'INC-%' AND tiempo_resolucion_minutos IS NOT NULL;
SELECT * FROM categorias WHERE id_categoria > 0 AND id_categoria < 4;

SELECT usuario_nombre, departamento FROM usuarios WHERE NOT usuario_legajo = 'EMP-4421';
SELECT * FROM tickets WHERE NOT prioridad = 'Baja' OR grupo_resolutor = 'Nivel 2';
SELECT nombre_categoria, procedimiento_triage FROM categorias WHERE NOT id_categoria = 1;

SELECT * FROM usuarios LIMIT 3;
SELECT * FROM tickets LIMIT 2;
SELECT * FROM categorias LIMIT 1;

SELECT MAX(usuario_legajo) FROM usuarios;
SELECT MIN(id_ticket) FROM tickets;
SELECT MAX(id_categoria), nombre_categoria, procedimiento_triage FROM categorias;


SELECT COUNT(usuario_legajo) AS legajo FROM usuarios;
SELECT COUNT(id_ticket) AS ticket FROM tickets;
SELECT COUNT(id_categoria) AS categoria FROM categorias;

SELECT * FROM usuarios WHERE usuario_nombre IN ('Aquiles Baeza');
SELECT * FROM tickets WHERE usuario_legajo IN ('EMP-9022');
SELECT * FROM categorias WHERE nombre_categoria IN ('Contraseñas y Accesos');

SELECT
      usuario_nombre AS usuario,
      COUNT(usuario_legajo) AS legajo,
      departamento
FROM usuarios
WHERE departamento IS NOT NULL
GROUP BY usuario_legajo
HAVING COUNT(usuario_legajo) > 0
ORDER BY usuario_nombre;


SELECT
      id_ticket AS ticket,
      usuario_legajo AS legajo,
      prioridad,
      estado,
      agente_asignado AS 'técnico/a'
FROM tickets
WHERE id_ticket IS NOT NULL
GROUP BY id_ticket
HAVING COUNT(id_ticket) = 1
ORDER BY fecha_creacion DESC;

SELECT * FROM categorias;

SELECT *,
CASE
    WHEN id_categoria = 1 THEN 'Problemas con credenciales / Autenticación'
    WHEN id_categoria = 2 THEN 'Problemas de red'
    ELSE 'Problemas con dispositivos físicos'
END AS caso_de_uso
FROM categorias;


-- Consulta: Traer el historial completo detallado
-- Esta consulta junta las tres tablas para mostrar el nombre del empleado, su departamento, qué categoría le falló y el estado del ticket:
SELECT 
    t.id_ticket,
    t.fecha_creacion,
    u.usuario_nombre,
    u.departamento,
    c.nombre_categoria,
    t.prioridad,
    t.estado
FROM tickets t
INNER JOIN usuarios u ON t.usuario_legajo = u.usuario_legajo
INNER JOIN categorias c ON t.id_categoria = c.id_categoria;

-- Consulta: ¿Qué departamento genera más incidentes de Red?
-- Se puede detectar si hay un área específica de la empresa que está teniendo problemas masivos de conectividad
SELECT 
    u.departamento, 
    COUNT(*) AS cantidad_tickets_red
FROM tickets t
INNER JOIN usuarios u ON t.usuario_legajo = u.usuario_legajo
INNER JOIN categorias c ON t.id_categoria = c.id_categoria
WHERE c.nombre_categoria = 'Red y Conectividad'
GROUP BY u.departamento;

-- VIEW de para saber el Total de Tickets por Categoria
CREATE VIEW v_total_tickets AS
SELECT
      c.nombre_categoria,
      COUNT(*) AS TotalTickets
FROM tickets t
INNER JOIN usuarios u ON u.usuario_legajo = t.usuario_legajo
INNER JOIN categorias c ON c.id_categoria = t.id_categoria
GROUP BY c.id_categoria;

-- Total de Tickets
SELECT COUNT(*) AS total_tickets_realizados FROM tickets;