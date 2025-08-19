import { NavLink } from "react-router-dom";
import { Brain } from "lucide-react";

const Header = () => {
  const navItems = [
    { name: "Import", path: "/" },
    { name: "Criteria", path: "/criteria" },
    { name: "Screening", path: "/screening" },
    { name: "Dual Review", path: "/dual-review" },
    { name: "Results", path: "/results" },
  ];

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              AI-Powered Systematic Review Screening
            </h1>
            <p className="text-sm text-muted-foreground">
              Intelligent Abstract Screening Assistant
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-primary ${
                  isActive 
                    ? "text-primary border-b-2 border-primary pb-1" 
                    : "text-muted-foreground"
                }`
              }
              end={item.path === "/"}
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;