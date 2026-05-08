import { SketchyFilter } from "./SketchyFilter";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { BottomTabs } from "./BottomTabs";
import "./dashboard.css";
import "./skeleton.css";

/**
 * Body-only skeleton. Chrome (sidebar + topbar + bottom tabs) renders solid
 * with placeholder counts so navigation feels stable; only the dynamic body
 * region shimmers. Loading.tsx is a server component but can't fetch user
 * data, so counts/profile are blank — the real page replaces this within
 * a few hundred ms once data lands.
 */
export default function DashboardLoading() {
  return (
    <div className="lungnote-dashboard">
      <SketchyFilter />
      <div className="dash-shell">
        <Sidebar active="home" />
        <main className="dash-main">
          <Topbar pictureUrl={null} initial="?" locale="th" />
          <div className="dash-body">
            <div className="skel-greeting">
              <div className="skel skel-line xl" style={{ width: "70%" }} />
              <div
                className="skel skel-line sm"
                style={{ width: "40%", marginTop: 6 }}
              />
            </div>
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
                    <div
                      className="skel skel-line md"
                      style={{ width: "60%" }}
                    />
                    <div
                      className="skel skel-line sm"
                      style={{ width: "30%", marginTop: 4 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
      <BottomTabs active="home" />
    </div>
  );
}
