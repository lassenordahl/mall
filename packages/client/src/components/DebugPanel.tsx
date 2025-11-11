interface DebugPanelProps {
  noclip: boolean;
  onNoclipChange: (enabled: boolean) => void;
}

export function DebugPanel({ noclip, onNoclipChange }: DebugPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: '#333',
        fontFamily: 'monospace',
        fontSize: '14px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '10px 15px',
        borderRadius: '5px',
        minWidth: '150px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Debug</div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={noclip}
          onChange={(e) => onNoclipChange(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <span>Noclip</span>
      </label>
    </div>
  );
}
