export default function Header({ count }) {
  return (
    <header>
      <h1>📍 מאסף שדה</h1>
      <span className="badge">{count} רשומות</span>
    </header>
  );
}
