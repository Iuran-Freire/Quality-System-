// src/utils/pdf-style.js
export const pdfCss = `
  :root{
    --brand:#f6a31a;
    --text:#1d2230;
    --muted:#6d7485;
    --line:#e8eaf2;
    --ok:#27ae60;
    --bad:#eb5757;
    --shadow-min:0 4px 12px rgba(25,35,60,.06);
  }

  *{ box-sizing:border-box; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; }

  .pdf{
    color:var(--text);
    padding:18px;
  }

  .pdf-header{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:12px;
  }

  .pdf-title{ font-size:18px; font-weight:800; }
  .pdf-sub{ font-size:12px; color:var(--muted); margin-top:2px; }

  .pdf-tags{ display:flex; gap:8px; align-items:center; }

  .pill{
    display:inline-flex;
    align-items:center;
    padding:4px 10px;
    border-radius:999px;
    border:1px solid var(--line);
    font-size:12px;
    font-weight:600;
    background:#fff;
    white-space:nowrap;
  }
  .pill-ok{ color:var(--ok); background:#effaf2; border-color:#d7f0df; }
  .pill-bad{ color:var(--bad); background:#ffecec; border-color:#ffd0d0; }
  .pill-muted{ color:var(--muted); background:#f7f8ff; }

  .hr{ height:1px; background:var(--line); margin:14px 0; }

  .section-title{
    font-size:13px;
    font-weight:800;
    margin:0 0 10px;
  }

  .grid{
    display:grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap:10px 14px;
  }
  .item{ min-width:0; }
  .span-2{ grid-column: span 2; }

  .label{
    font-size:11px;
    color:var(--muted);
    text-transform:uppercase;
    letter-spacing:.03em;
    margin-bottom:3px;
  }
  .value{ font-size:13px; font-weight:600; }

  .obs{
    margin-top:12px;
    padding:10px 12px;
    border:1px solid var(--line);
    border-radius:12px;
    background:#fff;
  }

  .chars{ display:flex; flex-direction:column; gap:10px; }

  .char-card{
    border:1px solid var(--line);
    border-radius:16px;
    box-shadow: var(--shadow-min);
    overflow:hidden;
    background:#fff;
  }

  .char-head{
    padding:12px 14px;
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
    background:#fff;
  }

  .char-name{ font-weight:800; font-size:13px; }
  .char-limits{ color:var(--muted); font-size:11px; margin-top:2px; }

  .char-body{
    border-top:1px solid var(--line);
    padding:12px 14px 14px;
  }

  .samples-grid{
    display:grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap:8px;
  }

  .sample{
    border:1px solid var(--line);
    border-radius:12px;
    padding:8px 10px;
    text-align:center;
  }
  .sample-label{ font-size:10px; color:var(--muted); margin-bottom:4px; }
  .sample-value{ font-size:13px; font-weight:800; }

  .muted{ color:var(--muted); font-size:12px; }

  .footer{
    margin-top:14px;
    font-size:11px;
    color:var(--muted);
    text-align:right;
  }
`;
