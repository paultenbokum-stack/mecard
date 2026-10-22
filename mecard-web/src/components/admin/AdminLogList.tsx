import { Card } from "@/components/admin/ui";
import { recentAdminLog, type LogEntity } from "@/lib/admin-log";
import { formatDate } from "@/lib/money";

/** The staff changes recorded for one item. */
export async function AdminLogList({ entity, id }: { entity: LogEntity; id: number }) {
  const rows = await recentAdminLog(entity, id);
  return (
    <Card title={`Staff changes (${rows.length})`}>
      {rows.length ? (
        <ol className="adm-notes">
          {rows.map(({ l, actor }) => (
            <li key={l.id}>
              <div>
                {l.action}
                {l.detail ? <span className="adm-muted">: {l.detail}</span> : null}
              </div>
              <div className="adm-notes__meta">
                {formatDate(l.createdAt, true)} · {actor ?? "staff"}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="adm-muted" style={{ margin: 0 }}>
          None yet.
        </p>
      )}
    </Card>
  );
}
