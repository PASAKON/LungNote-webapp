import { SketchyFilter } from "./SketchyFilter";
import "./dashboard.css";
import "./skeleton.css";

export default function DashboardLoading() {
  return (
    <div className="lungnote-dashboard">
      <SketchyFilter />
      <div className="dash-shell">
        <aside className="dash-sidebar" aria-hidden>
          <div className="skel skel-line lg" style={{ width: 140 }} />
          <div className="skel skel-line sm" style={{ width: 60, marginTop: 24 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel skel-row" />
          ))}
        </aside>
        <main className="dash-main">
          <div className="skel-topbar">
            <div className="skel skel-circle" />
            <div className="skel skel-line lg" style={{ flex: 1, maxWidth: 160 }} />
            <div className="skel skel-circle" style={{ marginLeft: "auto" }} />
          </div>
          <div className="dash-body">
            <div className="skel-greeting">
              <div className="skel skel-line xl" style={{ width: "70%" }} />
              <div className="skel skel-line sm" style={{ width: "40%", marginTop: 6 }} />
            </div>
            <div className="skel skel-search" />
            <div className="skel-stats">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skel skel-stat" />
              ))}
            </div>
            <div className="skel-section-h">
              <div className="skel skel-line md" style={{ width: 120 }} />
              <div className="skel skel-line sm" style={{ width: 60 }} />
            </div>
            <div className="skel-list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skel-row-card">
                  <div className="skel skel-circle sm" />
                  <div className="skel-row-text">
                    <div className="skel skel-line md" style={{ width: "60%" }} />
                    <div className="skel skel-line sm" style={{ width: "30%", marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
