interface ProgressBarProps {
  done: number;
  total: number;
}

export function ProgressBar({ done, total }: ProgressBarProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="prog">
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="pct num">{pct}%</span>
    </div>
  );
}
