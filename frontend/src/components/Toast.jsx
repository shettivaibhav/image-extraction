export default function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? 'visible' : ''}`} role="alert">
      {message}
    </div>
  )
}
