const mysql = require('mysql2/promise');

async function runAudit() {
  console.log('=====================================================');
  console.log('🔍 INICIANDO AUDITORÍA INTEGRAL: LAVADORAS EXPRESS');
  console.log('=====================================================\n');

  const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '1003232284',
    database: 'lavadoras_express_db'
  };

  const pool = mysql.createPool(DB_CONFIG);
  const BASE_URL = 'http://localhost:3000/api';
  const results = {};

  try {
    // ------------------------------------------------------------------
    // PUNTO 1 & 2: VERIFICACIÓN DE MÓDULOS Y PERSISTENCIA DIRECTA EN MYSQL
    // ------------------------------------------------------------------
    console.log('▶ [PUNTOS 1 & 2] Verificando creación y persistencia en MySQL...');

    // 1.1 Registrar Cliente vía API
    const testCedula = '7788990011';
    const cliRes = await fetch(`${BASE_URL}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cedula: testCedula,
        nombre_completo: 'Cliente Auditoría SENA',
        telefono: '3157778899',
        direccion: 'Avenida Principal # 100-20'
      })
    });
    const cliData = await cliRes.json();

    // 1.2 Consultar en MySQL directo
    const [cliRows] = await pool.query('SELECT * FROM clientes WHERE cedula = ?', [testCedula]);
    const clienteEnBD = cliRows.length > 0 ? cliRows[0] : null;

    results.punto1_2_cliente_api = cliRes.ok;
    results.punto1_2_cliente_mysql_persistido = clienteEnBD !== null;
    results.punto1_2_cliente_id = clienteEnBD ? clienteEnBD.id_cliente : null;

    console.log(`  -> Cliente API Status: ${cliRes.status}`);
    console.log(`  -> Cliente en MySQL disco: ${clienteEnBD ? 'SÍ (ID #' + clienteEnBD.id_cliente + ')' : 'NO'}`);

    // 1.3 Registrar Lavadora vía API
    const testLavCodigo = 'LAV-99';
    const lavRes = await fetch(`${BASE_URL}/lavadoras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: testLavCodigo,
        marca: 'Whirlpool Audit Edition',
        capacidad_kg: 19.5,
        tarifa_hora: 6500.00
      })
    });
    const [lavRows] = await pool.query('SELECT * FROM lavadoras WHERE codigo = ?', [testLavCodigo]);
    const lavadoraEnBD = lavRows.length > 0 ? lavRows[0] : null;

    results.punto1_2_lavadora_mysql_persistida = lavadoraEnBD !== null;
    results.punto1_2_lavadora_id = lavadoraEnBD ? lavadoraEnBD.id_lavadora : null;
    console.log(`  -> Lavadora en MySQL disco: ${lavadoraEnBD ? 'SÍ (ID #' + lavadoraEnBD.id_lavadora + ')' : 'NO'}`);

    // ------------------------------------------------------------------
    // PUNTO 3: RESERVAS Y CONTROL DE DISPONIBILIDAD / SOLAPAMIENTO
    // ------------------------------------------------------------------
    console.log('\n▶ [PUNTO 3] Verificando Reservas y validación de disponibilidad horaria...');

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const fechaReserva = manana.toISOString().split('T')[0];

    // 3.1 Crear Reserva Exitosa (10:00 a 13:00)
    const resv1 = await fetch(`${BASE_URL}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_cliente: clienteEnBD.id_cliente,
        id_lavadora: lavadoraEnBD.id_lavadora,
        fecha_reserva: fechaReserva,
        hora_inicio: '10:00',
        hora_fin: '13:00'
      })
    });
    const resv1Data = await resv1.json();

    // 3.2 Intentar Reserva con Conflicto de Horario (11:00 a 14:00) sobre la misma máquina
    const resv2 = await fetch(`${BASE_URL}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_cliente: clienteEnBD.id_cliente,
        id_lavadora: lavadoraEnBD.id_lavadora,
        fecha_reserva: fechaReserva,
        hora_inicio: '11:00',
        hora_fin: '14:00'
      })
    });
    const resv2Data = await resv2.json();

    // Consultar reserva en MySQL
    const [resvRows] = await pool.query('SELECT * FROM reservas WHERE id_lavadora = ? AND fecha_reserva = ?', [lavadoraEnBD.id_lavadora, fechaReserva]);

    results.punto3_reserva_creada_mysql = resv1.ok && resvRows.length === 1;
    results.punto3_conflicto_bloqueado = resv2.status === 409;

    console.log(`  -> Reserva #1 Creada en MySQL: ${resv1.ok ? 'SÍ' : 'NO'}`);
    console.log(`  -> Intento Solapado Bloqueado (Error 409): ${resv2.status === 409 ? 'SÍ (' + resv2Data.error + ')' : 'NO'}`);

    // ------------------------------------------------------------------
    // PUNTO 4 & 5: RELACIÓN ALQUILERES <-> PAGOS Y CÁLCULO DE PRECIOS
    // ------------------------------------------------------------------
    console.log('\n▶ [PUNTOS 4 & 5] Verificando Alquiler, Pagos (FK) y Cálculo Exacto de Precios...');

    const horasContratadas = 3;
    const tarifaEsperada = parseFloat(lavadoraEnBD.tarifa_hora); // 6500.00
    const totalEsperado = horasContratadas * tarifaEsperada; // 19500.00

    // 4.1 Despachar Alquiler vía API
    const alqRes = await fetch(`${BASE_URL}/alquileres`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_cliente: clienteEnBD.id_cliente,
        id_lavadora: lavadoraEnBD.id_lavadora,
        horas: horasContratadas,
        metodo_pago: 'NEQUI_DAVIPLATA'
      })
    });
    const alqData = await alqRes.json();

    // 4.2 Verificar en MySQL: Alquiler
    const [alqRows] = await pool.query('SELECT * FROM alquileres WHERE id_alquiler = ?', [alqData.id_alquiler]);
    const alquilerBD = alqRows[0];

    // 4.3 Verificar en MySQL: Pago relacionado mediante FK (id_alquiler)
    const [pagoRows] = await pool.query('SELECT * FROM pagos WHERE id_alquiler = ?', [alqData.id_alquiler]);
    const pagoBD = pagoRows[0];

    // 4.4 Verificar estado de lavadora en MySQL
    const [lavActualizada] = await pool.query('SELECT estado FROM lavadoras WHERE id_lavadora = ?', [lavadoraEnBD.id_lavadora]);

    results.punto5_calculo_correcto = parseFloat(alquilerBD.costo_total) === totalEsperado;
    results.punto5_monto_liquidado = parseFloat(alquilerBD.costo_total);
    results.punto5_total_esperado = totalEsperado;

    results.punto4_pago_relacionado_fk = pagoBD && pagoBD.id_alquiler === alquilerBD.id_alquiler;
    results.punto4_pago_monto_coincide = pagoBD && parseFloat(pagoBD.monto) === parseFloat(alquilerBD.costo_total);
    results.punto4_comprobante_generado = pagoBD && pagoBD.numero_comprobante.startsWith('REC-');
    results.punto3_lavadora_cambio_alquilada = lavActualizada[0].estado === 'ALQUILADA';

    console.log(`  -> Cálculo Horas × Tarifa (3 × $6.500): Calculado=$${alquilerBD.costo_total} | Esperado=$${totalEsperado} -> ${results.punto5_calculo_correcto ? 'EXACTO ✅' : 'DISCREPANCIA ❌'}`);
    console.log(`  -> Alquiler ID: #${alquilerBD.id_alquiler}`);
    console.log(`  -> Pago ID: #${pagoBD.id_pago} vinculado a Alquiler #${pagoBD.id_alquiler} (FK Relación 1 a 1/Muchos)`);
    console.log(`  -> Comprobante emitido: ${pagoBD.numero_comprobante}`);
    console.log(`  -> Estado de lavadora en tiempo real: ${lavActualizada[0].estado}`);

    // 4.5 Devolución del equipo vía API
    console.log('\n▶ [VERIFICACIÓN DE CIERRE] Probando Devolución y Liberación de Máquina...');
    const devRes = await fetch(`${BASE_URL}/alquileres/${alqData.id_alquiler}/devolucion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ con_dano: false })
    });
    const [lavLiberada] = await pool.query('SELECT estado FROM lavadoras WHERE id_lavadora = ?', [lavadoraEnBD.id_lavadora]);
    const [alqFinalizado] = await pool.query('SELECT estado_servicio FROM alquileres WHERE id_alquiler = ?', [alqData.id_alquiler]);

    results.devolucion_lavadora_disponible = lavLiberada[0].estado === 'DISPONIBLE';
    results.devolucion_servicio_finalizado = alqFinalizado[0].estado_servicio === 'FINALIZADO';

    console.log(`  -> Lavadora tras devolución: ${lavLiberada[0].estado} (Liberada para nuevo uso)`);
    console.log(`  -> Servicio en historial: ${alqFinalizado[0].estado_servicio}`);

    // Reporte consolidado
    console.log('\n=====================================================');
    console.log('📊 RESULTADO DE LA AUDITORÍA:');
    console.log(JSON.stringify(results, null, 2));
    console.log('=====================================================');

  } catch (err) {
    console.error('Error durante auditoría:', err);
  } finally {
    await pool.end();
  }
}

runAudit();
