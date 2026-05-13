export default function Header() {
  return (
    <header className="w-full py-6 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Logo icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{
            background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))',
            boxShadow: '0 4px 16px var(--accent-glow)',
          }}
        >
          ✂️
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight gradient-text">
            Smart Subject Lift
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            AI-Powered Object Extraction
          </p>
        </div>
      </div>

      <div
        className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
        style={{
          background: 'rgba(0, 206, 201, 0.1)',
          border: '1px solid rgba(0, 206, 201, 0.2)',
          color: 'var(--success)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        SAM Model
      </div>
    </header>
  )
}
