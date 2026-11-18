const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración adaptable: lee variables de entorno de la nube (Render)
// Si no existen variables de nube, usa automáticamente tu MySQL local de siempre
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '1003232284',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  multipleStatements: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

const DB_NAME = process.env.DB_NAME || 'lavadoras_express_db';

let pool = null;
let isConnected = false;

async function initDatabase() {
  try {
    // 1. Conexión inicial al servidor MySQL
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log(`✅ Conexión establecida con MySQL en [${DB_CONFIG.host}:${DB_CONFIG.port}].`);

    // 2. Crear base de datos si no existe
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();

    // 3. Crear pool apuntando a la base de datos oficial
    pool = mysql.createPool({
      ...DB_CONFIG,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 4. Verificar si las tablas ya existen; si no, ejecutar schema.sql
    const [tables] = await pool.query("SHOW TABLES LIKE 'lavadoras';");
    if (tables.length === 0) {
      console.log('⚙️ Creando tablas iniciales desde schema.sql...');
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log(`✅ Tablas y datos de prueba creados exitosamente en [${DB_NAME}].`);
      }
    } else {
      console.log(`✅ Base de datos [${DB_NAME}] lista y verificada en MySQL.`);
    }

    isConnected = true;
    return pool;
  } catch (error) {
    console.warn('\n⚠️ [AVISO IMPORTANTE - MYSQL]:');
    console.warn(`No se pudo conectar a MySQL en ${DB_CONFIG.host}:${DB_CONFIG.port}.`);
    console.warn('Detalle del error:', error.message, '\n');
    isConnected = false;
    return null;
  }
}

function getPool() {
  return pool;
}

function checkConnection() {
  return isConnected;
}

module.exports = {
  initDatabase,
  getPool,
  checkConnection
};
