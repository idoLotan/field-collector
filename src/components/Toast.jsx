export default function Toast({ msg }) {
  return (
    <div id="toast" className={msg ? 'show' : ''}>
      {msg || ''}
    </div>
  );
}
