export default function DataTable({ columns = [], rows = [], getRowKey, onRowClick }) {
  return (
    <div className="da-table-card">
      <table className="da-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length || 1}>
                <span className="da-muted">Belum ada data.</span>
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = getRowKey?.(row, index) || row.id || index;

              return (
                <tr
                  key={key}
                  className={onRowClick ? "clickable" : ""}
                  data-clickable={onRowClick ? "true" : "false"}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key}>
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
  );
}
