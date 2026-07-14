-- 1. Crear la base de datos (por si el hosting no te la da creada)
CREATE DATABASE IF NOT EXISTS helpdesk_db;
USE helpdesk_db;

-- 2. Creamos la tabla de tickets (MySQL)
CREATE TABLE tickets (
    id_ticket VARCHAR(10) PRIMARY KEY,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_nombre VARCHAR(100) NOT NULL,
    usuario_legajo VARCHAR(20) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    prioridad VARCHAR(10) NOT NULL,
    estado VARCHAR(50) NOT NULL,
    resolucion_automatica TINYINT(1) DEFAULT 0
);

-- 3. Insertamos algunos tickets de prueba
INSERT INTO tickets (id_ticket, usuario_nombre, usuario_legajo, categoria, prioridad, estado, resolucion_automatica)
VALUES 
('INC-48219', 'Esteban Quito', 'EMP-4421', 'Problemas de Red / Internet', 'Alta', 'Cerrado - Resuelto en N1', 1),
('INC-10553', 'Ana Conda', 'EMP-9022', 'Problemas de Contraseñas / Accesos', 'Media', 'Cerrado - Resuelto en N1', 1),
('INC-99281', 'Aquiles Baeza', 'EMP-1102', 'Problemas de Hardware (Monitor...)', 'Baja', 'Escalado - Requiere N2', 0),
('INC-33412', 'Elsa Pato', 'EMP-3044', 'Problemas de Red / Internet', 'Alta', 'Escalado - Requiere N2', 0);

-- 4. Hacemos las consultas para ver que todo funcione
SELECT * FROM tickets;

SELECT COUNT(*) AS total_resueltos_N1 
FROM tickets 
WHERE resolucion_automatica = 1;

SELECT prioridad, COUNT(*) AS cantidad 
FROM tickets 
GROUP BY prioridad;