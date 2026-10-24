/** Loading shape rather than a spinner: the host knows what is coming, so the
 *  page holds its layout while the numbers arrive. */
export function ManageSkeleton({ label }: { label: string }) {
  return (
    // role="status" so the label is announced; the shapes themselves are
    // decorative and carry no meaning for a screen reader.
    <div className="hm-skeleton" role="status" aria-busy="true" aria-label={label}>
      <div className="hm-sk hm-sk-kicker" />
      <div className="hm-sk hm-sk-title" />
      <div className="hm-sk hm-sk-sub" />

      {/* The summary's shape: the total, the thin bar, two counts. */}
      <div className="hm-card">
        <div className="hm-sk hm-sk-bignum" />
        <div className="hm-sk hm-sk-bar" />
        <div className="hm-counts">
          <div className="hm-sk hm-sk-count" />
          <div className="hm-sk hm-sk-count" />
        </div>
      </div>

      <div className="hm-card">
        {[0, 1, 2].map((row) => (
          <div key={row} className="hm-sk-row">
            <div className="hm-sk hm-sk-avatar" />
            <div className="hm-sk hm-sk-line" />
            <div className="hm-sk hm-sk-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
