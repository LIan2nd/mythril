function SkeletonCard() {
  return (
    <div className="skel" aria-hidden="true">
      <i className="short" />
      <i />
      <i />
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <section className="board" aria-label="Loading board">
      {(["To Do", "In Progress", "Code Review", "Shipped"] as const).map((label) => (
        <div className="col" key={label}>
          <div className="col-head">
            <h2>{label}</h2>
            <span className="count num">··</span>
          </div>
          <div className="col-body">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ))}
    </section>
  );
}
