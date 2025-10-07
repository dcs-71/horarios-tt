import React, { useEffect, useMemo, useState } from "react";

// ===================== Config =====================
const SHEET_ID = "1CiNA9jhtKN_JgO1JWXjWQqJ_72JMIjeh-IBvH8_PBSU"; // cambia si fuera otro
const SHEET_HORARIO = "DB (Horario)"; // columnas: Día, Turno, Nombre, Hora inicio, Hora fin, Tipo
const SHEET_FUNCIONES = "DB (Funciones)";
const SHEET_PERMISOS = "DB (Permisos)";

const PERSON_COLORS = {
  Anderson: "#ff9800", // Naranja
  Diego: "#ef4444", // Rojo
  Lucero: "#8b5cf6", // Violeta
  Noelia: "#10b981", // Verde
};

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TURNOS = ["Abre local", "Mañana", "Tarde", "Cierra local"]; // "Cierra local" al final

// ===================== Utilidades =====================
const csvToRows = (text) => {
  // separa líneas y respeta campos con comillas
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === "," && !inQuotes) { pushField(); }
    else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (field !== "" || row.length) pushField();
      if (row.length) { rows.push(row); row = []; }
    } else { field += c; }
  }
  if (field !== "" || row.length) { pushField(); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ""));
};

const parseTimeToMin = (s) => {
  if (!s) return null;
  const str = String(s).trim().toLowerCase();
  const m = str.match(/(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3];
  if (ap) {
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  }
  return h * 60 + min; // minutos desde 00:00
};

// ✅ FIX: función usada por el procesado de permisos
const minToTimeStr = (m) => {
  if (m == null || Number.isNaN(m)) return "";
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ap = h24 >= 12 ? "pm" : "am";
  let h = h24 % 12; if (h === 0) h = 12;
  return `${h}:${mm}${ap}`;
};

const fmtRange = (ini, fin) => `${ini} – ${fin}`;

const fetchCSV = async (sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo descargar CSV");
  return await res.text();
};

// ===================== Fallback local =====================
const FALLBACK_HORARIO = [
  ["Lunes","Abre local","Lucero","8:00am","12:00pm","Presencial"],
  ["Lunes","Mañana","Lucero","8:00am","12:00pm","Presencial"],
  ["Lunes","Mañana","Anderson","8:00am","1:00pm","Presencial"],
  ["Lunes","Mañana","Noelia","8:00am","1:00pm","Presencial"],
  ["Lunes","Mañana","Diego","12:30pm","2:00pm","Presencial"],
  ["Lunes","Tarde","Noelia","1:45pm","3:00pm","Presencial"],
  ["Lunes","Tarde","Anderson","5:00pm","8:00pm","Presencial"],
  ["Lunes","Tarde","Diego","2:00pm","8:00pm","Presencial"],
  ["Lunes","Cierra local","Diego","8:00pm","8:00pm","Presencial"],

  ["Martes","Abre local","Noelia","8:00am","8:05am","Presencial"],
  ["Martes","Mañana","Diego","8:00am","2:00pm","Presencial"],
  ["Martes","Mañana","Anderson","8:00am","2:00pm","Remoto"],
  ["Martes","Mañana","Noelia","8:00am","1:00pm","Presencial"],
  ["Martes","Tarde","Noelia","1:45pm","3:00pm","Presencial"],
  ["Martes","Tarde","Lucero","2:30pm","8:00pm","Presencial"],
  ["Martes","Tarde","Anderson","5:00pm","8:00pm","Remoto"],
  ["Martes","Tarde","Diego","5:00pm","8:00pm","Presencial"],
  ["Martes","Cierra local","Lucero","8:00pm","8:00pm","Presencial"],

  ["Miércoles","Abre local","Noelia","8:00am","8:05am","Presencial"],
  ["Miércoles","Mañana","Anderson","8:00am","12:00pm","Presencial"],
  ["Miércoles","Mañana","Noelia","7:30am","1:00pm","Presencial"],
  ["Miércoles","Mañana","Diego","12:00pm","2:00pm","Remoto"],
  ["Miércoles","Tarde","Noelia","1:45pm","5:00pm","Presencial"],
  ["Miércoles","Tarde","Anderson","4:00pm","5:00pm","Presencial"],
  ["Miércoles","Tarde","Lucero","5:00pm","8:00pm","Presencial"],
  ["Miércoles","Tarde","Diego","6:00pm","7:00pm","Remoto"],
  ["Miércoles","Cierra local","Lucero","8:00pm","8:00pm","Presencial"],

  ["Jueves","Abre local","Noelia","8:00am","8:05am","Presencial"],
  ["Jueves","Mañana","Lucero","8:00am","12:00pm","Presencial"],
  ["Jueves","Mañana","Anderson","8:00am","1:00pm","Presencial"],
  ["Jueves","Mañana","Noelia","8:00am","1:00pm","Presencial"],
  ["Jueves","Mañana","Diego","12:30pm","2:00pm","Presencial"],
  ["Jueves","Tarde","Noelia","1:45pm","8:00pm","Presencial"],
  ["Jueves","Tarde","Anderson","5:00pm","6:00pm","Presencial"],
  ["Jueves","Tarde","Diego","8:00pm","8:00pm","Presencial"],
  ["Jueves","Cierra local","Noelia","8:00pm","8:00pm","Presencial"],

  ["Viernes","Abre local","Noelia","8:00am","8:05am","Presencial"],
  ["Viernes","Mañana","Diego","8:00am","12:00pm","Presencial"],
  ["Viernes","Mañana","Anderson","12:00pm","1:00pm","Presencial"],
  ["Viernes","Mañana","Noelia","8:00am","1:00pm","Presencial"],
  ["Viernes","Tarde","Noelia","1:45pm","3:00pm","Presencial"],
  ["Viernes","Tarde","Diego","4:00pm","5:00pm","Presencial"],
  ["Viernes","Tarde","Lucero","5:00pm","8:00pm","Presencial"],
  ["Viernes","Tarde","Anderson","6:00pm","7:00pm","Presencial"],
  ["Viernes","Cierra local","Lucero","8:00pm","8:00pm","Presencial"],

  ["Sábado","Abre local","Lucero","8:00am","8:05am","Presencial"],
  ["Sábado","Mañana","Lucero","8:00am","2:00pm","Presencial"],
  ["Sábado","Mañana","Anderson","8:00am","12:00pm","Presencial"],
  ["Sábado","Mañana","Noelia","7:30am","12:00pm","Presencial"],
  ["Sábado","Mañana","Diego","8:45am","2:15pm","Presencial"],
  ["Sábado","Cierra local","Diego","2:15pm","2:15pm","Presencial"],
];

const FALLBACK_FUNCIONES = [
  ["Finanzas","Anderson"],
  ["Recursos Humanos","Anderson"],
  ["Marketing","Diego"],
  ["T.I.","Diego"],
  ["Recepción PL","Noelia"],
  ["Diseño Audiovisual","Lucero"],
  ["Técnica","Lucero"],
];

const FALLBACK_PERMISOS = [
  ["Martes","Anderson","9:00am","11:00am","Virtual"],
  ["Miércoles","Diego","6:00pm","7:00pm","No asiste"],
  ["Viernes","Lucero","6:00pm","7:30pm","No asiste"],
];

// ===================== Data hook =====================
function useSheetsData() {
  const [data, setData] = useState({ horarios: [], funciones: [], permisos: [], status: "loading", error: null });

  useEffect(() => {
    (async () => {
      try {
        const [csvH, csvF, csvP] = await Promise.all([
          fetchCSV(SHEET_HORARIO),
          fetchCSV(SHEET_FUNCIONES),
          fetchCSV(SHEET_PERMISOS),
        ]);

        // ---- Horario
        const rowsH = csvToRows(csvH);
        const headH = rowsH[0];
        const col = (name) => headH.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
        const idxDia = col("Día");
        const idxTurno = col("Turno");
        const idxNombre = col("Nombre");
        const idxIni = col("Hora inicio");
        const idxFin = col("Hora fin");
        const idxTipo = col("Tipo");
        const horarios = rowsH.slice(1).filter(r=>r.length).map((r) => ({
          dia: r[idxDia]?.trim(),
          turno: r[idxTurno]?.trim(),
          nombre: r[idxNombre]?.trim(),
          ini: r[idxIni]?.trim(),
          fin: r[idxFin]?.trim(),
          tipo: r[idxTipo]?.trim(),
          iniMin: parseTimeToMin(r[idxIni]),
          finMin: parseTimeToMin(r[idxFin]),
        })).filter(x=>DIAS.includes(x.dia) && TURNOS.includes(x.turno));

        // ---- Funciones
        const rowsF = csvToRows(csvF);
        const headF = rowsF[0];
        const idxFun = headF.findIndex((h) => h.trim().toLowerCase().startsWith("función"));
        const idxPer = headF.findIndex((h) => h.trim().toLowerCase().startsWith("personal"));
        const funciones = rowsF.slice(1).filter(r=>r.length).map((r) => ({
          funcion: r[idxFun]?.trim(),
          personal: r[idxPer]?.trim(),
        })).filter(x=>x.funcion && x.personal);

        // ---- Permisos
        const rowsP = csvToRows(csvP);
        const headP = rowsP[0];
        const pDia = headP.findIndex(h=>h.toLowerCase().startsWith("día"));
        const pNom = headP.findIndex(h=>h.toLowerCase().startsWith("nombre"));
        const pIni = headP.findIndex(h=>h.toLowerCase().includes("inicio"));
        const pFin = headP.findIndex(h=>h.toLowerCase().includes("fin"));
        const pTipo = headP.findIndex(h=>h.toLowerCase().startsWith("tipo"));
        const permisos = rowsP.slice(1).filter(r=>r.length).map(r=>({
          dia: r[pDia]?.trim(),
          nombre: r[pNom]?.trim(),
          ini: r[pIni]?.trim(),
          fin: r[pFin]?.trim(),
          tipo: (r[pTipo]?.trim()||"").toLowerCase(), // 'no asiste' | 'virtual'
          iniMin: parseTimeToMin(r[pIni]),
          finMin: parseTimeToMin(r[pFin]),
        })).filter(x=>DIAS.includes(x.dia) && x.nombre);

        setData({ horarios, funciones, permisos, status: "ready", error: null });
      } catch (e) {
        // Fallback local
        const horarios = FALLBACK_HORARIO.map((r) => ({
          dia: r[0], turno: r[1], nombre: r[2], ini: r[3], fin: r[4], tipo: r[5],
          iniMin: parseTimeToMin(r[3]), finMin: parseTimeToMin(r[4])
        }));
        const funciones = FALLBACK_FUNCIONES.map((r) => ({ funcion: r[0], personal: r[1] }));
        const permisos = FALLBACK_PERMISOS.map((r)=> ({
          dia: r[0], nombre: r[1], ini: r[2], fin: r[3], tipo: r[4].toLowerCase(),
          iniMin: parseTimeToMin(r[2]), finMin: parseTimeToMin(r[3])
        }));
        setData({ horarios, funciones, permisos, status: "fallback", error: e.message });
      }
    })();
  }, []);

  return data;
}

// ===================== Filtros =====================
function Filters({ people, funciones, value, onChange }) {
  const [personas, setPersonas] = useState(new Set(value.personas || people));
  const [dia, setDia] = useState(value.dia || "Todos");
  const [turno, setTurno] = useState(value.turno || "Todos");
  const [modalidad, setModalidad] = useState(value.modalidad || { Presencial: true, Remoto: true });
  const [funcion, setFuncion] = useState(value.funcion || "Todas");

  useEffect(() => { onChange({ personas: Array.from(personas), dia, turno, modalidad, funcion }); }, [personas, dia, turno, modalidad, funcion]);
  useEffect(() => { if (value.personas === undefined || value.personas.length===0) setPersonas(new Set(people)); }, [people]);

  const togglePersona = (p) => setPersonas(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });

  return (
    <div className="bg-white/60 backdrop-blur border border-neutral-200 rounded-2xl p-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Personas */}
        <div className="flex flex-col gap-2 lg:col-span-2 xl:col-span-1">
          <label className="text-xs font-medium text-neutral-600">Personas</label>
          <div className="flex items-center gap-2 mb-1 text-xs flex-wrap">
            <button type="button" onClick={()=> setPersonas(new Set(people))} className="px-2 py-1 border rounded-full bg-white hover:bg-neutral-50">Seleccionar todo</button>
            <button type="button" onClick={()=> setPersonas(new Set())} className="px-2 py-1 border rounded-full bg-white hover:bg-neutral-50">Limpiar</button>
            <span className="text-neutral-500">{personas.size} seleccionad{personas.size===1? 'a':'os'}</span>
          </div>
          <div className="flex flex-col gap-2">
            {people.map(p => (
              <label key={p} className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white cursor-pointer hover:bg-neutral-50" style={{borderColor: PERSON_COLORS[p]}}>
                <input type="checkbox" checked={personas.has(p)} onChange={()=>togglePersona(p)} className="cursor-pointer" />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: PERSON_COLORS[p]}} />
                <span className="text-sm font-medium" style={{color: PERSON_COLORS[p]}}>{p}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Día y Turno */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-600">Día</label>
            <select value={dia} onChange={(e)=>setDia(e.target.value)} className="w-full border rounded-xl p-2 bg-white">
              <option>Todos</option>
              {DIAS.map(d=> <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-600">Turno</label>
            <select value={turno} onChange={(e)=>setTurno(e.target.value)} className="w-full border rounded-xl p-2 bg-white">
              <option>Todos</option>
              {TURNOS.map(t=> <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Modalidad */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-neutral-600">Modalidad</label>
          <div className="flex flex-col gap-3 bg-white border rounded-xl p-3">
            {["Presencial","Remoto"].map(m => (
              <label key={m} className="text-sm flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={modalidad[m]} onChange={(e)=>setModalidad(v=>({...v,[m]:e.target.checked}))} className="cursor-pointer" />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Función */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-neutral-600">Función</label>
          <select value={funcion} onChange={(e)=>setFuncion(e.target.value)} className="w-full border rounded-xl p-2 bg-white">
            <option>Todas</option>
            {Array.from(new Set(funciones.map(f=>f.funcion))).map(fn => (
              <option key={fn}>{fn}</option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-500">Filtra por personas asociadas a esta función.</p>
        </div>
      </div>
    </div>
  );
}

// Aplica filtros a la colección de horarios
const applyFilters = (rows, filters, funciones) => {
  const { personas, dia, turno, modalidad, funcion } = filters;
  let namesAllowed = null;
  if (funcion && funcion !== "Todas") {
    namesAllowed = new Set(funciones.filter(f=>f.funcion===funcion).map(f=>f.personal));
  }
  const personasSet = personas && personas.length ? new Set(personas) : null;

  return rows.filter(r => {
    if (personasSet && !personasSet.has(r.nombre)) return false;
    if (dia !== "Todos" && r.dia !== dia) return false;
    if (turno !== "Todos" && r.turno !== turno) return false;
    if (!modalidad[r.tipo]) return false;
    if (namesAllowed && !namesAllowed.has(r.nombre)) return false;
    return true;
  });
};

// Segmentar eventos por permisos (por persona/día y por tramos)
const applyPermisos = (rows, permisos) => {
  if (!permisos?.length) return rows;
  const map = new Map();
  for (const p of permisos) {
    const key = `${p.dia}||${p.nombre}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  for (const arr of map.values()) arr.sort((a,b)=> a.iniMin - b.iniMin);

  const out = [];
  for (const ev of rows) {
    const key = `${ev.dia}||${ev.nombre}`;
    const list = (map.get(key) || []).filter(p => !(p.finMin <= ev.iniMin || p.iniMin >= ev.finMin));
    if (list.length === 0) { out.push(ev); continue; }

    let cur = ev.iniMin;
    for (const p of list) {
      const s = Math.max(ev.iniMin, p.iniMin);
      const e = Math.min(ev.finMin, p.finMin);
      if (cur < s) {
        out.push({ ...ev, iniMin: cur, finMin: s, ini: minToTimeStr(cur), fin: minToTimeStr(s) });
      }
      out.push({ ...ev, iniMin: s, finMin: e, ini: minToTimeStr(s), fin: minToTimeStr(e), permiso: p.tipo });
      cur = e;
    }
    if (cur < ev.finMin) {
      out.push({ ...ev, iniMin: cur, finMin: ev.finMin, ini: minToTimeStr(cur), fin: minToTimeStr(ev.finMin) });
    }
  }
  return out;
};

// ===================== Vistas =====================
function GridView({ items }) {
  // Agrupar por (turno, dia)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = `${it.turno}||${it.dia}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const arr of map.values()) arr.sort((a,b)=> a.iniMin - b.iniMin);
    return map;
  }, [items]);

  return (
    <div className="w-full overflow-x-auto -mx-4 px-4">
      <div className="min-w-[900px] grid" style={{gridTemplateColumns: `160px repeat(${DIAS.length}, minmax(0,1fr))`, gap: 8}}>
        <div className="h-10" />
        {DIAS.map(d => <div key={d} className="h-10 text-center font-semibold bg-white border rounded-xl flex items-center justify-center">{d}</div>)}
        {TURNOS.map(turno => (
          <React.Fragment key={turno}>
            <div className="py-3 px-2 bg-neutral-50/80 border rounded-xl font-semibold flex items-center">{turno}{turno==="Mañana" && <span className="text-xs font-normal text-neutral-500 ml-1"> (8–2PM)</span>}{turno==="Tarde" && <span className="text-xs font-normal text-neutral-500 ml-1"> (2–8PM)</span>}</div>
            {DIAS.map(dia => {
              const k = `${turno}||${dia}`;
              const arr = grouped.get(k) || [];
              return (
                <div key={dia+turno} className="min-h-[110px] bg-white border rounded-xl p-2 flex flex-col gap-2">
                  {arr.length===0 && <div className="text-xs text-neutral-400">—</div>}
                  {arr.map((r,idx)=> <PersonBadge key={idx} r={r} />)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function DayView({ items }) {
  const byDay = useMemo(() => {
    const map = new Map();
    for (const d of DIAS) map.set(d, []);
    for (const it of items) {
      const arr = map.get(it.dia);
      if (arr) arr.push(it);
    }
    for (const arr of map.values()) arr.sort((a,b)=> a.iniMin - b.iniMin);
    return map;
  }, [items]);

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {DIAS.map(dia => {
        const diaItems = byDay.get(dia) || [];
        return (
          <div key={dia} className="bg-white border rounded-2xl p-3">
            <div className="font-semibold mb-2">{dia}</div>
            {TURNOS.map(t => {
              const turnoItems = diaItems.filter(x=>x.turno===t);
              return (
                <div key={t} className="mb-3">
                  <div className="text-xs text-neutral-500 mb-1">{t}</div>
                  <div className="flex flex-col gap-2">
                    {turnoItems.map((r,i)=> <PersonBadge key={i} r={r} />)}
                    {turnoItems.length===0 && <div className="text-xs text-neutral-400">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ items }) {
  const byDay = useMemo(() => {
    const map = new Map();
    for (const d of DIAS) map.set(d, []);
    for (const it of items) map.get(it.dia)?.push(it);
    for (const arr of map.values()) arr.sort((a,b)=> a.iniMin - b.iniMin);
    return map;
  }, [items]);

  const [minM, maxM] = useMemo(() => {
    const mins = items.flatMap((r)=>[r.iniMin, r.finMin]).filter(Boolean);
    let min = Math.min(7*60, ...mins), max = Math.max(20*60, ...mins);
    min = Math.floor(min/60)*60; max = Math.ceil(max/60)*60;
    return [min, max];
  }, [items]);

  const pxPerMin = 0.9; // altura vertical
  const hours = []; for (let m=minM; m<=maxM; m+=60) hours.push(m);

  return (
    <div className="w-full overflow-x-auto -mx-4 px-4">
      <div className="min-w-[900px] grid" style={{gridTemplateColumns: `100px repeat(${DIAS.length}, minmax(0,1fr))`, gap: 8}}>
        <div />
        {DIAS.map(d => <div key={d} className="text-center font-semibold bg-white border rounded-xl h-10 flex items-center justify-center">{d}</div>)}
        {/* timeline */}
        <div className="relative" style={{gridRow: `span 1 / span 1`}}>
          <div className="relative bg-white border rounded-xl" style={{height: (maxM-minM)*pxPerMin}}>
            {hours.map((h,i)=> (
              <div key={i} className="absolute left-0 right-0 border-t text-[10px] text-neutral-500" style={{top:(h-minM)*pxPerMin}}>
                <div className="-mt-2 ml-1">{String(Math.floor(h/60)).padStart(2,'0')}:00</div>
              </div>
            ))}
          </div>
        </div>
        {DIAS.map(dia => {
          const list = byDay.get(dia) || [];
          // asignación de columnas por superposición
          const columns = [];
          list.forEach(ev => {
            let placed = false;
            for (const col of columns) {
              if (!col.some(e => !(ev.finMin <= e.iniMin || ev.iniMin >= e.finMin))) { col.push(ev); placed = true; break; }
            }
            if (!placed) columns.push([ev]);
          });
          const colCount = Math.max(1, columns.length);

          return (
            <div key={dia} className="relative bg-white border rounded-xl" style={{height: (maxM-minM)*pxPerMin}}>
              {hours.map((h,i)=> (
                <div key={i} className="absolute left-0 right-0 border-t" style={{top:(h-minM)*pxPerMin}} />
              ))}
              {columns.flatMap((col,ci) => col.map((ev,idx)=> {
                const top = (ev.iniMin - minM) * pxPerMin;
                const height = Math.max(18, (ev.finMin-ev.iniMin) * pxPerMin);
                const left = (ci / colCount) * 100; const width = (100/colCount);

                let color = PERSON_COLORS[ev.nombre] || "#e5e7eb";
                let dashed = ev.tipo === 'Remoto';
                let permLabel = null;
                if (ev.permiso === 'no asiste') { color = '#9ca3af'; dashed = true; permLabel = 'PERMISO: No asiste'; }
                else if (ev.permiso === 'virtual') { dashed = true; permLabel = 'PERMISO: Virtual'; }

                return (
                  <div key={ci+"-"+idx}
                    className={`absolute rounded-lg shadow-sm border text-xs p-2 overflow-hidden ${dashed? 'border-dashed':''}`}
                    style={{ top, height, left: `${left}%`, width: `${width}%`,
                             background: `${color}1A`, borderColor: color }}>
                    <div className="font-semibold" style={{color}}>{ev.nombre}</div>
                    <div className="opacity-70">{fmtRange(ev.ini, ev.fin)} {ev.tipo === 'Remoto' && ev.permiso !== 'no asiste' ? '· Remoto' : ''}</div>
                    {permLabel && <div className="text-[11px] mt-1">{permLabel}</div>}
                  </div>
                );
              }))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PersonBadge({ r }) {
  let color = PERSON_COLORS[r.nombre] || "#374151";
  let dashed = r.tipo === "Remoto";
  let permText = null;
  if (r.permiso === 'no asiste') { color = '#6b7280'; dashed = true; permText = 'PERMISO: No asiste'; }
  else if (r.permiso === 'virtual') { dashed = true; permText = 'PERMISO: Virtual'; }

  return (
    <div className={`border rounded-xl px-3 py-2 text-sm bg-white ${dashed? 'border-dashed':''}`} style={{borderColor: color}}>
      <div className="font-semibold flex items-center gap-2" style={{color}}>
        <span className="w-2 h-2 rounded-full" style={{backgroundColor: color}} /> {r.nombre}
      </div>
      <div className="text-neutral-600 text-xs">{fmtRange(r.ini, r.fin)} {r.tipo === 'Remoto' && r.permiso !== 'no asiste' ? '· Remoto' : ''}</div>
      {permText && <div className="text-[11px] text-neutral-600 mt-1">{permText}</div>}
    </div>
  );
}

// ===================== Componente principal =====================
export default function App() {
  const { horarios, funciones, permisos, status, error } = useSheetsData();
  const people = useMemo(() => Array.from(new Set(horarios.map(h=>h.nombre))), [horarios]);
  const [filters, setFilters] = useState({ personas: [], dia: "Todos", turno: "Todos", modalidad: {Presencial:true, Remoto:true}, funcion: "Todas" });
  const [tab, setTab] = useState("grid");

  const filtered = useMemo(() => applyFilters(horarios, filters, funciones), [horarios, filters, funciones]);
  const withPerms = useMemo(() => applyPermisos(filtered, permisos), [filtered, permisos]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-[#eef2ff] text-neutral-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-6 w-full">
        <header className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Horario Administrativo — Pueblo Libre</h1>
            <p className="text-sm text-neutral-500">Datos: Google Sheets → {status === 'ready' ? 'En vivo' : status === 'fallback' ? 'Fallback local' : 'Cargando…'}{error && <span className="text-red-500 ml-2">({error})</span>}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Legend />
          </div>
        </header>

        <Filters people={people} funciones={funciones} value={filters} onChange={setFilters} />

        <div className="mt-4 flex items-center gap-2">
          {([
            {id:"grid", label:"Cuadrícula"},
            {id:"day", label:"Por día"},
            {id:"cal", label:"Calendario"},
          ]).map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} className={`px-3 py-2 rounded-full border text-sm ${tab===t.id? 'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-neutral-50'}`}>{t.label}</button>
          ))}
        </div>

        <main className="mt-4">
          {tab === 'grid' && <GridView items={withPerms} />}
          {tab === 'day' && <DayView items={withPerms} />}
          {tab === 'cal' && <CalendarView items={withPerms} />}
        </main>

        <footer className="text-xs text-neutral-500 mt-8">
          <p>Verificar el acceso público del Spradsheet y los nombres exactos de hojas: "DB (Horario)", "DB (Funciones)" y "DB (Permisos)". La app usa GViz CSV.</p>
        </footer>
      </div>
    </div>
  );
}

function Legend(){
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {Object.entries(PERSON_COLORS).map(([name,color])=> (
        <span key={name} className="inline-flex items-center gap-1 border rounded-full px-2 py-1 bg-white" style={{borderColor: color}}>
          <span className="w-2 h-2 rounded-full" style={{backgroundColor: color}} />
          <span className="font-medium text-xs" style={{color}}>{name}</span>
        </span>
      ))}
      <span className="text-neutral-500">Remoto / Virtual / No asiste → borde punteado</span>
    </div>
  );
}

// ===================== Self-tests (dev) =====================
// Pequeñas pruebas para evitar regresiones en manejo de horas.
(function runSelfTests(){
  try {
    const pairs = [
      ["8:00am", 480],
      ["12:00pm", 720],
      ["12:00am", 0],
      ["2:15pm", 14*60+15],
    ];
    pairs.forEach(([txt, mins]) => {
      console.assert(parseTimeToMin(txt) === mins, `parseTimeToMin(${txt}) esperado ${mins}`);
      console.assert(minToTimeStr(mins).toLowerCase() === txt, `minToTimeStr(${mins}) esperado ${txt}`);
    });
  } catch (e) {
    console.warn("Self-tests fallidos:", e);
  }
})();
