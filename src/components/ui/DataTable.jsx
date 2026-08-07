export default function DataTable({ columns = [], rows = [], getRowKey, onRowClick }) {
  const normalizedRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="da-table-card da-table-card-v2">
      <div className="da-table-scroll">
        <table className="da-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {normalizedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1}>
                  <span className="da-muted">Belum ada data.</span>
                </td>
              </tr>
            ) : (
              normalizedRows.map((row, index) => {
                const key = getRowKey?.(row, index) || row.id || index;

                return (
                  <tr
                    key={key}
                    className={onRowClick ? "clickable" : ""}
                    data-clickable={onRowClick ? "true" : "false"}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} data-label={column.label}>
                        {column.render ? column.render(row, index) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="da-mobile-record-list" aria-label="Daftar data mobile">
        {normalizedRows.length === 0 ? (
          <div className="da-mobile-record-empty">Belum ada data.</div>
        ) : (
          normalizedRows.map((row, index) => {
            const key = getRowKey?.(row, index) || row.id || index;
            return (
              <div
                key={`mobile-${key}`}
                className={`da-mobile-record ${onRowClick ? "is-clickable" : ""}`}
                onClick={(event) => {
                  if (event.target.closest?.("button,a,input,select,textarea")) return;
                  onRowClick?.(row);
                }}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!onRowClick) return;
                  if (event.key === "Enter" || event.key === " ") onRowClick(row);
                }}
              >
                {columns.map((column, columnIndex) => (
                  <div key={column.key} className={`da-mobile-record-field ${columnIndex === 0 ? "is-primary" : ""}`}>
                    <span>{column.label}</span>
                    <strong>{column.render ? column.render(row, index) : row[column.key] ?? "-"}</strong>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
