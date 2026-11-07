CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role ENUM('admin', 'agent') NOT NULL DEFAULT 'agent',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_key VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    triage_steps JSON NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_key (category_key)
);

CREATE TABLE IF NOT EXISTS tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(24) NOT NULL,
    requester_name VARCHAR(120) NOT NULL,
    requester_identifier VARCHAR(40) NOT NULL,
    requester_email VARCHAR(254) NULL,
    department VARCHAR(100) NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('Baja', 'Media', 'Alta', 'Crítica') NOT NULL DEFAULT 'Media',
    status ENUM('Abierto', 'En progreso', 'En espera', 'Resuelto', 'Cerrado') NOT NULL DEFAULT 'Abierto',
    assigned_to BIGINT UNSIGNED NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    resolution TEXT NULL,
    resolved_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tickets_public_id (public_id),
    KEY ix_tickets_status_priority (status, priority, created_at),
    KEY ix_tickets_assignee_status (assigned_to, status, created_at),
    KEY ix_tickets_category_created (category_id, created_at),
    KEY ix_tickets_requester (requester_identifier, created_at),
    CONSTRAINT fk_tickets_category FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT fk_tickets_assignee FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS ticket_comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_ticket_comments_ticket_created (ticket_id, created_at),
    CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS ticket_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(40) NOT NULL,
    field_name VARCHAR(40) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_ticket_events_ticket_created (ticket_id, created_at),
    CONSTRAINT fk_events_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_events_actor FOREIGN KEY (actor_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash CHAR(64) NOT NULL,
    csrf_hash CHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_hash),
    KEY ix_sessions_expires (expires_at),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO categories (category_key, name, triage_steps) VALUES
('contrasenas', 'Contraseñas y accesos', JSON_ARRAY('Verificá que Bloq Mayús esté desactivado.', 'Probá el portal de autoservicio de restablecimiento.', 'Si la cuenta está bloqueada, documentá el incidente para su desbloqueo.')),
('red', 'Red e internet', JSON_ARRAY('Comprobá la conexión Wi-Fi o el cable de red.', 'Verificá si otras personas tienen el mismo problema.', 'Anotá la ubicación y el mensaje de error antes de escalar.')),
('hardware', 'Hardware y periféricos', JSON_ARRAY('Revisá los cables de alimentación y conexión.', 'Probá el periférico en otro puerto o equipo.', 'Registrá el modelo y el número de inventario.')),
('software', 'Software y aplicaciones', JSON_ARRAY('Cerrá y volvé a abrir la aplicación.', 'Anotá la versión y el mensaje de error.', 'Verificá si hay actualizaciones pendientes.'))
ON DUPLICATE KEY UPDATE name = VALUES(name), triage_steps = VALUES(triage_steps);
