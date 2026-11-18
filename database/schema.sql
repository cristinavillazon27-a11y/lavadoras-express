-- ====================================================================
-- SISTEMA OFICIAL: LAVADORAS EXPRESS 🧺⚡
-- Script de Base de Datos Relacional para MySQL / MariaDB (XAMPP)
-- Proyecto Académico: ADSO - SENA
-- ====================================================================

-- 1. Creación de la Base de Datos
DROP DATABASE IF EXISTS lavadoras_express_db;
CREATE DATABASE lavadoras_express_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lavadoras_express_db;

-- ====================================================================
-- 2. TABLA: usuarios (Autenticación y Control de Acceso por Roles)
-- ====================================================================
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol ENUM('ADMINISTRADOR', 'EMPLEADO') NOT NULL DEFAULT 'EMPLEADO',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ====================================================================
-- 3. TABLA: clientes (Directorio de Clientes)
-- ====================================================================
CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre_completo VARCHAR(120) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    direccion VARCHAR(150) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ====================================================================
-- 4. TABLA: lavadoras (Inventario y Catálogo de Equipos)
-- ====================================================================
CREATE TABLE lavadoras (
    id_lavadora INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50) NOT NULL,
    capacidad_kg DECIMAL(5,2) NOT NULL,
    tarifa_hora DECIMAL(10,2) NOT NULL DEFAULT 5000.00,
    estado ENUM('DISPONIBLE', 'ALQUILADA', 'MANTENIMIENTO') NOT NULL DEFAULT 'DISPONIBLE'
) ENGINE=InnoDB;

-- ====================================================================
-- 5. TABLA: reservas (Control de Agendamiento por Horas a Futuro)
-- ====================================================================
CREATE TABLE reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_lavadora INT NOT NULL,
    fecha_reserva DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado ENUM('PENDIENTE', 'CONFIRMADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (id_lavadora) REFERENCES lavadoras(id_lavadora) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ====================================================================
-- 6. TABLA: alquileres (Salidas en Vivo y Liquidación por Horas)
-- ====================================================================
CREATE TABLE alquileres (
    id_alquiler INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_lavadora INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha DATE NOT NULL,
    hora_salida TIME NOT NULL,
    hora_retorno_esperada TIME NOT NULL,
    horas_contratadas INT NOT NULL,
    costo_total DECIMAL(10,2) NOT NULL,
    estado_servicio ENUM('EN_CURSO', 'FINALIZADO', 'CANCELADO') NOT NULL DEFAULT 'EN_CURSO',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (id_lavadora) REFERENCES lavadoras(id_lavadora) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ====================================================================
-- 7. TABLA: pagos (Cobros y Registro de Comprobantes Legales)
-- ====================================================================
CREATE TABLE pagos (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_alquiler INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    metodo_pago ENUM('EFECTIVO', 'NEQUI_DAVIPLATA', 'TRANSFERENCIA', 'TARJETA') NOT NULL DEFAULT 'EFECTIVO',
    numero_comprobante VARCHAR(50) UNIQUE NOT NULL,
    FOREIGN KEY (id_alquiler) REFERENCES alquileres(id_alquiler) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ====================================================================
-- 8. TABLA: mantenimientos (Bitácora de Daños y Novedades Técnicas)
-- ====================================================================
CREATE TABLE mantenimientos (
    id_mantenimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_lavadora INT NOT NULL,
    descripcion_dano TEXT NOT NULL,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    costo_reparacion DECIMAL(10,2) DEFAULT 0.00,
    estado ENUM('PENDIENTE', 'EN_REPARACION', 'RESUELTO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (id_lavadora) REFERENCES lavadoras(id_lavadora) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ====================================================================
-- 9. DATOS DE PRUEBA INICIALES (SEED DATA)
-- ====================================================================

-- Usuarios de prueba (Contraseña inicial: 123456)
INSERT INTO usuarios (nombre, correo, password, rol) VALUES
('Carlos Administrador', 'admin@lavadorasexpress.com', '123456', 'ADMINISTRADOR'),
('Luisa Empleada', 'empleado@lavadorasexpress.com', '123456', 'EMPLEADO');

-- Catálogo de Lavadoras
INSERT INTO lavadoras (codigo, marca, capacidad_kg, tarifa_hora, estado) VALUES
('LAV-01', 'LG TurboWash', 15.00, 5000.00, 'DISPONIBLE'),
('LAV-02', 'Samsung EcoBubble', 15.00, 5000.00, 'DISPONIBLE'),
('LAV-03', 'Whirlpool Xpert', 18.00, 6000.00, 'DISPONIBLE'),
('LAV-04', 'Mabe Aqua Saver', 18.00, 6000.00, 'DISPONIBLE'),
('LAV-05', 'Electrolux Pro', 20.00, 7000.00, 'DISPONIBLE');

-- Clientes iniciales
INSERT INTO clientes (cedula, nombre_completo, telefono, direccion) VALUES
('1020304050', 'María Pérez', '3001234567', 'Calle 10 # 45-20'),
('9876543210', 'Pedro Gómez', '3109876543', 'Carrera 15 # 8-30');

-- Alquiler inicial de prueba
INSERT INTO alquileres (id_cliente, id_lavadora, id_usuario, fecha, hora_salida, hora_retorno_esperada, horas_contratadas, costo_total, estado_servicio) VALUES
(1, 1, 1, CURDATE(), '10:00:00', '12:00:00', 2, 10000.00, 'FINALIZADO');

-- Pago con comprobante asociado al alquiler
INSERT INTO pagos (id_alquiler, monto, metodo_pago, numero_comprobante) VALUES
(1, 10000.00, 'NEQUI_DAVIPLATA', 'REC-2026-0001');
