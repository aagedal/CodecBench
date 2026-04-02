import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Setup", icon: "S" },
  { to: "/benchmark", label: "Benchmark", icon: "B" },
  { to: "/history", label: "History", icon: "H" },
];

function Sidebar() {
  return (
    <aside className="w-56 bg-surface-900 border-r border-surface-700 flex flex-col">
      <div className="p-4 border-b border-surface-700">
        <h1 className="text-lg font-bold text-white tracking-tight">
          CodecBench
        </h1>
        <p className="text-xs text-surface-400 mt-0.5">FFmpeg Benchmark Tool</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-surface-300 hover:bg-surface-800 hover:text-surface-100"
              }`
            }
          >
            <span className="w-6 h-6 rounded bg-surface-700 flex items-center justify-center text-xs font-mono">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-surface-700">
        <p className="text-xs text-surface-500">v0.1.0</p>
      </div>
    </aside>
  );
}

export default Sidebar;
