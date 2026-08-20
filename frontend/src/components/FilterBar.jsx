function normalizeLabel(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

export default function FilterBar({
  search,
  onSearchChange,
  sector,
  onSectorChange,
  province,
  onProvinceChange,
  sectors,
  provinces,
  onReset,
}) {
  return (
    <div className="filters-card">
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher un projet, une filière, un code..."
          aria-label="Rechercher un projet"
        />
      </div>

      <label className="select-field">
        <span>Secteur</span>
        <select value={sector} onChange={(event) => onSectorChange(event.target.value)}>
          <option value="">Tous les secteurs</option>
          {sectors.map((item) => (
            <option key={item} value={item}>{normalizeLabel(item)}</option>
          ))}
        </select>
      </label>

      <label className="select-field">
        <span>Province</span>
        <select value={province} onChange={(event) => onProvinceChange(event.target.value)}>
          <option value="">Toutes les provinces</option>
          {provinces.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <button className="reset-button" type="button" onClick={onReset}>Réinitialiser</button>
    </div>
  );
}
