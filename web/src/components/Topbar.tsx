import { ProjectSwitcher } from "./ProjectSwitcher";
import { SprintChip } from "./SprintChip";
import { SearchBox } from "./SearchBox";
import { NewIssueButton } from "./NewIssueButton";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="logo">
          <span className="logo-mark">M</span> MYTHRIL
        </div>
        <ProjectSwitcher />
        <SprintChip />
        <div className="topbar-actions">
          <SearchBox />
          <NewIssueButton />
        </div>
      </div>
    </header>
  );
}
