// visor-iva.js - Lógica mejorada para UI
(function(){
	// Estado básico
	const state = {
		cbteFile: null,
		alicuotasFile: null,
		recent: JSON.parse(localStorage.getItem('recentFiles') || '[]'),
	};

	// Elementos
	const dropArea = document.getElementById('dropArea');
	const fileInput = document.getElementById('fileInput');
	const cbteStatus = document.getElementById('cbteStatus');
	const alicuotasStatus = document.getElementById('alicuotasStatus');
	const compareBtn = document.getElementById('compareBtn');
	const clearBtn = document.getElementById('clearBtn');
	const downloadSampleBtn = document.getElementById('downloadSampleBtn');
	const recentList = document.getElementById('recentList');
	const progressBar = document.getElementById('progressBar');
	const themeSelect = document.getElementById('themeSelect');
	const compactToggle = document.getElementById('compactToggle');
	const previewBtn = document.getElementById('previewBtn');

	// Inicialización
	function init(){
		bindDragAndDrop();
		fileInput.addEventListener('change', onFilesSelected);
		compareBtn.addEventListener('click', triggerAnalyze);
		clearBtn.addEventListener('click', clearAll);
		downloadSampleBtn.addEventListener('click', downloadSamples);
		previewBtn.addEventListener('click', previewFirstLines);
		themeSelect.addEventListener('change', applyTheme);
		compactToggle.addEventListener('change', applyCompactMode);
		document.getElementById('fabAnalyze').addEventListener('click', triggerAnalyze);
		document.getElementById('fabTheme').addEventListener('click', toggleThemeQuick);
		setupKeyboardShortcuts();
		renderRecent();
		applyTheme();
	}

	// Drag & drop
	function bindDragAndDrop(){
		['dragenter','dragover','dragleave','drop'].forEach(ev => dropArea.addEventListener(ev, preventDefault));
		dropArea.addEventListener('click', ()=> fileInput.click());
		dropArea.addEventListener('drop', (e)=> onDrop(e));
		dropArea.addEventListener('keydown', (e)=> { if(e.key === 'Enter') fileInput.click(); });
	}
	function preventDefault(e){ e.preventDefault(); e.stopPropagation(); }

	function onFilesSelected(e){ onFileList(e.target.files); }
	function onDrop(e){ onFileList(e.dataTransfer.files); }

	function onFileList(files){
		for(const f of files){
			const name = f.name.toUpperCase();
			if(name.includes('CBTE')){
				state.cbteFile = f; cbteStatus.textContent = `Comprobantes: ${f.name}`; cbteStatus.classList.remove('text-danger'); cbteStatus.classList.add('text-success');
			} else if(name.includes('ALICUOTAS')){
				state.alicuotasFile = f; alicuotasStatus.textContent = `Alícuotas: ${f.name}`; alicuotasStatus.classList.remove('text-danger'); alicuotasStatus.classList.add('text-success');
			}
		}
		saveRecent();
	}

	// Guardar historial simple
	function saveRecent(){
		const entry = { time: Date.now(), cbte: state.cbteFile?.name || null, alicuotas: state.alicuotasFile?.name || null };
		state.recent.unshift(entry);
		state.recent = state.recent.slice(0,10);
		localStorage.setItem('recentFiles', JSON.stringify(state.recent));
		renderRecent();
	}

	function renderRecent(){
		recentList.innerHTML = '';
		if(!state.recent.length){
			recentList.innerHTML = '<li><span class="dropdown-item-text">Sin historial</span></li>';
			return;
		}
		for(const r of state.recent){
			const li = document.createElement('li');
			const time = new Date(r.time).toLocaleString();
			li.innerHTML = `<button class="dropdown-item">${time} — ${r.cbte||'-'} / ${r.alicuotas||'-'}</button>`;
			recentList.appendChild(li);
		}
	}

	// Descarga de archivos de muestra (genera texto simple)
	function downloadSamples(){
		const cbteSample = '202501010010000000000000000000000000000000000000000000000000000000000';
		const alicuotasSample = '0010000000000000000000000000000000000000000000000000000000000000000';
		createAndDownload(cbteSample, 'muestra_CBTE.txt');
		createAndDownload(alicuotasSample, 'muestra_ALICUOTAS.txt');
		showToast('Archivos de muestra descargados', 'success');
	}
	function createAndDownload(content, filename){
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
	}

	// Previsualizar primeros registros
	async function previewFirstLines(){
		if(!state.cbteFile && !state.alicuotasFile){ showToast('Carga al menos un archivo para previsualizar', 'error'); return; }
		try{
			const file = state.cbteFile || state.alicuotasFile;
			const text = await readFileAsText(file, document.getElementById('encoding').value);
			const lines = text.split(/\r?\n/).slice(0,10).map((l,i)=>`<div><strong>${i+1}.</strong> ${escapeHtml(l)}</div>`).join('');
			const container = document.getElementById('resultsSection');
			container.innerHTML = `<div class="card bg-dark text-white p-3"><h5>Previsualización (${file.name})</h5>${lines}</div>`;
		}catch(err){ showToast(err.message,'error'); }
	}

	// Tema y compacto
	function applyTheme(){
		const val = themeSelect.value || 'dark';
		document.body.classList.remove('light');
		document.documentElement.classList.remove('light');
		if(val === 'light') { document.body.classList.add('light'); document.documentElement.classList.add('light'); }
		// para system podrías detectar prefers-color-scheme; por simplicidad, dejamos "dark" por defecto
	}
	function toggleThemeQuick(){
		const current = themeSelect.value;
		themeSelect.value = current === 'light' ? 'dark' : 'light';
		applyTheme();
	}
	function applyCompactMode(){
		if(compactToggle.checked) document.body.classList.add('compact'); else document.body.classList.remove('compact');
	}

	// Shortcuts
	function setupKeyboardShortcuts(){
		window.addEventListener('keydown', (e)=>{
			if(e.ctrlKey && e.key === 'Enter') { e.preventDefault(); triggerAnalyze(); }
			if(e.key === 't' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); toggleThemeQuick(); }
		});
	}

	// Small utilities
	function showToast(message, type='success'){
		const containerId = 'toast-container';
		let container = document.getElementById(containerId);
		if(!container){ container = document.createElement('div'); container.id = containerId; container.style.position = 'fixed'; container.style.right = '20px'; container.style.bottom = '20px'; container.style.zIndex = '3000'; document.body.appendChild(container); }
		const el = document.createElement('div'); el.className = `toast ${type}`; el.style.marginTop='8px'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.background = type==='success'? '#062f2f' : '#2f0606'; el.style.color='#fff'; el.innerText = message; container.appendChild(el);
		setTimeout(()=> el.remove(), 4000);
	}

	function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

	// Progreso visual (simulado) para procesos largos
	function setProgress(p){ progressBar.style.width = Math.max(0, Math.min(100, p)) + '%'; }

	// Analizar - por ahora disparador que llama al flujo existente si está en la página antigua
	function triggerAnalyze(){
		if(typeof window.compareBtn !== 'undefined') { /* fallback */ }
		// Si la página original carga un script con compareBtn, dispararlo; si no, solo notificar
		if(document.getElementById('compareBtn')){
			// animación simulada
			setProgress(10);
			setTimeout(()=> setProgress(60), 300);
			setTimeout(()=> { setProgress(100); setTimeout(()=> setProgress(0), 300); }, 800);
		}
		showToast('Análisis iniciado', 'success');
	}

	// Leer archivo como texto
	function readFileAsText(file, encoding='windows-1252'){ return new Promise((resolve,reject)=>{ const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = e => reject(e); r.readAsText(file, encoding); }); }

	function clearAll(){ state.cbteFile=null; state.alicuotasFile=null; cbteStatus.textContent='Comprobantes: No cargado'; cbteStatus.classList.remove('text-success'); cbteStatus.classList.add('text-danger'); alicuotasStatus.textContent='Alícuotas: No cargado'; alicuotasStatus.classList.remove('text-success'); alicuotasStatus.classList.add('text-danger'); document.getElementById('resultsSection').innerHTML=''; fileInput.value=''; showToast('Estado limpio', 'success'); }

	// start
	init();

	// Exponer util para pruebas
	window.__visorState = state;

})();
