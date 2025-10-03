// visor-iva.js - Lógica mejorada para UI
(function(){
	// -----------------------------
	// Estado y elementos
	// -----------------------------
	const state = {
		cbteFile: null,
		alicuotasFile: null,
		recent: JSON.parse(localStorage.getItem('recentFiles') || '[]'),
		dataWithErrors: [],
		cbteRawData: [],
		filteredData: [],
		selectedRows: new Set(),
		currentSort: { field: null, direction: 'asc' },
		customLayouts: JSON.parse(localStorage.getItem('customLayouts') || '{}')
	};

	const els = {
		dropArea: document.getElementById('dropArea'),
		fileInput: document.getElementById('fileInput'),
		cbteStatus: document.getElementById('cbteStatus'),
		alicuotasStatus: document.getElementById('alicuotasStatus'),
		compareBtn: document.getElementById('compareBtn'),
		clearBtn: document.getElementById('clearBtn'),
		downloadSampleBtn: document.getElementById('downloadSampleBtn'),
		recentList: document.getElementById('recentList'),
		progressBar: document.getElementById('progressBar'),
		themeSelect: document.getElementById('themeSelect'),
		compactToggle: document.getElementById('compactToggle'),
		previewBtn: document.getElementById('previewBtn'),
		layoutEditorModal: document.getElementById('layoutEditorModal'),
		layoutEditorContent: document.getElementById('layoutEditorContent'),
		saveLayoutBtn: document.getElementById('saveLayoutBtn'),
		resetLayoutBtn: document.getElementById('resetLayoutBtn'),
		resultsSection: document.getElementById('resultsSection')
	};

	// -----------------------------
	// Layouts por defecto
	// -----------------------------
	const DEFAULT_LAYOUTS = {
		CBTE_VENTAS: [
			{ name: 'fecha', start: 0, end: 8, len: 8 }, { name: 'tipoCbte', start: 8, end: 11, len: 3 },
			{ name: 'puntoVenta', start: 11, end: 16, len: 5 }, { name: 'numeroCbte', start: 16, end: 36, len: 20 },
			{ name: 'nroIDCliente', start: 58, end: 78, len: 20 }, { name: 'nombreCliente', start: 78, end: 108, len: 30, trim: true },
			{ name: 'montoTotal', start: 108, end: 123, len: 15, type: 'float' },
		],
		ALICUOTAS_VENTAS: [
			{ name: 'tipoCbte', start: 0, end: 3, len: 3 }, { name: 'puntoVenta', start: 3, end: 8, len: 5 },
			{ name: 'numeroCbte', start: 8, end: 28, len: 20 }, { name: 'netoGravado', start: 28, end: 43, len: 15, type: 'float' },
			{ name: 'codAlicuota', start: 43, end: 47, len: 4 }, { name: 'montoIVA', start: 47, end: 62, len: 15, type: 'float' },
		],
		CBTE_COMPRAS: [
			{ name: 'fecha', start: 0, end: 8, len: 8 }, { name: 'tipoCbte', start: 8, end: 11, len: 3 },
			{ name: 'puntoVenta', start: 11, end: 16, len: 5 }, { name: 'numeroCbte', start: 16, end: 36, len: 20 },
			{ name: 'cuitProveedor', start: 58, end: 78, len: 20 }, { name: 'nombreProveedor', start: 78, end: 108, len: 30, trim: true },
			{ name: 'montoTotal', start: 108, end: 123, len: 15, type: 'float' },
		],
		ALICUOTAS_COMPRAS: [
			{ name: 'tipoCbte', start: 0, end: 3, len: 3 }, { name: 'puntoVenta', start: 3, end: 8, len: 5 },
			{ name: 'numeroCbte', start: 8, end: 28, len: 20 }, { name: 'netoGravado', start: 28, end: 43, len: 15, type: 'float' },
			{ name: 'codAlicuota', start: 43, end: 47, len: 4 }, { name: 'montoIVA', start: 47, end: 62, len: 15, type: 'float' },
		]
	};

	const FILE_LAYOUTS = { ...DEFAULT_LAYOUTS, ...state.customLayouts };

	// -----------------------------
	// Utilidades
	// -----------------------------
	function showToast(message, type = 'success'){
		const containerId = 'toast-container';
		let container = document.getElementById(containerId);
		if(!container){ container = document.createElement('div'); container.id = containerId; container.style.position = 'fixed'; container.style.right = '20px'; container.style.bottom = '20px'; container.style.zIndex = '3000'; document.body.appendChild(container); }
		const el = document.createElement('div'); el.className = `toast ${type}`; el.style.marginTop='8px'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.background = type==='success'? '#062f2f' : '#2f0606'; el.style.color='#fff'; el.innerText = message; container.appendChild(el);
		setTimeout(()=> el.remove(), 4000);
	}

	function setProgress(p){ if(els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, p)) + '%'; }

	function readFileAsText(file, encoding='windows-1252'){ return new Promise((resolve,reject)=>{ if(!file) return reject(new Error('Archivo no seleccionado')); const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = e => reject(e); r.readAsText(file, encoding); }); }

	function parseLine(line, layout){
		const record = {};
		for(const field of layout){
			let value = line.substring(field.start, field.end);
			if(field.trim) value = value.trim();
			record[field.name] = (field.type === 'float') ? (parseFloat(value) / 100 || 0) : value;
		}
		return record;
	}

	function getVoucherKey(voucher){ return `${String(voucher.tipoCbte || '').trim()}-${String(voucher.puntoVenta || '').trim()}-${String(voucher.numeroCbte || '').trim()}`; }

	function validateCuit(cuit){
		if (!/^\d{11}$/.test(cuit)) return false;
		const multipliers = [5,4,3,2,7,6,5,4,3,2];
		let sum = 0;
		for(let i=0;i<10;i++) sum += parseInt(cuit[i]) * multipliers[i];
		let checkDigit = 11 - (sum % 11);
		if(checkDigit === 11) checkDigit = 0;
		if(checkDigit === 10) checkDigit = 9;
		return checkDigit === parseInt(cuit[10]);
	}

	function validateDate(dateStr){ if(!/^\d{8}$/.test(dateStr)) return false; const year = parseInt(dateStr.substring(0,4)); const month = parseInt(dateStr.substring(4,6)); const day = parseInt(dateStr.substring(6,8)); const d = new Date(year, month-1, day); return d.getFullYear()===year && d.getMonth()===month-1 && d.getDate()===day; }

	// -----------------------------
	// UI: Tema / Compact / Drag
	// -----------------------------
	function applyTheme(){ const val = els.themeSelect?.value || 'dark'; document.body.classList.toggle('light', val==='light'); document.documentElement.classList.toggle('light', val==='light'); }
	function applyCompactMode(){ document.body.classList.toggle('compact', els.compactToggle.checked); }
	function bindDragAndDrop(){ ['dragenter','dragover','dragleave','drop'].forEach(ev=> els.dropArea.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); })); els.dropArea.addEventListener('click', ()=> els.fileInput.click()); els.dropArea.addEventListener('drop', e=> onFileList(e.dataTransfer.files)); els.fileInput.addEventListener('change', e=> onFileList(e.target.files)); }

	function onFileList(files){
		for(const f of files){
			const name = f.name.toUpperCase();
			if(name.includes('CBTE')){ state.cbteFile = f; els.cbteStatus.textContent = `Comprobantes: ${f.name}`; els.cbteStatus.classList.remove('text-danger'); els.cbteStatus.classList.add('text-success'); }
			else if(name.includes('ALICUOTAS')){ state.alicuotasFile = f; els.alicuotasStatus.textContent = `Alícuotas: ${f.name}`; els.alicuotasStatus.classList.remove('text-danger'); els.alicuotasStatus.classList.add('text-success'); }
		}
		saveRecent();
	}

	function saveRecent(){ const entry = { time: Date.now(), cbte: state.cbteFile?.name || null, alicuotas: state.alicuotasFile?.name || null }; state.recent.unshift(entry); state.recent = state.recent.slice(0,10); localStorage.setItem('recentFiles', JSON.stringify(state.recent)); renderRecent(); }
	function renderRecent(){ if(!els.recentList) return; els.recentList.innerHTML = ''; if(!state.recent.length){ els.recentList.innerHTML = '<li><span class="dropdown-item-text">Sin historial</span></li>'; return; } for(const r of state.recent){ const li = document.createElement('li'); const time = new Date(r.time).toLocaleString(); li.innerHTML = `<button class="dropdown-item">${time} — ${r.cbte||'-'} / ${r.alicuotas||'-'}</button>`; els.recentList.appendChild(li); } }

	function downloadSamples(){ const cbteSample = '202501010010000000000000000000000000000000000000000000000000000000000'; const alicuotasSample = '0010000000000000000000000000000000000000000000000000000000000000000'; createAndDownload(cbteSample, 'muestra_CBTE.txt'); createAndDownload(alicuotasSample, 'muestra_ALICUOTAS.txt'); showToast('Archivos de muestra descargados','success'); }
	function createAndDownload(content, filename){ const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

	// -----------------------------
	// Comparación y renderizado
	// -----------------------------
	async function analyzeFiles(){
		if(!state.cbteFile || !state.alicuotasFile){ showToast('Por favor, carga ambos archivos antes de analizar.', 'error'); return; }
		try{
			els.compareBtn.disabled = true; setProgress(5);
			const encoding = document.getElementById('encoding').value;
			const tolerancia = parseFloat(document.getElementById('tolerancia').value);
			const tipoOperacion = document.getElementById('tipoOperacion').value;

			const [cbteText, alicuotasText] = await Promise.all([ readFileAsText(state.cbteFile, encoding), readFileAsText(state.alicuotasFile, encoding) ]);
			setProgress(30);

			const cbteLayoutKey = tipoOperacion === 'ventas' ? 'CBTE_VENTAS' : 'CBTE_COMPRAS';
			const alicuotasLayoutKey = tipoOperacion === 'ventas' ? 'ALICUOTAS_VENTAS' : 'ALICUOTAS_COMPRAS';

			const alicuotasMap = new Map();
			alicuotasText.split(/\r?\n/).forEach(line => {
				if(!line) return;
				const layout = FILE_LAYOUTS[alicuotasLayoutKey];
				if(line.length < layout[layout.length-1].end) return;
				const alicuota = parseLine(line, layout);
				const key = getVoucherKey(alicuota);
				const totalAlicuota = (alicuota.netoGravado||0) + (alicuota.montoIVA||0);
				alicuotasMap.set(key, (alicuotasMap.get(key) || 0) + totalAlicuota);
			});

			state.cbteRawData = cbteText.split(/\r?\n/).filter(line => line.trim().length >= FILE_LAYOUTS[cbteLayoutKey][FILE_LAYOUTS[cbteLayoutKey].length - 1].end);
			const allVouchers = state.cbteRawData.map((line, index) => ({ ...parseLine(line, FILE_LAYOUTS[cbteLayoutKey]), originalIndex: index }));

			state.dataWithErrors = [];
			let correctCount = 0;
			allVouchers.forEach(cbte => {
				const key = getVoucherKey(cbte);
				const totalFromAlicuotas = alicuotasMap.get(key);
				if(totalFromAlicuotas === undefined){ state.dataWithErrors.push({ ...cbte, error: 'Sin alícuotas', type: 'missing' }); }
				else if(Math.abs(cbte.montoTotal - totalFromAlicuotas) > tolerancia){ const diff = cbte.montoTotal - totalFromAlicuotas; state.dataWithErrors.push({ ...cbte, error: `Descuadre ($${diff.toFixed(2)})`, type: 'amount_diff' }); }
				else { correctCount++; }
			});

			state.filteredData = [...state.dataWithErrors];
			renderResults({ totalProcessed: allVouchers.length, correctCount, differences: state.dataWithErrors, tipoOperacion });
			setProgress(100);
			setTimeout(()=> setProgress(0), 300);

		} catch(err){ els.resultsSection.innerHTML = `<div class="alert alert-danger">⚠️ Error Crítico: ${err.message}</div>`; }
		finally{ els.compareBtn.disabled = false; }
	}

	function renderResults(data){
		let html = `
			<div class="card bg-dark text-white p-3">
				<h5>Resumen del Análisis</h5>
				<div class="d-flex gap-3 justify-content-center my-3">
					<div class="stat p-2"><div class="stat-number">${data.totalProcessed}</div><div class="stat-label">Comprobantes Procesados</div></div>
					<div class="stat p-2"><div class="stat-number">${data.differences.length}</div><div class="stat-label">Con Errores</div></div>
					<div class="stat p-2"><div class="stat-number">${data.correctCount}</div><div class="stat-label">Correctos</div></div>
				</div>
		`;

		if(data.differences.length > 0){
			html += `
				<div class="alert alert-warning">💡 <strong>Modo Edición Activado:</strong> Haz clic en las celdas para corregir valores. Usa filtros y edición en lote.</div>
				<div class="table-responsive">
					<div id="tableControls"></div>
					<table class="table table-sm table-dark table-hover">
						<thead>
							<tr>
								<th><input type="checkbox" id="selectAllCheckbox"></th>
								<th class="sortable" data-field="fecha">Fecha</th>
								<th class="sortable" data-field="tipoCbte">Tipo</th>
								<th class="sortable" data-field="puntoVenta">P.V.</th>
								<th class="sortable" data-field="numeroCbte">Número</th>
								<th class="sortable" data-field="ident">CUIT/DNI</th>
								<th class="sortable" data-field="nombre">Nombre</th>
								<th class="sortable" data-field="montoTotal">Monto Total</th>
								<th class="sortable">Error Detectado</th>
							</tr>
						</thead>
						<tbody id="resultsTableBody"></tbody>
					</table>
				</div>
				<div class="d-flex gap-2 justify-content-center mt-3">
					<button id="generateFilesBtn" class="btn btn-primary">💾 Generar Archivo Corregido</button>
					<button id="exportCsvBtn" class="btn btn-success">📄 Exportar Errores a CSV</button>
				</div>
			`;
		} else if(data.totalProcessed > 0){
			html += `<div class="alert alert-success mt-3">✅ ¡Excelente! No se encontraron diferencias entre los archivos.</div>`;
		}

		html += `</div>`;
		els.resultsSection.innerHTML = html;

		if(data.differences.length > 0){ rerenderTable(data.differences); setupFilterControls(); document.getElementById('generateFilesBtn').addEventListener('click', generateCorrectedFiles); document.getElementById('exportCsvBtn').addEventListener('click', exportErrorReport); document.getElementById('selectAllCheckbox').addEventListener('change', handleSelectAll); }
	}

	function rerenderTable(data){
		const tbody = document.getElementById('resultsTableBody'); if(!tbody) return;
		const tipoOp = document.getElementById('tipoOperacion').value;
		const idField = tipoOp === 'ventas' ? 'nroIDCliente' : 'cuitProveedor';
		const nameField = tipoOp === 'ventas' ? 'nombreCliente' : 'nombreProveedor';

		tbody.innerHTML = data.map((diff, index) => `
			<tr data-original-index="${diff.originalIndex}">
				<td><input type="checkbox" data-row-index="${index}"></td>
				<td contenteditable="true" data-field="fecha">${diff.fecha}</td>
				<td contenteditable="true" data-field="tipoCbte">${diff.tipoCbte}</td>
				<td contenteditable="true" data-field="puntoVenta">${diff.puntoVenta}</td>
				<td contenteditable="true" data-field="numeroCbte">${diff.numeroCbte}</td>
				<td contenteditable="true" data-field="${idField}">${diff[idField] || ''}</td>
				<td contenteditable="true" data-field="${nameField}">${diff[nameField] || ''}</td>
				<td contenteditable="true" data-field="montoTotal">${(diff.montoTotal||0).toFixed(2)}</td>
				<td class="text-warning">${diff.error}</td>
			</tr>
		`).join('');

		setupTableEventListeners(); updateSortIcons();
	}

	function setupTableEventListeners(){
		document.querySelectorAll('td[contenteditable="true"]').forEach(cell=> cell.addEventListener('blur', function(){ const originalIndex = parseInt(this.closest('tr').dataset.originalIndex); const field = this.dataset.field; let value = this.textContent.trim(); const record = state.dataWithErrors.find(d=> d.originalIndex === originalIndex); if(!record) return; if(field === 'montoTotal') value = parseFloat(value) || 0; record[field] = value; }));
		document.querySelectorAll('tbody input[type="checkbox"]').forEach(cb=> cb.addEventListener('change', handleRowSelection));
		document.querySelectorAll('.sortable').forEach(h=> h.addEventListener('click', ()=> sortTable(h.dataset.field)));
	}

	function handleRowSelection(event){ const rowIndex = parseInt(event.target.dataset.rowIndex); if(event.target.checked) state.selectedRows.add(rowIndex); else state.selectedRows.delete(rowIndex); const sc = document.getElementById('selectedCount'); if(sc) sc.textContent = state.selectedRows.size; const bc = document.getElementById('batchControls'); if(bc) bc.style.display = state.selectedRows.size>0 ? 'block':'none'; }

	function handleSelectAll(event){ const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]'); state.selectedRows.clear(); checkboxes.forEach((checkbox, index)=>{ checkbox.checked = event.target.checked; if(event.target.checked) state.selectedRows.add(index); }); const sc = document.getElementById('selectedCount'); if(sc) sc.textContent = state.selectedRows.size; const bc = document.getElementById('batchControls'); if(bc) bc.style.display = state.selectedRows.size>0 ? 'block':'none'; }

	function sortTable(field){ if(!field) return; if(state.currentSort.field === field) state.currentSort.direction = state.currentSort.direction === 'asc' ? 'desc':'asc'; else { state.currentSort.field = field; state.currentSort.direction = 'asc'; } const sorted = [...state.filteredData].sort((a,b)=>{ let va = a[field]; let vb = b[field]; if(typeof va === 'number' && typeof vb === 'number') return state.currentSort.direction === 'asc' ? va - vb : vb - va; va = (va||'').toString().toLowerCase(); vb = (vb||'').toString().toLowerCase(); return state.currentSort.direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }); state.filteredData = sorted; rerenderTable(state.filteredData); }

	function updateSortIcons(){ document.querySelectorAll('.sortable').forEach(el=>{ const icon = el.querySelector('.sort-icon'); if(icon) icon.textContent=''; }); const active = document.querySelector(`.sortable[data-field="${state.currentSort.field}"]`); if(active){ let s = active.querySelector('.sort-icon'); if(!s){ s = document.createElement('span'); s.className='sort-icon'; active.appendChild(s); } s.textContent = state.currentSort.direction==='asc' ? '▲' : '▼'; } }

	function setupFilterControls(){ const filterHtml = `
		<div class="d-flex gap-2 mb-2 align-items-center">
			<input id="filterText" class="form-control form-control-sm" placeholder="🔍 Filtrar por texto...">
			<select id="filterErrorType" class="form-select form-select-sm" style="width:180px;"><option value="">Todos</option><option value="missing">Sin alícuotas</option><option value="amount_diff">Descuadres</option></select>
			<button id="clearFiltersBtn" class="btn btn-sm btn-secondary">Limpiar</button>
		</div>
		<div id="batchControls" class="p-2 bg-secondary rounded" style="display:none;">
			<div class="d-flex gap-2 align-items-center">
				<div>Edición en lote (<span id="selectedCount">0</span>)</div>
				<select id="batchField" class="form-select form-select-sm" style="width:200px;"><option value="">Seleccionar campo</option><option value="tipoCbte">Tipo</option><option value="puntoVenta">PuntoVenta</option></select>
				<input id="batchValue" class="form-control form-control-sm" placeholder="Valor..." style="width:160px;">
				<button id="applyBatchBtn" class="btn btn-sm btn-warning">Aplicar</button>
			</div>
		</div>
	`; const tc = document.getElementById('tableControls'); if(tc){ tc.innerHTML = filterHtml; document.getElementById('filterText').addEventListener('input', applyFilters); document.getElementById('filterErrorType').addEventListener('change', applyFilters); document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters); document.getElementById('applyBatchBtn').addEventListener('click', applyBatchEdit); } }

	function applyFilters(){ const text = document.getElementById('filterText').value.toLowerCase(); const type = document.getElementById('filterErrorType').value; state.filteredData = state.dataWithErrors.filter(item=>{ const matchesText = !text || Object.values(item).some(v=> (v||'').toString().toLowerCase().includes(text)); const matchesType = !type || item.type === type; return matchesText && matchesType; }); rerenderTable(state.filteredData); }
	function clearFilters(){ document.getElementById('filterText').value=''; document.getElementById('filterErrorType').value=''; state.filteredData = [...state.dataWithErrors]; rerenderTable(state.filteredData); }

	function applyBatchEdit(){ const field = document.getElementById('batchField').value; const value = document.getElementById('batchValue').value; if(!field || value === ''){ showToast('Selecciona un campo y proporciona un valor.', 'error'); return; } let changeCount=0; state.selectedRows.forEach(index=>{ if(state.filteredData[index]){ state.filteredData[index][field]=value; const original = state.dataWithErrors.find(d=> d.originalIndex === state.filteredData[index].originalIndex); if(original) original[field]=value; changeCount++; } }); rerenderTable(state.filteredData); showToast(`${changeCount} registros actualizados.`, 'success'); }

	function generateCorrectedFiles(){ if(!state.cbteRawData.length){ showToast('No hay datos originales para procesar.', 'error'); return; } try{ const tipoOp = document.getElementById('tipoOperacion').value; const cbteLayoutKey = tipoOp === 'ventas' ? 'CBTE_VENTAS' : 'CBTE_COMPRAS'; const cbteLayout = FILE_LAYOUTS[cbteLayoutKey]; const correctedLines = state.cbteRawData.map((originalLine, index)=>{ const correctedData = state.dataWithErrors.find(d=> d.originalIndex === index); if(!correctedData) return originalLine; let newLine = ' '.repeat(200); cbteLayout.forEach(field=>{ let value = correctedData[field.name]; if(value === undefined){ const altField = field.name === 'nroIDCliente' ? 'cuitProveedor' : (field.name === 'cuitProveedor' ? 'nroIDCliente' : null); if(altField) value = correctedData[altField]; } if(value === undefined){ const altNameField = field.name === 'nombreCliente' ? 'nombreProveedor' : (field.name === 'nombreProveedor' ? 'nombreCliente' : null); if(altNameField) value = correctedData[altNameField]; } if(value === undefined) value = ''; if(field.type === 'float'){ value = Math.round(value * 100).toString().padStart(field.len, '0'); } else { value = value.toString(); if(field.trim) value = value.padEnd(field.len, ' '); else value = value.padStart(field.len, '0'); } value = value.substring(0, field.len); newLine = newLine.substring(0, field.start) + value + newLine.substring(field.start + value.length); }); return newLine.substring(0, originalLine.length); }); const correctedContent = correctedLines.join('\r\n'); const blob = new Blob([correctedContent], { type: 'text/plain;charset=windows-1252' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = state.cbteFile.name.replace('.txt','_CORREGIDO.txt'); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('Archivo corregido generado exitosamente!','success'); }catch(err){ showToast(`Error al generar archivo: ${err.message}`,'error'); } }

	function exportErrorReport(){ if(!state.dataWithErrors.length){ showToast('No hay errores para exportar.', 'error'); return; } const headers = Object.keys(state.dataWithErrors[0]); const csvContent = [ headers.join(','), ...state.dataWithErrors.map(row => headers.map(h=> `"${(row[h]||'').toString().replace(/"/g,'""')}"`).join(',')) ].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reporte_errores_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

	// -----------------------------
	// Validación de archivo individual
	// -----------------------------
	function validateSingleFile(){ const singleFileInput = document.createElement('input'); singleFileInput.type='file'; singleFileInput.accept='.txt'; singleFileInput.onchange = async (e)=>{ const file = e.target.files[0]; if(!file) return; try{ const encoding = document.getElementById('encoding').value; const content = await readFileAsText(file, encoding); const lines = content.split(/\r?\n/).filter(l=> l.trim().length>0); let errors=[]; lines.forEach((line, index)=>{ const cuitMatch = line.substring(58,69); if(cuitMatch.trim().length===11 && !validateCuit(cuitMatch)) errors.push(`Línea ${index+1}: CUIT inválido: ${cuitMatch}`); const dateMatch = line.substring(0,8); if(!validateDate(dateMatch)) errors.push(`Línea ${index+1}: Fecha inválida: ${dateMatch}`); }); showValidationResults({ fileName: file.name, totalLines: lines.length, errors }); }catch(err){ showToast(`Error al validar archivo: ${err.message}`,'error'); } }; singleFileInput.click(); }

	function showValidationResults(result){ const validationHtml = `
		<div class="card bg-dark text-white p-3">
			<h5>Resultados de Validación Individual</h5>
			<p><strong>Archivo:</strong> ${result.fileName}</p>
			<div class="d-flex gap-3">
				<div class="stat"><div class="stat-number">${result.totalLines}</div><div class="stat-label">Líneas</div></div>
				<div class="stat"><div class="stat-number">${result.errors.length}</div><div class="stat-label">Errores</div></div>
			</div>
			${result.errors.length>0 ? `<div class="alert alert-danger mt-3"><h6>Primeros 20 errores:</h6><ul>${result.errors.slice(0,20).map(e=>`<li>${e}</li>`).join('')}</ul></div>` : `<div class="alert alert-success mt-3">✅ El archivo no presenta errores de formato detectables.</div>`}
		</div>`; els.resultsSection.innerHTML = validationHtml; }

	// -----------------------------
	// Editor de Layouts
	// -----------------------------
	function openLayoutEditor(){ const tipoOp = document.getElementById('tipoOperacion').value; const layoutKey = tipoOp === 'ventas' ? 'CBTE_VENTAS' : 'CBTE_COMPRAS'; const layout = FILE_LAYOUTS[layoutKey]; let html = `<p>Edita las posiciones de inicio y fin para: <strong>${tipoOp.toUpperCase()}</strong></p><div class="row">`; layout.forEach((field, index)=>{ html += `<div class="col-md-6 mb-2"><div class="p-2 bg-secondary rounded"><h6>${field.name}</h6><label class="form-label">Inicio <input class="form-control form-control-sm" type="number" id="start_${index}" value="${field.start}" min="0"></label><label class="form-label">Fin <input class="form-control form-control-sm" type="number" id="end_${index}" value="${field.end}" min="1"></label><div>Longitud: <span id="len_${index}">${field.len}</span></div></div></div>`; }); html += `</div>`; els.layoutEditorContent.innerHTML = html; const modal = new bootstrap.Modal(els.layoutEditorModal); modal.show(); layout.forEach((_, index)=>{ ['start','end'].forEach(type=>{ document.getElementById(`${type}_${index}`).addEventListener('input', ()=>{ const start = parseInt(document.getElementById(`start_${index}`).value) || 0; const end = parseInt(document.getElementById(`end_${index}`).value) || 0; document.getElementById(`len_${index}`).textContent = Math.max(0, end - start); }); }); }); }

	function saveCustomLayout(){ const tipoOp = document.getElementById('tipoOperacion').value; const layoutKey = tipoOp === 'ventas' ? 'CBTE_VENTAS' : 'CBTE_COMPRAS'; const newLayout = FILE_LAYOUTS[layoutKey].map((field, index)=>{ const start = parseInt(document.getElementById(`start_${index}`).value) || 0; const end = parseInt(document.getElementById(`end_${index}`).value) || 0; return { ...field, start, end, len: end - start }; }); state.customLayouts[layoutKey] = newLayout; FILE_LAYOUTS[layoutKey] = newLayout; localStorage.setItem('customLayouts', JSON.stringify(state.customLayouts)); bootstrap.Modal.getInstance(els.layoutEditorModal).hide(); showToast('Diseño personalizado guardado.', 'success'); }

	function resetLayoutToDefault(){ const tipoOp = document.getElementById('tipoOperacion').value; const layoutKey = tipoOp === 'ventas' ? 'CBTE_VENTAS' : 'CBTE_COMPRAS'; delete state.customLayouts[layoutKey]; FILE_LAYOUTS[layoutKey] = DEFAULT_LAYOUTS[layoutKey]; localStorage.setItem('customLayouts', JSON.stringify(state.customLayouts)); bootstrap.Modal.getInstance(els.layoutEditorModal).hide(); showToast('Diseño restaurado a predeterminado.', 'success'); }

	// -----------------------------
	// Shortcuts y bindings
	// -----------------------------
	function setupKeyboardShortcuts(){ window.addEventListener('keydown', (e)=>{ if(e.ctrlKey && e.key === 'Enter'){ e.preventDefault(); analyzeFiles(); } if((e.ctrlKey||e.metaKey) && e.key.toLowerCase() === 't'){ e.preventDefault(); els.themeSelect.value = els.themeSelect.value === 'light' ? 'dark' : 'light'; applyTheme(); } }); }

	// -----------------------------
	// Inicialización
	// -----------------------------
	function init(){ bindDragAndDrop(); if(els.compareBtn) els.compareBtn.addEventListener('click', analyzeFiles); if(els.clearBtn) els.clearBtn.addEventListener('click', clearAllUI); if(els.downloadSampleBtn) els.downloadSampleBtn.addEventListener('click', downloadSamples); if(els.previewBtn) els.previewBtn.addEventListener('click', previewFirstLines); if(els.themeSelect) els.themeSelect.addEventListener('change', applyTheme); if(els.compactToggle) els.compactToggle.addEventListener('change', applyCompactMode); if(els.saveLayoutBtn) els.saveLayoutBtn.addEventListener('click', saveCustomLayout); if(els.resetLayoutBtn) els.resetLayoutBtn.addEventListener('click', resetLayoutToDefault); document.getElementById('layoutEditorBtn')?.addEventListener('click', openLayoutEditor); document.getElementById('validateSingleBtn')?.addEventListener('click', validateSingleFile); renderRecent(); applyTheme(); applyCompactMode(); setupKeyboardShortcuts(); }

	function clearAllUI(){ state.cbteFile=null; state.alicuotasFile=null; state.dataWithErrors=[]; state.cbteRawData=[]; state.filteredData=[]; state.selectedRows.clear(); els.cbteStatus.textContent='Comprobantes: No cargado'; els.cbteStatus.classList.remove('text-success'); els.cbteStatus.classList.add('text-danger'); els.alicuotasStatus.textContent='Alícuotas: No cargado'; els.alicuotasStatus.classList.remove('text-success'); els.alicuotasStatus.classList.add('text-danger'); els.resultsSection.innerHTML=''; els.fileInput.value=''; showToast('Estado limpio', 'success'); }

	// arranque
	init();

	// export para debug
	window.__visorState = state;

})();
