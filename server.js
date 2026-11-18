const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, getPool, checkConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ====================================================================
// MEMORIA DE RESERVA (FALLBACK) POR SI MYSQL NO ESTÁ INICIADO EN XAMPP
// ====================================================================
let mockData = {
  usuarios: [
    { id_usuario: 1, nombre: 'Carlos Administrador', correo: 'admin@lavadorasexpress.com', password: '123', rol: 'ADMINISTRADOR' },
    { id_usuario: 2, nombre: 'Luisa Empleada', correo: 'empleado@lavadorasexpress.com', password: '123', rol: 'EMPLEADO' }
  ],
  clientes: [
    { id_cliente: 1, cedula: '1020304050', nombre_completo: 'María Pérez', telefono: '3001234567', direccion: 'Calle 10 # 45-20', total_alquileres: 3 },
    { id_cliente: 2, cedula: '9876543210', nombre_completo: 'Pedro Gómez', telefono: '3109876543', direccion: 'Carrera 15 # 8-30', total_alquileres: 1 }
  ],
  lavadoras: [
    { id_lavadora: 1, codigo: 'LAV-01', marca: 'LG TurboWash', capacidad_kg: 15.00, tarifa_hora: 5000.00, estado: 'ALQUILADA' },
    { id_lavadora: 2, codigo: 'LAV-02', marca: 'Samsung EcoBubble', capacidad_kg: 15.00, tarifa_hora: 5000.00, estado: 'DISPONIBLE' },
    { id_lavadora: 3, codigo: 'LAV-03', marca: 'Whirlpool Xpert', capacidad_kg: 18.00, tarifa_hora: 6000.00, estado: 'DISPONIBLE' },
    { id_lavadora: 4, codigo: 'LAV-04', marca: 'Mabe Aqua Saver', capacidad_kg: 18.00, tarifa_hora: 6000.00, estado: 'DISPONIBLE' },
    { id_lavadora: 5, codigo: 'LAV-05', marca: 'Electrolux Pro', capacidad_kg: 20.00, tarifa_hora: 7000.00, estado: 'MANTENIMIENTO' }
  ],
  reservas: [
    { id_reserva: 1, cliente: 'Pedro Gómez', lavadora: 'LAV-02 (15kg)', fecha: '2026-11-19', hora_inicio: '08:00', hora_fin: '11:00', estado: 'CONFIRMADA' }
  ],
  alquileres: [
    {
      id_alquiler: 1,
      id_cliente: 1,
      cliente: 'María Pérez',
      id_lavadora: 1,
      lavadora: 'LAV-01 (15kg)',
      direccion: 'Calle 10 # 45-20',
      horas: 2,
      costo_total: 10000.00,
      hora_salida: '10:00 AM',
      hora_retorno: '12:00 PM',
      estado: 'EN_CURSO'
    }
  ],
  pagos: [
    {
      id_pago: 1,
      id_alquiler: 1,
      cliente: 'María Pérez',
      cedula: '1020304050',
      lavadora: 'LAV-01 (15kg)',
      horas: 2,
      monto: 10000.00,
      metodo_pago: 'NEQUI_DAVIPLATA',
      numero_comprobante: 'REC-2026-0001',
      fecha: new Date().toLocaleString()
    }
  ],
  mantenimientos: [
    {
      id_mantenimiento: 1,
      id_lavadora: 5,
      lavadora: 'LAV-05 (Electrolux Pro 20kg)',
      descripcion_dano: 'Fuga de agua en manguera de desagüe y ruido en centrifugado.',
      fecha_reporte: '2026-11-18',
      estado: 'PENDIENTE'
    }
  ]
};

// ====================================================================
// RUTAS DE LA API (REST ENDPOINTS)
// ====================================================================

// 1. ESTADO DEL SISTEMA Y BASE DE DATOS
app.get('/api/estado', (req, res) => {
  res.json({
    sistema: 'Lavadoras Express',
    version: '1.0.0',
    mysql_conectado: checkConnection(),
    modo: checkConnection() ? 'MySQL Activo (XAMPP)' : 'Memoria Local (Inicia MySQL en XAMPP para persistencia)'
  });
});

// 2. PASO 4: AUTENTICACIÓN / INICIO DE SESIÓN
app.post('/api/auth/login', async (req, res) => {
  const { correo, password, rol } = req.body;
  
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query(
        'SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE correo = ? AND password = ?',
        [correo, password]
      );
      if (rows.length > 0) {
        return res.json({ exito: true, usuario: rows[0] });
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback
  const user = mockData.usuarios.find(u => u.correo === correo && u.password === password);
  if (user) {
    res.json({ exito: true, usuario: { id_usuario: user.id_usuario, nombre: user.nombre, correo: user.correo, rol: user.rol } });
  } else {
    res.status(401).json({ exito: false, mensaje: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
  }
});

// 3. PASO 5: DASHBOARD Y KPIS
app.get('/api/dashboard/kpis', async (req, res) => {
  if (checkConnection()) {
    try {
      const pool = getPool();
      const [[disp]] = await pool.query("SELECT COUNT(*) AS total FROM lavadoras WHERE estado = 'DISPONIBLE'");
      const [[alq]] = await pool.query("SELECT COUNT(*) AS total FROM lavadoras WHERE estado = 'ALQUILADA'");
      const [[resv]] = await pool.query("SELECT COUNT(*) AS total FROM reservas WHERE fecha_reserva = CURDATE()");
      const [[ing]] = await pool.query("SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE DATE(fecha_pago) = CURDATE()");

      return res.json({
        disponibles: disp.total,
        alquiladas: alq.total,
        reservas_hoy: resv.total,
        ingresos_hoy: ing.total
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback
  const disp = mockData.lavadoras.filter(l => l.estado === 'DISPONIBLE').length;
  const alq = mockData.lavadoras.filter(l => l.estado === 'ALQUILADA').length;
  const resv = mockData.reservas.length;
  const ing = mockData.pagos.reduce((acc, p) => acc + p.monto, 0);

  res.json({ disponibles: disp, alquiladas: alq, reservas_hoy: resv, ingresos_hoy: ing });
});

// 4. PASO 6: CLIENTES (CRUD)
app.get('/api/clientes', async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : '';
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query(`
        SELECT c.*, COUNT(a.id_alquiler) AS total_alquileres
        FROM clientes c
        LEFT JOIN alquileres a ON c.id_cliente = a.id_cliente
        WHERE c.nombre_completo LIKE ? OR c.cedula LIKE ?
        GROUP BY c.id_cliente
        ORDER BY c.id_cliente DESC
      `, [`%${query}%`, `%${query}%`]);
      return res.json(rows);
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback
  let lista = mockData.clientes;
  if (query) {
    lista = lista.filter(c => c.nombre_completo.toLowerCase().includes(query) || c.cedula.includes(query));
  }
  res.json(lista);
});

app.post('/api/clientes', async (req, res) => {
  const { cedula, nombre_completo, telefono, direccion } = req.body;
  if (!cedula || !nombre_completo || !telefono || !direccion) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (checkConnection()) {
    try {
      const [result] = await getPool().query(
        'INSERT INTO clientes (cedula, nombre_completo, telefono, direccion) VALUES (?, ?, ?, ?)',
        [cedula, nombre_completo, telefono, direccion]
      );
      return res.json({ exito: true, id_cliente: result.insertId, mensaje: 'Cliente registrado con éxito en MySQL' });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Ya existe un cliente registrado con esa cédula' });
      }
      return res.status(500).json({ error: e.message });
    }
  }

  // Fallback
  const existe = mockData.clientes.find(c => c.cedula === cedula);
  if (existe) return res.status(400).json({ error: 'Ya existe un cliente con esa cédula' });

  const nuevoCliente = {
    id_cliente: mockData.clientes.length + 1,
    cedula,
    nombre_completo,
    telefono,
    direccion,
    total_alquileres: 0
  };
  mockData.clientes.push(nuevoCliente);
  res.json({ exito: true, id_cliente: nuevoCliente.id_cliente, mensaje: 'Cliente registrado con éxito' });
});

// 5. PASO 7: LAVADORAS (INVENTARIO)
app.get('/api/lavadoras', async (req, res) => {
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query('SELECT * FROM lavadoras ORDER BY codigo ASC');
      return res.json(rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockData.lavadoras);
});

app.post('/api/lavadoras', async (req, res) => {
  const { codigo, marca, capacidad_kg, tarifa_hora } = req.body;
  if (checkConnection()) {
    try {
      const [result] = await getPool().query(
        'INSERT INTO lavadoras (codigo, marca, capacidad_kg, tarifa_hora, estado) VALUES (?, ?, ?, ?, "DISPONIBLE")',
        [codigo, marca, capacidad_kg, tarifa_hora]
      );
      return res.json({ exito: true, id_lavadora: result.insertId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const nueva = {
    id_lavadora: mockData.lavadoras.length + 1,
    codigo,
    marca,
    capacidad_kg: parseFloat(capacidad_kg),
    tarifa_hora: parseFloat(tarifa_hora),
    estado: 'DISPONIBLE'
  };
  mockData.lavadoras.push(nueva);
  res.json({ exito: true, id_lavadora: nueva.id_lavadora });
});

// 6. PASO 8: RESERVAS POR HORA
app.get('/api/reservas', async (req, res) => {
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query(`
        SELECT r.*, c.nombre_completo AS cliente, l.codigo AS lavadora_codigo, l.marca
        FROM reservas r
        JOIN clientes c ON r.id_cliente = c.id_cliente
        JOIN lavadoras l ON r.id_lavadora = l.id_lavadora
        ORDER BY r.fecha_reserva DESC, r.hora_inicio ASC
      `);
      return res.json(rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockData.reservas);
});

app.post('/api/reservas', async (req, res) => {
  const { id_cliente, id_lavadora, fecha_reserva, hora_inicio, hora_fin } = req.body;

  if (checkConnection()) {
    try {
      // Validar si existe solapamiento
      const [choques] = await getPool().query(`
        SELECT * FROM reservas 
        WHERE id_lavadora = ? AND fecha_reserva = ? AND estado != 'CANCELADA'
        AND ((hora_inicio <= ? AND hora_fin > ?) OR (hora_inicio < ? AND hora_fin >= ?))
      `, [id_lavadora, fecha_reserva, hora_inicio, hora_inicio, hora_fin, hora_fin]);

      if (choques.length > 0) {
        return res.status(409).json({ error: 'La lavadora seleccionada ya tiene una reserva en ese rango horario.' });
      }

      const [resul] = await getPool().query(
        'INSERT INTO reservas (id_cliente, id_lavadora, fecha_reserva, hora_inicio, hora_fin, estado) VALUES (?, ?, ?, ?, ?, "CONFIRMADA")',
        [id_cliente, id_lavadora, fecha_reserva, hora_inicio, hora_fin]
      );
      return res.json({ exito: true, id_reserva: resul.insertId, mensaje: 'Reserva confirmada con éxito' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Fallback
  const clienteObj = mockData.clientes.find(c => c.id_cliente == id_cliente);
  const lavadoraObj = mockData.lavadoras.find(l => l.id_lavadora == id_lavadora);

  const nuevaReserva = {
    id_reserva: mockData.reservas.length + 1,
    cliente: clienteObj ? clienteObj.nombre_completo : 'Cliente #' + id_cliente,
    lavadora: lavadoraObj ? `${lavadoraObj.codigo} (${lavadoraObj.capacidad_kg}kg)` : 'Lavadora #' + id_lavadora,
    fecha: fecha_reserva,
    hora_inicio,
    hora_fin,
    estado: 'CONFIRMADA'
  };
  mockData.reservas.push(nuevaReserva);
  res.json({ exito: true, id_reserva: nuevaReserva.id_reserva, mensaje: 'Reserva confirmada con éxito' });
});

// 7. PASO 9: ALQUILER EN VIVO (DESPACHO Y DEVOLUCIÓN)
app.get('/api/alquileres/activos', async (req, res) => {
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query(`
        SELECT a.*, c.nombre_completo AS cliente, c.telefono, c.direccion, l.codigo AS lavadora_codigo, l.capacidad_kg
        FROM alquileres a
        JOIN clientes c ON a.id_cliente = c.id_cliente
        JOIN lavadoras l ON a.id_lavadora = l.id_lavadora
        WHERE a.estado_servicio = 'EN_CURSO'
        ORDER BY a.id_alquiler DESC
      `);
      return res.json(rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockData.alquileres.filter(a => a.estado === 'EN_CURSO'));
});

app.post('/api/alquileres', async (req, res) => {
  const { id_cliente, id_lavadora, horas, metodo_pago } = req.body;
  const horasNum = parseInt(horas) || 1;

  if (checkConnection()) {
    try {
      const pool = getPool();
      const [[lavadora]] = await pool.query('SELECT * FROM lavadoras WHERE id_lavadora = ?', [id_lavadora]);
      if (!lavadora || lavadora.estado !== 'DISPONIBLE') {
        return res.status(400).json({ error: 'La lavadora no está disponible para alquiler.' });
      }

      const costoTotal = horasNum * parseFloat(lavadora.tarifa_hora);
      const ahora = new Date();
      const horaSalida = ahora.toTimeString().split(' ')[0];
      const retornoDate = new Date(ahora.getTime() + horasNum * 60 * 60 * 1000);
      const horaRetorno = retornoDate.toTimeString().split(' ')[0];

      // 1. Crear Alquiler
      const [alqRes] = await pool.query(`
        INSERT INTO alquileres (id_cliente, id_lavadora, id_usuario, fecha, hora_salida, hora_retorno_esperada, horas_contratadas, costo_total, estado_servicio)
        VALUES (?, ?, 1, CURDATE(), ?, ?, ?, ?, 'EN_CURSO')
      `, [id_cliente, id_lavadora, horaSalida, horaRetorno, horasNum, costoTotal]);

      // 2. Marcar lavadora como ALQUILADA
      await pool.query('UPDATE lavadoras SET estado = "ALQUILADA" WHERE id_lavadora = ?', [id_lavadora]);

      // 3. Generar Pago y Comprobante
      const numComprobante = `REC-${new Date().getFullYear()}-${String(alqRes.insertId).padStart(4, '0')}`;
      await pool.query(`
        INSERT INTO pagos (id_alquiler, monto, metodo_pago, numero_comprobante)
        VALUES (?, ?, ?, ?)
      `, [alqRes.insertId, costoTotal, metodo_pago || 'EFECTIVO', numComprobante]);

      return res.json({
        exito: true,
        id_alquiler: alqRes.insertId,
        numero_comprobante: numComprobante,
        total: costoTotal,
        mensaje: 'Alquiler iniciado y comprobante generado con éxito'
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Fallback
  const clienteObj = mockData.clientes.find(c => c.id_cliente == id_cliente);
  const lavadoraObj = mockData.lavadoras.find(l => l.id_lavadora == id_lavadora);
  if (!lavadoraObj || lavadoraObj.estado !== 'DISPONIBLE') {
    return res.status(400).json({ error: 'Lavadora no disponible' });
  }

  const costoTotal = horasNum * lavadoraObj.tarifa_hora;
  lavadoraObj.estado = 'ALQUILADA';

  const nuevoAlquiler = {
    id_alquiler: mockData.alquileres.length + 1,
    id_cliente: parseInt(id_cliente),
    cliente: clienteObj ? clienteObj.nombre_completo : 'Cliente #' + id_cliente,
    id_lavadora: parseInt(id_lavadora),
    lavadora: `${lavadoraObj.codigo} (${lavadoraObj.capacidad_kg}kg)`,
    direccion: clienteObj ? clienteObj.direccion : 'Dirección no registrada',
    horas: horasNum,
    costo_total: costoTotal,
    hora_salida: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hora_retorno: new Date(Date.now() + horasNum * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    estado: 'EN_CURSO'
  };
  mockData.alquileres.push(nuevoAlquiler);

  const numComp = `REC-${new Date().getFullYear()}-${String(nuevoAlquiler.id_alquiler).padStart(4, '0')}`;
  mockData.pagos.push({
    id_pago: mockData.pagos.length + 1,
    id_alquiler: nuevoAlquiler.id_alquiler,
    cliente: nuevoAlquiler.cliente,
    cedula: clienteObj ? clienteObj.cedula : '1020304050',
    lavadora: nuevoAlquiler.lavadora,
    horas: horasNum,
    monto: costoTotal,
    metodo_pago: metodo_pago || 'EFECTIVO',
    numero_comprobante: numComp,
    fecha: new Date().toLocaleString()
  });

  res.json({
    exito: true,
    id_alquiler: nuevoAlquiler.id_alquiler,
    numero_comprobante: numComp,
    total: costoTotal,
    mensaje: 'Alquiler registrado con éxito'
  });
});

// Devolución / Cierre de servicio
app.put('/api/alquileres/:id/devolucion', async (req, res) => {
  const idAlquiler = req.params.id;
  const { con_dano, descripcion_dano } = req.body;

  if (checkConnection()) {
    try {
      const pool = getPool();
      const [[alq]] = await pool.query('SELECT * FROM alquileres WHERE id_alquiler = ?', [idAlquiler]);
      if (!alq) return res.status(404).json({ error: 'Alquiler no encontrado' });

      await pool.query('UPDATE alquileres SET estado_servicio = "FINALIZADO" WHERE id_alquiler = ?', [idAlquiler]);
      
      const nuevoEstado = con_dano ? 'MANTENIMIENTO' : 'DISPONIBLE';
      await pool.query('UPDATE lavadoras SET estado = ? WHERE id_lavadora = ?', [nuevoEstado, alq.id_lavadora]);

      if (con_dano) {
        await pool.query('INSERT INTO mantenimientos (id_lavadora, descripcion_dano, estado) VALUES (?, ?, "PENDIENTE")', [
          alq.id_lavadora,
          descripcion_dano || 'Daño reportado al retornar del alquiler'
        ]);
      }

      return res.json({ exito: true, mensaje: 'Devolución procesada y lavadora actualizada' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Fallback
  const alq = mockData.alquileres.find(a => a.id_alquiler == idAlquiler);
  if (!alq) return res.status(404).json({ error: 'Alquiler no encontrado' });

  alq.estado = 'FINALIZADO';
  const lav = mockData.lavadoras.find(l => l.id_lavadora == alq.id_lavadora);
  if (lav) {
    lav.estado = con_dano ? 'MANTENIMIENTO' : 'DISPONIBLE';
    if (con_dano) {
      mockData.mantenimientos.push({
        id_mantenimiento: mockData.mantenimientos.length + 1,
        id_lavadora: lav.id_lavadora,
        lavadora: `${lav.codigo} (${lav.marca})`,
        descripcion_dano: descripcion_dano || 'Daño reportado al devolver',
        fecha_reporte: new Date().toISOString().split('T')[0],
        estado: 'PENDIENTE'
      });
    }
  }

  res.json({ exito: true, mensaje: 'Devolución completada exitosamente' });
});

// 8. PASO 10: PAGOS, MANTENIMIENTOS Y REPORTES
app.get('/api/pagos', async (req, res) => {
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query(`
        SELECT p.*, c.nombre_completo AS cliente, c.cedula, c.direccion, l.codigo AS lavadora_codigo, a.horas_contratadas AS horas
        FROM pagos p
        JOIN alquileres a ON p.id_alquiler = a.id_alquiler
        JOIN clientes c ON a.id_cliente = c.id_cliente
        JOIN lavadoras l ON a.id_lavadora = l.id_lavadora
        ORDER BY p.id_pago DESC
      `);
      return res.json(rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockData.pagos.slice().reverse());
});

app.get('/api/mantenimientos', async (req, res) => {
  if (checkConnection()) {
    try {
      const [rows] = await getPool().query(`
        SELECT m.*, l.codigo AS lavadora_codigo, l.marca
        FROM mantenimientos m
        JOIN lavadoras l ON m.id_lavadora = l.id_lavadora
        ORDER BY m.id_mantenimiento DESC
      `);
      return res.json(rows);
    } catch (e) {
      console.error(e);
    }
  }
  res.json(mockData.mantenimientos);
});

app.post('/api/mantenimientos', async (req, res) => {
  const { id_lavadora, descripcion_dano } = req.body;
  if (checkConnection()) {
    try {
      const pool = getPool();
      await pool.query('INSERT INTO mantenimientos (id_lavadora, descripcion_dano, estado) VALUES (?, ?, "PENDIENTE")', [
        id_lavadora,
        descripcion_dano
      ]);
      await pool.query('UPDATE lavadoras SET estado = "MANTENIMIENTO" WHERE id_lavadora = ?', [id_lavadora]);
      return res.json({ exito: true, mensaje: 'Máquina enviada a mantenimiento' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const lav = mockData.lavadoras.find(l => l.id_lavadora == id_lavadora);
  if (lav) lav.estado = 'MANTENIMIENTO';
  mockData.mantenimientos.push({
    id_mantenimiento: mockData.mantenimientos.length + 1,
    id_lavadora: parseInt(id_lavadora),
    lavadora: lav ? `${lav.codigo} (${lav.marca})` : 'Lavadora #' + id_lavadora,
    descripcion_dano,
    fecha_reporte: new Date().toISOString().split('T')[0],
    estado: 'PENDIENTE'
  });
  res.json({ exito: true, mensaje: 'Reporte registrado y máquina bloqueada' });
});

app.put('/api/mantenimientos/:id/resolver', async (req, res) => {
  const idMantenimiento = req.params.id;
  if (checkConnection()) {
    try {
      const pool = getPool();
      const [[m]] = await pool.query('SELECT * FROM mantenimientos WHERE id_mantenimiento = ?', [idMantenimiento]);
      if (m) {
        await pool.query('UPDATE mantenimientos SET estado = "RESUELTO" WHERE id_mantenimiento = ?', [idMantenimiento]);
        await pool.query('UPDATE lavadoras SET estado = "DISPONIBLE" WHERE id_lavadora = ?', [m.id_lavadora]);
      }
      return res.json({ exito: true, mensaje: 'Falla resuelta. Lavadora ahora DISPONIBLE.' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const m = mockData.mantenimientos.find(item => item.id_mantenimiento == idMantenimiento);
  if (m) {
    m.estado = 'RESUELTO';
    const lav = mockData.lavadoras.find(l => l.id_lavadora == m.id_lavadora);
    if (lav) lav.estado = 'DISPONIBLE';
  }
  res.json({ exito: true, mensaje: 'Reparación resuelta y máquina disponible' });
});

// Reportes Financieros
app.get('/api/reportes/financieros', async (req, res) => {
  if (checkConnection()) {
    try {
      const pool = getPool();
      const [[diario]] = await pool.query('SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad FROM pagos WHERE DATE(fecha_pago) = CURDATE()');
      const [[mensual]] = await pool.query('SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad FROM pagos WHERE MONTH(fecha_pago) = MONTH(CURDATE()) AND YEAR(fecha_pago) = YEAR(CURDATE())');
      const [[topLavadora]] = await pool.query(`
        SELECT l.codigo, l.marca, COUNT(a.id_alquiler) AS veces, SUM(a.costo_total) AS recaudado
        FROM lavadoras l
        JOIN alquileres a ON l.id_lavadora = a.id_lavadora
        GROUP BY l.id_lavadora
        ORDER BY recaudado DESC
        LIMIT 1
      `);

      return res.json({
        diario: diario.total,
        alquileres_hoy: diario.cantidad,
        mensual: mensual.total,
        alquileres_mes: mensual.cantidad,
        lavadora_top: topLavadora ? `${topLavadora.codigo} (${topLavadora.marca})` : 'LAV-01 (LG)'
      });
    } catch (e) {
      console.error(e);
    }
  }

  const total = mockData.pagos.reduce((a, b) => a + b.monto, 0);
  res.json({
    diario: total,
    alquileres_hoy: mockData.alquileres.length,
    mensual: total,
    alquileres_mes: mockData.alquileres.length,
    lavadora_top: 'LAV-01 (LG TurboWash)'
  });
});

// Iniciar servidor y base de datos
app.listen(PORT, async () => {
  console.log(`\n=================================================`);
  console.log(`🧺 LAVADORAS EXPRESS - SERVIDOR ACTIVO`);
  console.log(`🌐 Acceso Web: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
  await initDatabase();
});
