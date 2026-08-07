export default function Tabs({ items = [], activeKey, onChange }) {
  return (
    <div className="da-tabs da-tabs-v2" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={activeKey === item.key}
          className={`da-tab ${activeKey === item.key ? "active" : ""}`}
          onClick={() => onChange?.(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
