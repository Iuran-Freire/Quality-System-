// src/utils/pdf-template.js
export function buildInspectionHtml(insp) {
  const date = (insp.createdAt || "").slice(0, 10);
  const statusTxt = insp.status === "done" ? "Finalizada" : "Em edição";
  const resultTxt = insp.result || "—";

  const chars = Array.isArray(insp.chars) ? insp.chars : [];
  const samples = insp.samples || {};

  // helper
  const esc = (v) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  // render amostras como “chips” / linhas
  function renderSamplesGrid(charId) {
    const arr = Array.isArray(samples[charId]) ? samples[charId] : [];
    if (!arr.length) return `<div class="muted">Sem amostras</div>`;

    return `
      <div class="samples-grid">
        ${arr
          .map(
            (v, i) => `
          <div class="sample">
            <div class="sample-label">Amostra ${i + 1}</div>
            <div class="sample-value">${esc(v || "—")}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  return `
  <div class="pdf">
    <div class="pdf-header">
      <div>
        <div class="pdf-title">Relatório de Inspeção</div>
        <div class="pdf-sub">OQC Inspection Plan</div>
      </div>

      <div class="pdf-tags">
        <span class="pill">${esc(statusTxt)}</span>
        <span class="pill pill-${resultTxt === "PASS" ? "ok" : resultTxt === "FAIL" ? "bad" : "muted"}">
          ${esc(resultTxt)}
        </span>
      </div>
    </div>

    <div class="hr"></div>

    <div class="section">
      <div class="section-title">Dados da inspeção</div>

      <div class="grid">
        <div class="item"><div class="label">Plano</div><div class="value">${esc(insp.planName)}</div></div>
        <div class="item"><div class="label">PN</div><div class="value">${esc(insp.pn)}</div></div>
        <div class="item"><div class="label">Modelo</div><div class="value">${esc(insp.model)}</div></div>
        <div class="item"><div class="label">Cliente</div><div class="value">${esc(insp.client)}</div></div>

        <div class="item"><div class="label">Data</div><div class="value">${esc(date)}</div></div>
        <div class="item"><div class="label">Lote</div><div class="value">${esc(insp.lot)}</div></div>
        <div class="item"><div class="label">Turno</div><div class="value">${esc(insp.shift)}</div></div>
        <div class="item"><div class="label">Responsável</div><div class="value">${esc(insp.resp)}</div></div>

        <div class="item span-2"><div class="label">Fornecedor</div><div class="value">${esc(insp.supplier)}</div></div>
      </div>

      ${
        insp.obs
          ? `<div class="obs"><div class="label">Observações</div><div class="value">${esc(insp.obs)}</div></div>`
          : ""
      }
    </div>

    <div class="hr"></div>

    <div class="section">
      <div class="section-title">Características e amostras</div>

      <div class="chars">
        ${chars
          .map((c) => {
            const lsl = c.lsl ?? "-";
            const usl = c.usl ?? "-";
            return `
            <div class="char-card">
              <div class="char-head">
                <div>
                  <div class="char-name">${esc(c.name || "Característica")}</div>
                  <div class="char-limits">LSL: ${esc(lsl)} | USL: ${esc(usl)}</div>
                </div>
                <div class="char-badges">
                  <span class="pill pill-muted">${esc(c.category || "—")}</span>
                </div>
              </div>

              <div class="char-body">
                ${renderSamplesGrid(c.id)}
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>

    <div class="footer">
      Gerado em ${esc(new Date().toLocaleString())}
    </div>
  </div>
  `;
}
