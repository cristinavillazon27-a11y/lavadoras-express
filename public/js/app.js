// ====================================================================
// LAVADORAS EXPRESS - CONTROLADOR FRONTEND
// Conecta todas las pantallas con la API REST y Base de Datos MySQL
// ====================================================================

const API_URL = '/api';

// Estado global en memoria
let usuarioActual = JSON.parse(localStorage.getItem('usuario_lavadoras')) || {
  nombre: 'Carlos Administrador',
  rol: 'ADMINISTRADOR'
};
let listaLavadoras = [];
let listaClientes = [];

document.addEventListener('DOMContentLoaded', () => {
  verificarEstadoServidor();
  actualizarInfoUsuario();
  cargarDashboard();
  cargarLavadoras();
  cargarClientes();
});

// ====================================================================
// 1. NAVEGACIÓN ENTRE PANTALLAS
// ====================================================================
function cambiarPantalla(idPantalla) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const pantalla = document.getElementById(idPantalla);
  if (pantalla) pantalla.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navLink = document.querySelector(`[onclick*="${idPantalla}"]`);
  if (navLink) navLink.classList.add('active');

  const titulos = {
    'pantalla-dashboard': 'Panel Principal / Dashboard de Control',
    'pantalla-clientes': 'Módulo de Gestión de Clientes',
    'pantalla-lavadoras': 'Módulo de Inventario de Lavadoras',
    'pantalla-reservas': 'Módulo de Reservas por Horas',
    'pantalla-alquiler': 'Módulo de Alquiler y Despacho en Vivo',
    'pantalla-pagos': 'Módulo de Pagos y Recibos Oficiales',
    'pantalla-mantenimiento': 'Módulo de Mantenimiento y Averías',
    'pantalla-reportes': 'Módulo de Reportes Financieros',
    'pantalla-login': 'Inicio de Sesión / Autenticación'
  };

  if (titulos[idPantalla]) {
    document.getElementById('titulo-topbar').innerText = titulos[idPantalla];
  }

  // Carga bajo demanda al abrir cada módulo
  if (idPantalla === 'pantalla-dashboard') cargarDashboard();
  if (idPantalla === 'pantalla-clientes') cargarClientes();
  if (idPantalla === 'pantalla-lavadoras') cargarLavadoras();
  if (idPantalla === 'pantalla-reservas') cargarReservas();
  if (idPantalla === 'pantalla-alquiler') prepararFormularioAlquiler();
  if (idPantalla === 'pantalla-pagos') cargarPagos();
  if (idPantalla === 'pantalla-mantenimiento') cargarMantenimientos();
  if (idPantalla === 'pantalla-reportes') cargarReportes();
}

function actualizarInfoUsuario() {
  document.getElementById('user-nombre').innerText = usuarioActual.nombre;
  document.getElementById('user-rol').innerText = usuarioActual.rol;
  document.getElementById('badge-rol-topbar').innerHTML = `<i class="fa-solid fa-shield"></i> Modo ${usuarioActual.rol}`;
}

async function verificarEstadoServidor() {
  try {
    const res = await fetch(`${API_URL}/estado`);
    const data = await res.json();
    const badge = document.getElementById('badge-db-status');
    if (data.mysql_conectado) {
      badge.className = 'badge-db online';
      badge.innerHTML = `<i class="fa-solid fa-database"></i> MySQL Conectado (XAMPP)`;
    } else {
      badge.className = 'badge-db';
      badge.innerHTML = `<i class="fa-solid fa-server"></i> Memoria Local (MySQL Apagado)`;
    }
  } catch (e) {
    console.warn('Servidor local no disponible:', e);
  }
}

// ====================================================================
// 2. PASO 4: LOGIN / INICIO DE SESIÓN
// ====================================================================
async function procesarLogin(e) {
  e.preventDefault();
  const correo = document.getElementById('login-correo').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });
    const data = await res.json();
    if (data.exito) {
      usuarioActual = data.usuario;
      localStorage.setItem('usuario_lavadoras', JSON.stringify(usuarioActual));
      actualizarInfoUsuario();
      alert(`¡Bienvenido, ${usuarioActual.nombre}!`);
      cambiarPantalla('pantalla-dashboard');
    } else {
      alert(data.mensaje || 'Error al iniciar sesión');
    }
  } catch (err) {
    alert('Error conectando con el servidor');
  }
}

function cerrarSesion() {
  if (confirm('¿Deseas cerrar tu sesión actual?')) {
    cambiarPantalla('pantalla-login');
  }
}

// ====================================================================
// 3. PASO 5: DASHBOARD Y SERVICIOS EN VIVO
// ====================================================================
async function cargarDashboard() {
  try {
    // 1. KPIs
    const resKpis = await fetch(`${API_URL}/dashboard/kpis`);
    const kpis = await resKpis.json();
    document.getElementById('kpi-disponibles').innerText = `${kpis.disponibles} Máquinas`;
    document.getElementById('kpi-alquiladas').innerText = `${kpis.alquiladas} Máquinas`;
    document.getElementById('kpi-reservas').innerText = `${kpis.reservas_hoy} Agendadas`;
    document.getElementById('kpi-ingresos').innerText = `$${kpis.ingresos_hoy.toLocaleString('es-CO')}`;

    // 2. Alquileres en curso
    const resAlq = await fetch(`${API_URL}/alquileres/activos`);
    const activos = await resAlq.json();
    const tbody = document.getElementById('tabla-dashboard-activos');
    tbody.innerHTML = '';

    if (activos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No hay lavadoras en servicio en este momento.</td></tr>`;
      return;
    }

    activos.forEach(a => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${a.lavadora || a.lavadora_codigo}</strong></td>
          <td>${a.cliente}</td>
          <td>${a.direccion}</td>
          <td>${a.horas || a.horas_contratadas} hr(s)</td>
          <td>${a.hora_salida}</td>
          <td><span class="badge badge-alquilada">En Servicio</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="finalizarAlquiler(${a.id_alquiler})">
              <i class="fa-solid fa-arrow-down-left-and-arrow-up-right-to-center"></i> Recibir
            </button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

// ====================================================================
// 4. PASO 6: CLIENTES
// ====================================================================
async function cargarClientes(termino = '') {
  try {
    const res = await fetch(`${API_URL}/clientes?q=${encodeURIComponent(termino)}`);
    listaClientes = await res.json();
    const tbody = document.getElementById('tabla-clientes');
    tbody.innerHTML = '';

    if (listaClientes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No se encontraron clientes registrados.</td></tr>`;
      return;
    }

    listaClientes.forEach(c => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${c.cedula}</strong></td>
          <td>${c.nombre_completo}</td>
          <td>${c.telefono}</td>
          <td>${c.direccion}</td>
          <td><span class="badge" style="background:#eff6ff; color:#1e40af;">${c.total_alquileres || 0} servicio(s)</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="alquilarACliente(${c.id_cliente})">
              <i class="fa-solid fa-stopwatch"></i> Alquilar
            </button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Error cargando clientes:', err);
  }
}

async function guardarCliente(e) {
  e.preventDefault();
  const clienteData = {
    cedula: document.getElementById('cli-cedula').value.trim(),
    nombre_completo: document.getElementById('cli-nombre').value.trim(),
    telefono: document.getElementById('cli-telefono').value.trim(),
    direccion: document.getElementById('cli-direccion').value.trim()
  };

  try {
    const res = await fetch(`${API_URL}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clienteData)
    });
    const data = await res.json();
    if (res.ok) {
      alert('✅ Cliente registrado exitosamente.');
      document.getElementById('form-nuevo-cliente').reset();
      cargarClientes();
    } else {
      alert('❌ ' + (data.error || 'Error al guardar cliente'));
    }
  } catch (err) {
    alert('Error conectando con el servidor.');
  }
}

// ====================================================================
// 5. PASO 7: LAVADORAS
// ====================================================================
async function cargarLavadoras() {
  try {
    const res = await fetch(`${API_URL}/lavadoras`);
    listaLavadoras = await res.json();
    const contenedor = document.getElementById('catalogo-lavadoras');
    contenedor.innerHTML = '';

    listaLavadoras.forEach(l => {
      const estadoClass = l.estado.toLowerCase();
      let botonAccion = '';

      if (l.estado === 'DISPONIBLE') {
        botonAccion = `<button class="btn btn-primary btn-sm" style="width:100%;" onclick="iniciarAlquilerDeLavadora(${l.id_lavadora})"><i class="fa-solid fa-play"></i> Alquilar Ahora</button>`;
      } else if (l.estado === 'ALQUILADA') {
        botonAccion = `<button class="btn btn-outline btn-sm" style="width:100%;" onclick="cambiarPantalla('pantalla-dashboard')"><i class="fa-solid fa-eye"></i> Ver en Servicio</button>`;
      } else {
        botonAccion = `<button class="btn btn-outline btn-sm" style="width:100%;" onclick="cambiarPantalla('pantalla-mantenimiento')"><i class="fa-solid fa-wrench"></i> Ver Falla</button>`;
      }

      contenedor.innerHTML += `
        <div class="washer-box ${estadoClass}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:16px;">${l.codigo}</h3>
            <span class="badge badge-${estadoClass}">${l.estado}</span>
          </div>
          <p style="font-size:13px; color:var(--gris-texto-muted); margin-bottom:4px;">Marca: <strong>${l.marca}</strong></p>
          <p style="font-size:13px; color:var(--gris-texto-muted); margin-bottom:4px;">Capacidad: <strong>${l.capacidad_kg} Kg</strong></p>
          <p style="font-size:16px; font-weight:700; color:var(--azul-primario); margin:12px 0;">$${parseFloat(l.tarifa_hora).toLocaleString('es-CO')} / hora</p>
          ${botonAccion}
        </div>
      `;
    });
  } catch (err) {
    console.error('Error cargando lavadoras:', err);
  }
}

async function guardarLavadora(e) {
  e.preventDefault();
  const lavData = {
    codigo: document.getElementById('lav-codigo').value.trim(),
    marca: document.getElementById('lav-marca').value.trim(),
    capacidad_kg: document.getElementById('lav-capacidad').value,
    tarifa_hora: document.getElementById('lav-tarifa').value
  };

  try {
    const res = await fetch(`${API_URL}/lavadoras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lavData)
    });
    if (res.ok) {
      alert('✅ Lavadora agregada al inventario.');
      document.getElementById('form-nueva-lavadora').reset();
      cargarLavadoras();
    }
  } catch (err) {
    alert('Error al guardar lavadora');
  }
}

// ====================================================================
// 6. PASO 8: RESERVAS POR HORAS
// ====================================================================
async function cargarReservas() {
  try {
    // Actualizar combos
    const selCliente = document.getElementById('resv-cliente');
    const selLavadora = document.getElementById('resv-lavadora');
    selCliente.innerHTML = listaClientes.map(c => `<option value="${c.id_cliente}">${c.nombre_completo} (${c.cedula})</option>`).join('');
    selLavadora.innerHTML = listaLavadoras.filter(l => l.estado === 'DISPONIBLE').map(l => `<option value="${l.id_lavadora}">${l.codigo} - ${l.marca} (${l.capacidad_kg}kg) - $${parseFloat(l.tarifa_hora).toLocaleString('es-CO')}/hr</option>`).join('');

    const res = await fetch(`${API_URL}/reservas`);
    const reservas = await res.json();
    const tbody = document.getElementById('tabla-reservas');
    tbody.innerHTML = '';

    if (reservas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No hay reservas programadas.</td></tr>`;
      return;
    }

    reservas.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td><strong>#RES-${r.id_reserva}</strong></td>
          <td>${r.cliente}</td>
          <td>${r.lavadora || r.lavadora_codigo}</td>
          <td>${r.fecha_reserva || r.fecha}</td>
          <td>${r.hora_inicio} - ${r.hora_fin}</td>
          <td><span class="badge" style="background:#dbeafe; color:#1e40af;">${r.estado}</span></td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Error cargando reservas:', err);
  }
}

async function guardarReserva(e) {
  e.preventDefault();
  const resvData = {
    id_cliente: document.getElementById('resv-cliente').value,
    id_lavadora: document.getElementById('resv-lavadora').value,
    fecha_reserva: document.getElementById('resv-fecha').value,
    hora_inicio: document.getElementById('resv-inicio').value,
    hora_fin: document.getElementById('resv-fin').value
  };

  try {
    const res = await fetch(`${API_URL}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resvData)
    });
    const data = await res.json();
    if (res.ok) {
      alert('✅ ' + data.mensaje);
      cargarReservas();
    } else {
      alert('⚠️ ' + (data.error || 'No se pudo agendar'));
    }
  } catch (err) {
    alert('Error al procesar reserva');
  }
}

// ====================================================================
// 7. PASO 9: ALQUILER EN VIVO Y CÁLCULO DE COSTO AUTOMÁTICO
// ====================================================================
function prepararFormularioAlquiler() {
  const selCli = document.getElementById('alq-cliente');
  const selLav = document.getElementById('alq-lavadora');

  selCli.innerHTML = listaClientes.map(c => `<option value="${c.id_cliente}">${c.nombre_completo} (${c.direccion})</option>`).join('');
  
  const disponibles = listaLavadoras.filter(l => l.estado === 'DISPONIBLE');
  if (disponibles.length === 0) {
    selLav.innerHTML = `<option value="">⚠️ No hay lavadoras disponibles</option>`;
  } else {
    selLav.innerHTML = disponibles.map(l => `<option value="${l.id_lavadora}" data-tarifa="${l.tarifa_hora}">${l.codigo} - ${l.marca} (${l.capacidad_kg}kg) - $${parseFloat(l.tarifa_hora).toLocaleString('es-CO')}/hr</option>`).join('');
  }
  recalcularTotalAlquiler();
}

function recalcularTotalAlquiler() {
  const horas = parseInt(document.getElementById('alq-horas').value) || 1;
  const selLav = document.getElementById('alq-lavadora');
  const opcion = selLav.options[selLav.selectedIndex];
  const tarifa = opcion ? parseFloat(opcion.getAttribute('data-tarifa') || 5000) : 5000;
  const total = horas * tarifa;
  document.getElementById('alq-total-texto').innerText = `$${total.toLocaleString('es-CO')} COP (${horas} hora${horas > 1 ? 's' : ''})`;
}

async function procesarDespachoAlquiler(e) {
  e.preventDefault();
  const id_cliente = document.getElementById('alq-cliente').value;
  const id_lavadora = document.getElementById('alq-lavadora').value;
  const horas = document.getElementById('alq-horas').value;
  const metodo_pago = document.getElementById('alq-metodo-pago').value;

  if (!id_lavadora) {
    alert('Por favor selecciona una lavadora disponible');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/alquileres`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cliente, id_lavadora, horas, metodo_pago })
    });
    const data = await res.json();
    if (res.ok) {
      alert('🎉 ¡Alquiler iniciado con éxito! Comprobante: ' + data.numero_comprobante);
      cargarLavadoras();
      cargarDashboard();
      cambiarPantalla('pantalla-pagos');
    } else {
      alert('❌ ' + (data.error || 'No se pudo iniciar alquiler'));
    }
  } catch (err) {
    alert('Error al conectar con servidor');
  }
}

async function finalizarAlquiler(idAlquiler) {
  const tieneDano = confirm('¿La lavadora devuelta presenta algún DAÑO o AVERÍA técnica?\n\n- Haz clic en [Aceptar] si tiene daños (para registrar en Mantenimiento).\n- Haz clic en [Cancelar] si fue devuelta en perfecto estado.');
  let descripcion_dano = '';
  if (tieneDano) {
    descripcion_dano = prompt('Escribe el detalle del daño encontrado en la máquina:');
    if (!descripcion_dano) descripcion_dano = 'Daño físico reportado al momento de la entrega por el cliente.';
  }

  try {
    const res = await fetch(`${API_URL}/alquileres/${idAlquiler}/devolucion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ con_dano: tieneDano, descripcion_dano })
    });
    const data = await res.json();
    if (res.ok) {
      alert('✅ ' + data.mensaje);
      cargarDashboard();
      cargarLavadoras();
    }
  } catch (err) {
    alert('Error al procesar devolución');
  }
}

function iniciarAlquilerDeLavadora(idLavadora) {
  cambiarPantalla('pantalla-alquiler');
  setTimeout(() => {
    document.getElementById('alq-lavadora').value = idLavadora;
    recalcularTotalAlquiler();
  }, 100);
}

function alquilarACliente(idCliente) {
  cambiarPantalla('pantalla-alquiler');
  setTimeout(() => {
    document.getElementById('alq-cliente').value = idCliente;
    recalcularTotalAlquiler();
  }, 100);
}

// ====================================================================
// 8. PASO 10: PAGOS, MANTENIMIENTOS Y REPORTES
// ====================================================================
async function cargarPagos() {
  try {
    const res = await fetch(`${API_URL}/pagos`);
    const pagos = await res.json();
    if (pagos.length > 0) {
      const ultimo = pagos[0];
      document.getElementById('recibo-numero').innerText = `RECIBO OFICIAL N° ${ultimo.numero_comprobante}`;
      document.getElementById('recibo-fecha').innerText = ultimo.fecha_pago || ultimo.fecha;
      document.getElementById('recibo-cliente').innerText = ultimo.cliente;
      document.getElementById('recibo-cedula').innerText = ultimo.cedula || '1020304050';
      document.getElementById('recibo-direccion').innerText = ultimo.direccion || 'Calle 10 # 45-20';
      document.getElementById('recibo-lavadora').innerText = ultimo.lavadora || ultimo.lavadora_codigo;
      document.getElementById('recibo-tiempo').innerText = `${ultimo.horas} Horas`;
      document.getElementById('recibo-metodo').innerText = ultimo.metodo_pago;
      document.getElementById('recibo-total').innerText = `$${parseFloat(ultimo.monto).toLocaleString('es-CO')} COP`;
    }
  } catch (err) {
    console.error('Error cargando pagos:', err);
  }
}

async function cargarMantenimientos() {
  try {
    const selLav = document.getElementById('mant-lavadora');
    selLav.innerHTML = listaLavadoras.map(l => `<option value="${l.id_lavadora}">${l.codigo} - ${l.marca} (${l.estado})</option>`).join('');

    const res = await fetch(`${API_URL}/mantenimientos`);
    const lista = await res.json();
    const tbody = document.getElementById('tabla-mantenimiento');
    tbody.innerHTML = '';

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No hay máquinas en mantenimiento actualmente.</td></tr>`;
      return;
    }

    lista.forEach(m => {
      const resuelto = m.estado === 'RESUELTO';
      tbody.innerHTML += `
        <tr>
          <td><strong>${m.lavadora || m.lavadora_codigo}</strong></td>
          <td>${m.descripcion_dano}</td>
          <td>${m.fecha_reporte}</td>
          <td><span class="badge ${resuelto ? 'badge-disponible' : 'badge-mantenimiento'}">${m.estado}</span></td>
          <td>
            ${!resuelto ? `<button class="btn btn-outline btn-sm" onclick="resolverFalla(${m.id_mantenimiento})"><i class="fa-solid fa-check"></i> Marcar Resuelto</button>` : '<span>Listo</span>'}
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Error cargando mantenimientos:', err);
  }
}

async function guardarMantenimiento(e) {
  e.preventDefault();
  const mantData = {
    id_lavadora: document.getElementById('mant-lavadora').value,
    descripcion_dano: document.getElementById('mant-descripcion').value.trim()
  };

  try {
    const res = await fetch(`${API_URL}/mantenimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mantData)
    });
    if (res.ok) {
      alert('⚠️ Máquina enviada a mantenimiento y bloqueada para nuevos alquileres.');
      document.getElementById('form-nuevo-mantenimiento').reset();
      cargarMantenimientos();
      cargarLavadoras();
      cargarDashboard();
    }
  } catch (err) {
    alert('Error al enviar a mantenimiento');
  }
}

async function resolverFalla(idMantenimiento) {
  try {
    const res = await fetch(`${API_URL}/mantenimientos/${idMantenimiento}/resolver`, { method: 'PUT' });
    if (res.ok) {
      alert('✅ Máquina reparada. Ha vuelto a estar DISPONIBLE en el inventario.');
      cargarMantenimientos();
      cargarLavadoras();
      cargarDashboard();
    }
  } catch (err) {
    alert('Error al resolver falla');
  }
}

async function cargarReportes() {
  try {
    const res = await fetch(`${API_URL}/reportes/financieros`);
    const data = await res.json();
    document.getElementById('rep-total-hoy').innerText = `$${parseFloat(data.diario).toLocaleString('es-CO')}`;
    document.getElementById('rep-cant-hoy').innerText = `${data.alquileres_hoy} Servicios`;
    document.getElementById('rep-total-mes').innerText = `$${parseFloat(data.mensual).toLocaleString('es-CO')}`;
    document.getElementById('rep-top-lavadora').innerText = data.lavadora_top;
  } catch (err) {
    console.error('Error cargando reportes:', err);
  }
}

function imprimirRecibo() {
  window.print();
}
