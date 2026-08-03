export default function Tabs({ items = [], activeKey, onChange }) {
  return (
    <div className="da-tabs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`da-tab ${activeKey === item.key ? "active" : ""}`}
          onClick={() => onChange?.(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
